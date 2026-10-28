import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: false });
}

async function boot(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Empezar a estudiar|Todo al día/ })).toBeVisible({ timeout: 30_000 });
}

test('el inicio carga el banco inicial y muestra el plan del día', async ({ page }) => {
  await boot(page);
  await expect(page.getByText(/Objetivo: /)).toBeVisible();
  await expect(page.getByText('15', { exact: true }).first()).toBeVisible();
  await shot(page, '01-dashboard');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('sesión de estudio: revelar, calificar, deshacer (teclado y botones)', async ({ page, isMobile }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Empezar a estudiar' }).click();
  await expect(page.getByRole('button', { name: /Mostrar respuesta/ })).toBeVisible();
  await shot(page, '02-study-front');
  if (isMobile) await page.getByRole('button', { name: /Mostrar respuesta/ }).click();
  else await page.keyboard.press('Space');
  await expect(page.getByText('Respuesta', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Good/ })).toBeVisible();
  await shot(page, '03-study-back');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (isMobile) await page.getByRole('button', { name: /^Good/ }).click();
  else await page.keyboard.press('3');
  await expect(page.getByRole('button', { name: /Mostrar respuesta/ })).toBeVisible();
  // Deshacer vuelve a la tarjeta anterior ya revelada
  await page.getByRole('button', { name: /Deshacer/ }).click();
  await expect(page.getByRole('button', { name: /^Good/ })).toBeVisible();
  await page.getByRole('button', { name: /^Again/ }).click();
  await expect(page.getByRole('button', { name: /Mostrar respuesta/ })).toBeVisible();
});

test('los datos persisten tras recargar (IndexedDB)', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Empezar a estudiar' }).click();
  await page.getByRole('button', { name: /Mostrar respuesta/ }).click();
  await page.getByRole('button', { name: /^Easy/ }).click();
  await expect(page.getByRole('button', { name: /Mostrar respuesta/ })).toBeVisible();
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByText(/Repasadas hoy/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/1 nuevas · 0 «Again»/)).toBeVisible();
});

test('biblioteca: búsqueda y detalle de un conocimiento', async ({ page }) => {
  await boot(page);
  await page.goto('./#/library');
  await page.getByPlaceholder(/Buscar expresión/).fill('work like magic');
  await page.getByRole('link', { name: /work like magic/ }).first().click();
  await expect(page.getByRole('heading', { name: 'work like magic' })).toBeVisible();
  await expect(page.getByText('had magic effects')).toBeVisible();
  await shot(page, '04-detail');
});

test('importación desde JSON con vista previa', async ({ page }) => {
  await boot(page);
  await page.goto('./#/add?tab=import');
  const payload = { format: 'c2-recall/v1', items: [{ expression: 'cut corners', meaningEs: 'hacer algo de forma chapucera para ahorrar', categories: ['idiom'], examParts: ['P1'], examples: [['They {{cut corners}} on safety.', 'Escatimaron en seguridad.']] }, { expression: 'work like magic', meaningEs: 'funcionar de maravilla', wrongAnswers: ['had magic'] }] };
  await page.getByPlaceholder(/format/).fill(JSON.stringify(payload));
  await page.getByRole('button', { name: /Analizar/ }).click();
  await expect(page.getByText('Nuevo', { exact: true })).toBeVisible();
  await expect(page.getByText('Lo volviste a fallar', { exact: true })).toBeVisible();
  await shot(page, '05-import-preview');
  await page.getByRole('button', { name: 'Confirmar importación' }).click();
  await expect(page.getByText('Importación completada')).toBeVisible();
});

test('estadísticas, mazos y ajustes se renderizan', async ({ page }) => {
  await boot(page);
  await page.goto('./#/stats');
  await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible();
  await shot(page, '06-stats');
  await page.goto('./#/decks');
  await expect(page.getByText('Mis errores recurrentes')).toBeVisible();
  await shot(page, '07-decks');
  await page.goto('./#/settings');
  await expect(page.getByText(/Sincronización no configurada/)).toBeVisible();
  await page.goto('./#/coverage');
  await expect(page.getByText(/Cobertura de tus tres PDF/)).toBeVisible();
  await expect(page.getByText('todas contabilizadas')).toBeVisible();
  await shot(page, '08-coverage');
});

test('manifest PWA válido e instalable', async ({ page, request }) => {
  await boot(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href!, page.url()).toString());
  const manifest = await res.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  expect(manifest.start_url).toBe('/c2-recall/');
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg;
  });
  expect(sw).toBe(true);
});

test('funciona sin conexión después de la primera visita', async ({ page, context }) => {
  await boot(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole('button', { name: /Empezar a estudiar|Todo al día/ })).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /Empezar a estudiar|Todo al día/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Empezar a estudiar' }).click();
  await page.getByRole('button', { name: /Mostrar respuesta/ }).click();
  await page.getByRole('button', { name: /^Good/ }).click();
  await expect(page.getByRole('button', { name: /Mostrar respuesta/ })).toBeVisible();
  await context.setOffline(false);
});

test('navegación por teclado: foco visible y atajos', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'solo escritorio');
  await boot(page);
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(['A', 'BUTTON']).toContain(focused);
  await page.goto('./#/study/session?mode=scheduled');
  await expect(page.getByRole('button', { name: /Mostrar respuesta/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Hard/ })).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: /Mostrar respuesta/ })).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: false });
}

async function boot(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Show answer|Check/ })).toBeVisible({ timeout: 30_000 });
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('abre directo en una tarjeta, sin secciones extra ni texto en español', async ({ page }) => {
  await boot(page);
  await expect(page.getByLabel('Answer').first()).toBeFocused();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  for (const gone of [/Biblioteca/, /Progreso/, /Estudiar/, /Inicio/, /Again/, /Good/]) {
    await expect(page.getByText(gone)).toHaveCount(0);
  }
  await shot(page, '01-front');
  await noOverflow(page);
  if (SHOTS) {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByRole('button', { name: 'Show answer' }).click();
    await shot(page, '06-dark');
  }
});

test('revelar sin escribir, Next, y escribir para que corrija sola', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  await shot(page, '02-back-missed');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
  // Enter corrige y Enter otra vez pasa a la siguiente.
  await page.getByLabel('Answer').first().fill('zzz');
  await expect(page.getByRole('button', { name: 'Check' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  await expect(page.locator('.attempt').first()).toHaveText('zzz');
  await shot(page, '03-back-wrong');
  await noOverflow(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
  await noOverflow(page);
});

test('aparecen los dos modos (frases y word formation)', async ({ page }) => {
  await boot(page);
  const seen = new Set<string>();
  for (let i = 0; i < 30 && seen.size < 2; i++) {
    seen.add((await page.locator('.root-word').count()) ? 'wf' : 'phrase');
    if (seen.has('wf') && SHOTS) await shot(page, '04-word-formation');
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  expect([...seen].sort()).toEqual(['phrase', 'wf']);
});

test('los repasos quedan guardados (IndexedDB) y la app los programa', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
  const reviews = await page.evaluate(() => new Promise<number>((resolve) => {
    const req = indexedDB.open('c2-recall');
    req.onsuccess = () => {
      const tx = req.result.transaction('reviews', 'readonly');
      const c = tx.objectStore('reviews').count();
      c.onsuccess = () => resolve(c.result);
    };
  }));
  expect(reviews).toBe(1);
});

test('ajustes en inglés', async ({ page }) => {
  await boot(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('Target retention')).toBeVisible();
  await shot(page, '05-settings');
  await noOverflow(page);
  await page.getByRole('link', { name: 'Back to practice' }).click();
  await expect(page.getByRole('button', { name: /Show answer|Check/ })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
  await context.setOffline(false);
});

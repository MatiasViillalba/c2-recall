import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: false });
  }
}

async function boot(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Show answer' }).last()).toBeVisible({ timeout: 30_000 });
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const showAnswer = (page: Page) => page.locator('.show-btn');

test('abre directo en una flashcard, con dos pestañas y sin español', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.face-front .phrase')).toBeVisible();
  await expect(page.locator('.face-front .gap-slot')).toHaveCount(1);
  await expect(page.locator('.face-front .cue')).not.toBeEmpty();
  const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
  await expect(tabs).toHaveText(['Flashcards', 'Settings']);
  await expect(page.locator('body')).not.toContainText(/Estudiar|Biblioteca|Progreso|Ajustes/);
  await shot(page, '01-front');
  await noOverflow(page);
});

test('dar vuelta y calificar como en Anki (Again / Hard / Good / Easy)', async ({ page }) => {
  await boot(page);
  await showAnswer(page).click();
  await expect(page.locator('.flip-inner')).toHaveClass(/is-flipped/);
  await expect(page.locator('.face-back .answer')).toBeVisible();
  await expect(page.locator('.face-back .example strong').first()).toBeVisible();
  const buttons = page.locator('.rate-btn .rate-label');
  await expect(buttons).toHaveText(['Again', 'Hard', 'Good', 'Easy']);
  await expect(page.locator('.rate-btn .rate-ivl').first()).toHaveText(/\d|</);
  await shot(page, '02-back');
  await noOverflow(page);
  const before = Number(await page.locator('.count-new').textContent());
  await page.locator('.rate-good').click();
  await expect(showAnswer(page)).toBeVisible();
  await expect(page.locator('.count-new')).toHaveText(String(before - 1));
  // Deshacer vuelve a la tarjeta anterior ya dada vuelta.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.rate-btn')).toHaveCount(4);
  await expect(page.locator('.count-new')).toHaveText(String(before));
});

test('tocar la tarjeta también la da vuelta; Again la devuelve al aprendizaje', async ({ page }) => {
  await boot(page);
  await page.locator('.flip-inner').click();
  await expect(page.locator('.flip-inner')).toHaveClass(/is-flipped/);
  await page.locator('.rate-again').click();
  await expect(page.locator('.count-learn')).toHaveText('1');
});

test('teclado: espacio da vuelta, espacio otra vez = Good', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'solo notebook');
  await boot(page);
  await page.keyboard.press('Space');
  await expect(page.locator('.flip-inner')).toHaveClass(/is-flipped/);
  await page.keyboard.press('Space');
  await expect(page.locator('.flip-inner')).not.toHaveClass(/is-flipped/);
  const reviews = await page.evaluate(() => new Promise<number>((resolve) => {
    const req = indexedDB.open('c2-recall');
    req.onsuccess = () => {
      const c = req.result.transaction('reviews', 'readonly').objectStore('reviews').count();
      c.onsuccess = () => resolve(c.result);
    };
  }));
  expect(reviews).toBe(1);
});

test('aparecen distintas categorías (idioms, collocations, phrasal verbs…)', async ({ page }) => {
  await boot(page);
  const seen = new Set<string>();
  for (let i = 0; i < 14; i++) {
    seen.add((await page.locator('.face-front .cat-chip').textContent()) ?? '');
    if (SHOTS && i === 3) await shot(page, '03-another');
    await showAnswer(page).click();
    await page.locator('.rate-easy').click();
  }
  expect(seen.size).toBeGreaterThan(2);
});

test('ajustes en inglés con límite de nuevas por día', async ({ page }) => {
  await boot(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('New cards per day')).toBeVisible();
  await shot(page, '05-settings');
  await noOverflow(page);
  await page.getByRole('link', { name: 'Flashcards' }).click();
  await expect(showAnswer(page)).toBeVisible();
  if (SHOTS) {
    await page.emulateMedia({ colorScheme: 'dark' });
    await shot(page, '06-dark-front');
    await showAnswer(page).click();
    await shot(page, '07-dark-back');
  }
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
  const sw = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  expect(sw).toBe(true);
});

test('funciona sin conexión después de la primera visita', async ({ page, context }) => {
  await boot(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(showAnswer(page)).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(showAnswer(page)).toBeVisible({ timeout: 30_000 });
  await showAnswer(page).click();
  await page.locator('.rate-good').click();
  await expect(showAnswer(page)).toBeVisible();
  await context.setOffline(false);
});

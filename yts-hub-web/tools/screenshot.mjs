/**
 * Screenshot runner untuk visual review manual dan visual regression
 * (10-DEVELOPMENT-PLAN.md §11 — "screenshot regression for landing page key breakpoints").
 *
 * Pakai: jalankan `npm run dev` di terminal lain, lalu `npm run shot`.
 * Hasil masuk ke folder screenshots/ (di-gitignore).
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOT_BASE_URL ?? 'http://localhost:4321';
const OUT = 'screenshots';

/** Dev toolbar Astro tidak boleh ikut terpotret. */
const HIDE_DEV_TOOLBAR = 'astro-dev-toolbar { display: none !important; }';

const shots = [
  { name: 'desktop-full', width: 1440, height: 900 },
  { name: 'desktop-fold', width: 1440, height: 900, full: false },
  { name: 'tablet-full', width: 834, height: 1000 },
  { name: 'mobile-full', width: 390, height: 844, mobile: true },
  { name: 'mobile-fold', width: 390, height: 844, mobile: true, full: false },
  {
    name: 'mobile-menu',
    width: 390,
    height: 844,
    mobile: true,
    full: false,
    async before(page) {
      await page.click('[data-menu-toggle]');
      await page.waitForTimeout(300);
    },
  },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    isMobile: shot.mobile ?? false,
  });
  const page = await context.newPage();
  await page.goto(BASE + (shot.path ?? '/'), { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_DEV_TOOLBAR });
  await page.waitForTimeout(500);
  if (shot.before) await shot.before(page);
  await page.screenshot({ path: `${OUT}/${shot.name}.png`, fullPage: shot.full ?? true });
  await context.close();
  console.log(`✓ ${OUT}/${shot.name}.png`);
}

await browser.close();

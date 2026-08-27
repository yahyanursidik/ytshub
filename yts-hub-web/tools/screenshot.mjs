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
  { name: 'layanan-desktop', width: 1440, height: 900, path: '/layanan' },
  { name: 'layanan-detail-desktop', width: 1440, height: 900, path: '/layanan/ppdb-online' },
  { name: 'unit-detail-desktop', width: 1440, height: 900, path: '/unit/ts-lab-school' },
  { name: 'program-desktop', width: 1440, height: 900, path: '/program' },
  { name: 'event-desktop', width: 1440, height: 900, path: '/event' },
  // Fase 4 — pencarian & FAQ.
  { name: 'cari-hasil-desktop', width: 1440, height: 900, path: '/cari?q=donasi' },
  { name: 'cari-kosong-desktop', width: 1440, height: 900, path: '/cari?q=sekolh' },
  { name: 'faq-desktop', width: 1440, height: 900, path: '/faq' },
  { name: 'faq-detail-desktop', width: 1440, height: 900, path: '/faq/cara-berdonasi' },
  {
    name: 'cari-autocomplete-desktop',
    width: 1440,
    height: 900,
    full: false,
    async before(page) {
      await page.fill('[data-search-input]', 'don');
      await page.waitForSelector('[data-search-suggestions] [role="option"]');
      await page.waitForTimeout(200);
    },
  },
  { name: 'cari-hasil-mobile', width: 390, height: 844, mobile: true, path: '/cari?q=donasi' },
  { name: 'faq-mobile', width: 390, height: 844, mobile: true, path: '/faq' },
  { name: 'faq-detail-mobile', width: 390, height: 844, mobile: true, path: '/faq/cara-berdonasi' },
  { name: 'layanan-mobile', width: 390, height: 844, mobile: true, path: '/layanan' },
  {
    name: 'unit-detail-mobile',
    width: 390,
    height: 844,
    mobile: true,
    path: '/unit/ts-lab-school',
  },
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

/**
 * Halaman admin (Fase 5) hanya dipotret bila kredensial tersedia:
 *   YTS_AUDIT_EMAIL=... YTS_AUDIT_PASSWORD=... npm run shot
 */
const adminShots = [
  { name: 'admin-dasbor', width: 1440, height: 900, path: '/admin' },
  { name: 'admin-daftar', width: 1440, height: 900, path: '/admin/layanan' },
  { name: 'admin-pengguna', width: 1440, height: 900, path: '/admin/pengguna' },
  { name: 'admin-dasbor-mobile', width: 390, height: 844, mobile: true, path: '/admin' },
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

const adminEmail = process.env.YTS_AUDIT_EMAIL;
const adminPassword = process.env.YTS_AUDIT_PASSWORD;

if (adminEmail && adminPassword) {
  for (const shot of adminShots) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
      isMobile: shot.mobile ?? false,
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/admin/masuk`, { waitUntil: 'networkidle' });
    await page.fill('#email', adminEmail);
    await page.fill('#password', adminPassword);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]'),
    ]);

    await page.goto(BASE + shot.path, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: HIDE_DEV_TOOLBAR });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${shot.name}.png`, fullPage: shot.full ?? true });
    await context.close();
    console.log(`✓ ${OUT}/${shot.name}.png`);
  }
} else {
  console.log('(Halaman admin dilewati — setel YTS_AUDIT_EMAIL dan YTS_AUDIT_PASSWORD.)');
}

await browser.close();

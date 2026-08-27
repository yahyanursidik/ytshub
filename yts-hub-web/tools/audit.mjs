/**
 * Audit accessibility & layout otomatis untuk landing page.
 * Mengecek butir-butir 09-ACCESSIBILITY-PERFORMANCE-SEO.md §2 dan
 * 12-ACCEPTANCE-CHECKLIST.md yang bisa diperiksa mesin.
 *
 * Pakai: jalankan `npm run dev` di terminal lain, lalu `npm run audit:a11y`.
 * Keluar dengan exit code 1 bila ada temuan.
 */
import { chromium } from 'playwright';

const BASE = process.env.SHOT_BASE_URL ?? 'http://localhost:4321';

/**
 * Setiap jenis halaman diperiksa, bukan hanya beranda: listing dan detail punya
 * struktur berbeda, jadi masalahnya juga berbeda.
 */
const PAGES = [
  '/',
  '/unit',
  '/unit/ts-lab-school',
  '/layanan',
  '/layanan/ppdb-online',
  '/program',
  '/program/belajar-islam-dasar',
  '/event',
  '/event/kajian-pekanan',
  '/aplikasi',
  '/hubungi-kami',
  '/404.html',
];

const findings = [];
const report = (label, items) => {
  if (items.length) findings.push({ label, items });
  console.log(`  ${items.length ? 'X' : 'ok'} ${label}${items.length ? ` (${items.length})` : ''}`);
  items.forEach((i) => console.log(`      - ${i}`));
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

// ---------------------------------------------------------------- desktop
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const path of PAGES) {
  console.log(`\n${path}`);
  await desktop.goto(BASE + path, { waitUntil: 'networkidle' });

  report(
    'Urutan heading logis (tidak melompat lebih dari satu level)',
    await desktop.evaluate(() => {
      const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter((el) => !el.closest('astro-dev-toolbar'))
        .map((el) => ({ level: Number(el.tagName[1]), text: el.textContent.trim().slice(0, 40) }));
      const problems = [];
      if (levels.filter((l) => l.level === 1).length !== 1) {
        problems.push(`jumlah <h1> = ${levels.filter((l) => l.level === 1).length}, seharusnya 1`);
      }
      for (let i = 1; i < levels.length; i += 1) {
        if (levels[i].level - levels[i - 1].level > 1) {
          problems.push(
            `lompat h${levels[i - 1].level} -> h${levels[i].level}: "${levels[i].text}"`,
          );
        }
      }
      return problems;
    }),
  );

  report(
    'Setiap control punya accessible name',
    await desktop.$$eval('button, a', (els) =>
      els
        .filter((el) => !el.closest('astro-dev-toolbar'))
        .filter(
          (el) =>
            !(el.innerText || '').trim() &&
            !el.getAttribute('aria-label') &&
            !el.getAttribute('aria-labelledby') &&
            !el.querySelector('.visually-hidden'),
        )
        .map((el) => el.outerHTML.slice(0, 80)),
    ),
  );

  report(
    'Setiap input punya label',
    await desktop.$$eval('input, select, textarea', (els) =>
      els
        .filter((el) => !el.closest('astro-dev-toolbar'))
        .filter(
          (el) =>
            !el.getAttribute('aria-label') &&
            !(el.id && document.querySelector(`label[for="${el.id}"]`)) &&
            !el.closest('label'),
        )
        .map((el) => el.outerHTML.slice(0, 80)),
    ),
  );

  report(
    'Link eksternal memakai rel="noopener"',
    await desktop.$$eval('a[target="_blank"]', (els) =>
      els
        .filter((el) => !(el.getAttribute('rel') || '').includes('noopener'))
        .map((el) => el.outerHTML.slice(0, 80)),
    ),
  );

  report(
    'Breadcrumb ada pada halaman level >= 2',
    await desktop.evaluate((p) => {
      // 404 dikecualikan: tidak ada jalur yang bisa ditampilkan untuk halaman
      // yang memang tidak ada. Jalan keluarnya disediakan lewat tautan, bukan
      // breadcrumb (01-PRODUCT-BRIEF §7 "no dead ends").
      if (p.startsWith('/404')) return [];
      const depth = p
        .replace(/\/$|\.html$/, '')
        .split('/')
        .filter(Boolean).length;
      if (depth < 1) return [];
      return document.querySelector('nav[aria-label="Breadcrumb"]')
        ? []
        : ['halaman ini tidak punya breadcrumb'];
    }, path),
  );

  report(
    'Skip-to-content tersedia',
    (await desktop.$('a.skip-link')) ? [] : ['tidak ada .skip-link'],
  );
}

// ----------------------------------------------------------------- mobile
const mobileCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
});
const mobile = await mobileCtx.newPage();

for (const path of PAGES) {
  console.log(`\n${path} (390px)`);
  await mobile.goto(BASE + path, { waitUntil: 'networkidle' });

  report(
    'Tidak scroll horizontal',
    await mobile.evaluate(() => {
      window.scrollTo(9999, 0);
      const scrolled = window.scrollX;
      window.scrollTo(0, 0);
      return scrolled > 0 ? [`body dapat digeser ${scrolled}px ke samping`] : [];
    }),
  );

  report(
    'Target sentuh utama >= 44px (link inline dikecualikan, WCAG 2.5.8)',
    await mobile.$$eval(
      'a.btn, button, a.link-action, a.brand, .menu-mobile a, .filters__group a',
      (els) =>
        els
          .filter((el) => !el.closest('astro-dev-toolbar'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.height < 44;
          })
          .map(
            (el) =>
              `${el.tagName}.${el.className} h=${Math.round(el.getBoundingClientRect().height)}`,
          ),
    ),
  );
}

await browser.close();

console.log(
  findings.length
    ? `\n${findings.length} kelompok temuan perlu ditindaklanjuti.`
    : '\nTidak ada temuan.',
);
process.exit(findings.length ? 1 : 0);

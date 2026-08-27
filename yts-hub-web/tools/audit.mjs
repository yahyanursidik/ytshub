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

const findings = [];
const report = (label, items) => {
  if (items.length) findings.push({ label, items });
  console.log(`${items.length ? '✗' : '✓'} ${label}${items.length ? ` (${items.length})` : ''}`);
  items.forEach((i) => console.log(`    · ${i}`));
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

// ---- Desktop ----
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(BASE, { waitUntil: 'networkidle' });

report(
  'Urutan heading logis (tidak melompat lebih dari satu level)',
  await desktop.evaluate(() => {
    const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter((el) => !el.closest('astro-dev-toolbar'))
      .map((el) => ({ level: Number(el.tagName[1]), text: el.textContent.trim().slice(0, 40) }));
    const problems = [];
    if (levels.filter((l) => l.level === 1).length !== 1) problems.push('jumlah <h1> bukan 1');
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i].level - levels[i - 1].level > 1) {
        problems.push(`lompat h${levels[i - 1].level} → h${levels[i].level}: "${levels[i].text}"`);
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
  'Setiap input punya <label> atau aria-label',
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
  'Skip-to-content tersedia',
  (await desktop.$('a.skip-link')) ? [] : ['tidak ada .skip-link di halaman'],
);

report(
  'Link eksternal memakai rel="noopener"',
  await desktop.$$eval('a[target="_blank"]', (els) =>
    els
      .filter((el) => !(el.getAttribute('rel') || '').includes('noopener'))
      .map((el) => el.outerHTML.slice(0, 80)),
  ),
);

// ---- Mobile ----
const mobileCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
});
const mobile = await mobileCtx.newPage();
await mobile.goto(BASE, { waitUntil: 'networkidle' });

report(
  'Halaman tidak scroll horizontal di 390px',
  await mobile.evaluate(() => {
    window.scrollTo(9999, 0);
    const scrolled = window.scrollX;
    window.scrollTo(0, 0);
    return scrolled > 0 ? [`body dapat digeser ${scrolled}px ke samping`] : [];
  }),
);

report(
  'Target sentuh utama minimal 44px (link inline dikecualikan, WCAG 2.5.8)',
  await mobile.$$eval('a.btn, button, a.link-action, a.brand, .menu-mobile a', (els) =>
    els
      .filter((el) => !el.closest('astro-dev-toolbar'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 44;
      })
      .map(
        (el) => `${el.tagName}.${el.className} h=${Math.round(el.getBoundingClientRect().height)}`,
      ),
  ),
);

await browser.close();

console.log(
  findings.length
    ? `\n${findings.length} kelompok temuan perlu ditindaklanjuti.`
    : '\nTidak ada temuan.',
);
process.exit(findings.length ? 1 : 0);

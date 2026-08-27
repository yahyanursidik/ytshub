/**
 * Budget performa — 09-ACCESSIBILITY-PERFORMANCE-SEO.md §4-§5.
 *
 * §4 menetapkan target lapangan (LCP ≤ 2,5s, INP ≤ 200ms, CLS ≤ 0,1 pada p75).
 * Angka itu hanya bisa diukur dari pengunjung sungguhan dengan perangkat dan
 * jaringan mereka — tidak bisa dijamin dari mesin pengembang.
 *
 * Yang BISA dijaga sebelum rilis adalah penyebabnya. Berkas ini mengukur berat
 * halaman dan jumlah JavaScript yang dikirim, lalu gagal bila melewati batas.
 * Ia tidak menjanjikan LCP tertentu; ia mencegah satu perubahan menggandakan
 * bundle tanpa ada yang menyadarinya sampai keluhan datang dari lapangan.
 *
 * Batasnya ditetapkan dari keadaan yang sudah tercapai hari ini, ditambah
 * kelonggaran secukupnya. Budget yang disetel jauh di atas kenyataan tidak
 * pernah gagal, dan yang tidak pernah gagal tidak menjaga apa pun.
 *
 * Pakai: npm run build lalu npm run budget
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';

const DIST = 'dist';

/**
 * Batas dalam kilobyte setelah kompresi gzip — itulah yang benar-benar melintasi
 * jaringan. Mengukur ukuran mentah akan melaporkan angka yang tidak pernah
 * dialami pengunjung mana pun.
 */
const BUDGET = {
  /** HTML satu halaman, termasuk CSS yang di-inline Astro. */
  htmlKb: 30,
  /** Seluruh JavaScript yang dimuat satu halaman. */
  jsPerPageKb: 18,
  /**
   * Gabungan JavaScript yang BENAR-BENAR dirujuk halaman.
   *
   * Bukan seluruh isi `_astro/`. Direktori itu juga memuat chunk yang tidak
   * pernah ditarik halaman mana pun — runtime React yang terpasang untuk admin
   * termasuk di dalamnya. Menghitungnya berarti budget gagal karena berkas yang
   * tidak pernah diunduh pengunjung, dan budget yang gagal karena alasan yang
   * salah akan dinaikkan terus sampai berhenti berarti.
   *
   * Batas ini menangkap yang tidak tertangkap batas per-halaman: dua halaman
   * memuat bundel berbeda yang masing-masing kecil, tetapi jumlah kode yang
   * dikirim ke seluruh pengunjung terus bertambah.
   */
  jsTotalKb: 25,
  /** Satu berkas CSS. */
  cssKb: 30,
};

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;
const gzipped = (buffer) => gzipSync(buffer, { level: 9 }).length;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : Promise.resolve([full]);
    }),
  );
  return files.flat();
}

const all = await walk(DIST);
const problems = [];

/* --------------------------------------------------------------- per CSS */

for (const file of all.filter((f) => f.endsWith('.css'))) {
  const size = kb(gzipped(await readFile(file)));
  if (size > BUDGET.cssKb) {
    problems.push(`${relative(DIST, file)}: CSS ${size} KB melewati batas ${BUDGET.cssKb} KB.`);
  }
}

/* ------------------------------------------------------------ per halaman */

const pages = all.filter((file) => file.endsWith('.html'));
const rows = [];
/** Aset JS yang dirujuk minimal satu halaman — dasar budget total. */
const referencedAssets = new Set();

for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const htmlKb = kb(gzipped(Buffer.from(html)));

  /**
   * JavaScript yang di-inline langsung ke HTML.
   *
   * Astro menyisipkan skrip kecil ke dalam halaman alih-alih menjadikannya
   * berkas terpisah. Menghitung hanya `src=` akan melaporkan angka JS yang jauh
   * lebih kecil daripada yang benar-benar dieksekusi peramban — dan budget yang
   * melaporkan angka yang salah lebih buruk daripada tidak ada budget.
   *
   * `application/ld+json` sengaja tidak dihitung: itu data terstruktur, bukan
   * kode yang dijalankan.
   */
  const inlineJs = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => !/type\s*=\s*["']application\/ld\+json["']/.test(attrs))
    .map(([, , body]) => body)
    .join('\n');

  // JavaScript yang dirujuk halaman ini sebagai berkas terpisah.
  const referenced = [...html.matchAll(/(?:src|href)="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]);
  let pageJs = inlineJs ? gzipped(Buffer.from(inlineJs)) : 0;
  for (const asset of new Set(referenced)) {
    try {
      const assetPath = join(DIST, asset);
      await stat(assetPath);
      pageJs += gzipped(await readFile(assetPath));
      referencedAssets.add(assetPath);
    } catch {
      // Aset yang dirujuk tetapi tidak ada akan tertangkap check:links, bukan di sini.
    }
  }

  const route = '/' + relative(DIST, file).split('\\').join('/').replace(/index\.html$/, '');
  rows.push({ route, htmlKb, jsKb: kb(pageJs) });

  if (htmlKb > BUDGET.htmlKb) {
    problems.push(`${route}: HTML ${htmlKb} KB melewati batas ${BUDGET.htmlKb} KB.`);
  }
  if (kb(pageJs) > BUDGET.jsPerPageKb) {
    problems.push(`${route}: JavaScript ${kb(pageJs)} KB melewati batas ${BUDGET.jsPerPageKb} KB.`);
  }
}

let totalJs = 0;
for (const asset of referencedAssets) totalJs += gzipped(await readFile(asset));

console.log(
  `Berkas JS yang dirujuk halaman: ${kb(totalJs)} KB gzip dari ${referencedAssets.size} berkas ` +
    `(batas ${BUDGET.jsTotalKb})`,
);
console.log('Angka JS per halaman di bawah sudah termasuk skrip yang di-inline ke HTML.');
if (kb(totalJs) > BUDGET.jsTotalKb) {
  problems.push(`Total JavaScript ${kb(totalJs)} KB melewati batas ${BUDGET.jsTotalKb} KB.`);
}

rows.sort((a, b) => b.htmlKb + b.jsKb - (a.htmlKb + a.jsKb));

console.log(`\nLima halaman terberat dari ${rows.length}:`);
for (const row of rows.slice(0, 5)) {
  console.log(`  ${String(row.htmlKb).padStart(6)} KB HTML  ${String(row.jsKb).padStart(5)} KB JS  ${row.route}`);
}

if (problems.length > 0) {
  console.log(`\n✗ ${problems.length} pelanggaran budget:`);
  for (const problem of problems) console.log(`    ${problem}`);
  console.log('\nBila kenaikannya memang disengaja dan dibenarkan, naikkan batas di');
  console.log('tools/budget.mjs beserta alasannya — jangan diamkan.');
  process.exit(1);
}

console.log('\n✓ Seluruh halaman di dalam budget.');

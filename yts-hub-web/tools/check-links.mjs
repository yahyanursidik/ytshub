/**
 * Pemeriksa tautan internal pada hasil build.
 *
 * 12-ACCEPTANCE-CHECKLIST.md: "Tidak ada dead-end page" dan "Broken-link handling".
 * Script ini memeriksa yang bisa diperiksa mesin: setiap href internal di dalam
 * dist/ harus menunjuk halaman yang benar-benar dihasilkan build.
 *
 * Tautan eksternal TIDAK dipanggil di sini — itu tugas health check terjadwal
 * pada Fase 6 (08-INTEGRATION-AND-ROUTING.md §6), bukan bagian dari build.
 *
 * Pakai: npm run build lalu npm run check:links
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = 'dist';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : full;
    }),
  );
  return files.flat();
}

const allFiles = await walk(DIST);
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));

/** Semua path yang benar-benar bisa dibuka. */
const available = new Set();
for (const file of allFiles) {
  const rel = '/' + relative(DIST, file).split('\\').join('/');
  available.add(rel);
  if (rel.endsWith('/index.html')) {
    available.add(rel.slice(0, -'index.html'.length)); // /unit/
    available.add(rel.slice(0, -'/index.html'.length) || '/'); // /unit
  }
}

const problems = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const page = '/' + relative(DIST, file).split('\\').join('/');
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

  for (const href of hrefs) {
    // Lewati tautan eksternal, anchor, dan skema non-http.
    if (/^(https?:|mailto:|tel:|#|data:)/.test(href)) continue;
    if (!href.startsWith('/')) continue;

    checked += 1;
    const path = href.split('#')[0].split('?')[0];
    const candidates = [path, `${path}/`, `${path}/index.html`, `${path}index.html`];
    if (!candidates.some((candidate) => available.has(candidate))) {
      problems.push(`${page} -> ${href}`);
    }
  }
}

console.log(`Memeriksa ${checked} tautan internal di ${htmlFiles.length} halaman.`);

if (problems.length > 0) {
  console.log(`\n✗ ${problems.length} tautan menunjuk halaman yang tidak ada:`);
  for (const problem of [...new Set(problems)]) console.log(`    ${problem}`);
  process.exit(1);
}

console.log('✓ Tidak ada tautan internal yang putus.');

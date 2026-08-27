/**
 * CLI pemeriksaan tautan eksternal — 08-INTEGRATION-AND-ROUTING.md §6.
 *
 * Dirancang untuk dijalankan terjadwal (cron harian, GitHub Actions, atau
 * Netlify scheduled function), bukan dari build. Keluar dengan kode 1 bila ada
 * tautan yang BARU rusak, sehingga penjadwal bisa mengubahnya menjadi
 * pemberitahuan tanpa perlu membaca keluarannya.
 *
 * Pakai:
 *   npm run links:check          memeriksa dan menyimpan hasilnya
 *   npm run links:report         menampilkan hasil terakhir tanpa memanggil jaringan
 */
import 'dotenv/config';

import { checkAllLinks, listLinks } from '../src/server/integrations/link-monitor.ts';

const SYMBOL: Record<string, string> = {
  healthy: 'ok  ',
  redirected: '->  ',
  warning: '!   ',
  broken: 'X   ',
};

async function check() {
  console.log('Memeriksa tautan eksternal pada konten yang terbit...\n');

  const summary = await checkAllLinks({
    onProgress: (target, status) => {
      const mark = SYMBOL[status.split(' ')[0]!] ?? '    ';
      console.log(`${mark}${target.title} (${target.field})`);
      console.log(`      ${target.url}`);
      console.log(`      ${status}`);
    },
  });

  console.log('\n─────────────────────────────────────────');
  console.log(`Diperiksa : ${summary.checked}`);
  console.log(`Sehat     : ${summary.healthy}`);
  console.log(`Dialihkan : ${summary.redirected}`);
  console.log(`Peringatan: ${summary.warning}`);
  console.log(`Rusak     : ${summary.broken}`);
  if (summary.removed > 0) {
    console.log(`Dibuang   : ${summary.removed} baris untuk URL yang sudah tidak ada di konten`);
  }

  if (summary.newlyBroken.length > 0) {
    console.log(`\n✗ ${summary.newlyBroken.length} tautan BARU rusak dan perlu ditindaklanjuti:`);
    for (const item of summary.newlyBroken) {
      console.log(`    ${item.title}`);
      console.log(`    ${item.url}`);
      console.log(`    ${item.note}\n`);
    }
    console.log('Daftar lengkapnya ada di /admin/tautan.');
    // Keluar dengan kode gagal HANYA untuk yang baru rusak. Tautan yang sudah
    // rusak dan sedang ditangani tidak boleh membuat penjadwal mengirim
    // pemberitahuan yang sama setiap hari sampai orang berhenti membacanya.
    process.exit(1);
  }

  console.log('\n✓ Tidak ada tautan yang baru rusak.');
}

async function report() {
  const rows = await listLinks();

  if (rows.length === 0) {
    console.log('Belum ada tautan yang tercatat. Jalankan `npm run links:check` lebih dulu.');
    return;
  }

  console.table(
    rows.map((row) => ({
      status: row.status ?? '(belum)',
      judul: row.title ?? '(tanpa judul)',
      unit: row.unitName ?? '—',
      field: row.field,
      http: row.httpStatus ?? '—',
      diperiksa: row.checkedAt ? new Date(row.checkedAt).toLocaleString('id-ID') : '—',
    })),
  );
}

const command = process.argv[2] ?? 'check';

try {
  if (command === 'check') await check();
  else if (command === 'report') await report();
  else {
    console.log('Perintah: check (default) | report');
    process.exit(1);
  }
  process.exit(0);
} catch (error) {
  console.error(`\n✗ ${(error as Error).message}`);
  process.exit(1);
}

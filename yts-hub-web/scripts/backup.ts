/**
 * Cadangan konten dan verifikasinya — 10-DEVELOPMENT-PLAN.md §10
 * ("backup/restore validation").
 *
 * ## Ini BUKAN pengganti cadangan Neon
 *
 * Neon menyimpan riwayat dan bisa memulihkan database ke titik waktu mana pun.
 * Itu tetap jalur pemulihan utama bila terjadi kerusakan, dan lebih lengkap
 * daripada apa pun yang bisa dihasilkan perintah ini — ia mencakup seluruh
 * skema, bukan hanya konten.
 *
 * Yang dikerjakan perintah ini adalah hal yang TIDAK dilakukan cadangan
 * penyedia: mengeluarkan konten YTS ke berkas yang bisa dibaca tanpa Neon,
 * tanpa PostgreSQL, dan tanpa aplikasi ini. Kalau suatu hari yayasan pindah
 * penyedia — atau kehilangan akses ke akunnya — isi registry, layanan, program,
 * dan FAQ tetap ada dalam bentuk yang bisa dibaca manusia.
 *
 * Sama pentingnya: `verify` membuktikan berkas cadangannya benar-benar utuh.
 * Cadangan yang tidak pernah diperiksa adalah asumsi, bukan cadangan — dan
 * kegagalannya baru ketahuan pada hari ia dibutuhkan.
 *
 * Pakai:
 *   npm run db:backup                     tulis ke backups/yts-<tanggal>.json
 *   npm run db:backup -- verify <berkas>  periksa keutuhan berkas cadangan
 */
import 'dotenv/config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { closeDatabase, createDatabase, schema } from '../src/server/db/client.ts';

const OUT_DIR = 'backups';

/**
 * Tabel yang dicadangkan: seluruh KONTEN dan strukturnya.
 *
 * Yang sengaja TIDAK ikut:
 * - `users`, `sessions`, `accounts` — memuat hash kata sandi dan token sesi.
 *   Berkas cadangan berpindah tangan lebih mudah daripada database; kredensial
 *   tidak boleh ikut berpindah bersamanya.
 * - `search_queries`, `page_views`, `outbound_clicks`, `error_log` — data
 *   pengamatan yang bisa hilang tanpa merugikan siapa pun. Yang tidak
 *   tergantikan adalah konten yang ditulis pengelola.
 * - `external_links` — seluruhnya hasil pemeriksaan yang bisa dijalankan ulang.
 */
const TABLES = {
  units: schema.units,
  audiences: schema.audiences,
  tags: schema.tags,
  contacts: schema.contacts,
  services: schema.services,
  servicesToAudiences: schema.servicesToAudiences,
  programs: schema.programs,
  programsToAudiences: schema.programsToAudiences,
  programsToServices: schema.programsToServices,
  events: schema.events,
  faqCategories: schema.faqCategories,
  faqs: schema.faqs,
  faqsToServices: schema.faqsToServices,
  faqsToPrograms: schema.faqsToPrograms,
  applications: schema.applications,
  contentAudit: schema.contentAudit,
} as const;

interface Backup {
  format: string;
  createdAt: string;
  counts: Record<string, number>;
  data: Record<string, unknown[]>;
}

const FORMAT = 'yts-hub-content-v1';

async function backup() {
  const db = createDatabase();

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const [name, table] of Object.entries(TABLES)) {
    // `select()` tanpa kolom mengambil seluruh baris apa adanya — itulah yang
    // dibutuhkan cadangan. Kolom generated (search_vector) tidak ikut karena
    // tipenya `never` di skema, dan memang bisa dibangun ulang.
    const rows = await db.select().from(table as never);
    data[name] = rows;
    counts[name] = rows.length;
  }

  const payload: Backup = {
    format: FORMAT,
    createdAt: new Date().toISOString(),
    counts,
    data,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, `yts-${new Date().toISOString().slice(0, 10)}.json`);
  await writeFile(file, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`✓ Cadangan ditulis ke ${file}\n`);
  console.table(counts);
  console.log('\nPeriksa keutuhannya sekarang juga:');
  console.log(`  npm run db:backup -- verify ${file}`);

  await closeDatabase(db);
}

/**
 * Memeriksa keutuhan berkas cadangan TANPA menyentuh database.
 *
 * Yang diperiksa bukan sekadar "JSON-nya valid", melainkan hal-hal yang membuat
 * cadangan gagal dipulihkan: jumlah baris tidak cocok dengan yang dicatat, dan
 * rujukan antarbaris menunjuk id yang tidak ada di dalam berkas itu sendiri.
 * Cadangan yang rujukannya putus tidak bisa dipulihkan utuh, dan itu tidak
 * terlihat sampai dicoba.
 */
async function verify(file: string) {
  const raw = await readFile(file, 'utf8');
  const payload = JSON.parse(raw) as Backup;
  const problems: string[] = [];

  if (payload.format !== FORMAT) {
    problems.push(`Format tidak dikenal: ${payload.format} (diharapkan ${FORMAT}).`);
  }

  for (const name of Object.keys(TABLES)) {
    const rows = payload.data?.[name];
    if (!Array.isArray(rows)) {
      problems.push(`Tabel ${name} tidak ada di berkas cadangan.`);
      continue;
    }
    if (payload.counts?.[name] !== rows.length) {
      problems.push(
        `Tabel ${name}: dicatat ${payload.counts?.[name]} baris, isinya ${rows.length}.`,
      );
    }
  }

  const idsOf = (name: string) =>
    new Set((payload.data?.[name] ?? []).map((row) => (row as { id: string }).id));

  const unitIds = idsOf('units');
  const serviceIds = idsOf('services');
  const programIds = idsOf('programs');
  const faqIds = idsOf('faqs');

  const checkRef = (
    table: string,
    column: string,
    known: Set<string>,
    optional = false,
  ) => {
    for (const row of payload.data?.[table] ?? []) {
      const value = (row as Record<string, string | null>)[column];
      if (value === null || value === undefined) {
        if (!optional) problems.push(`${table}.${column} kosong pada satu baris.`);
        continue;
      }
      if (!known.has(value)) {
        problems.push(`${table}.${column} menunjuk id yang tidak ada di cadangan: ${value}.`);
      }
    }
  };

  checkRef('services', 'ownerUnitId', unitIds);
  checkRef('programs', 'ownerUnitId', unitIds);
  checkRef('faqs', 'ownerUnitId', unitIds);
  checkRef('applications', 'ownerUnitId', unitIds);
  checkRef('events', 'organizerUnitId', unitIds);
  checkRef('contacts', 'ownerUnitId', unitIds);
  checkRef('events', 'relatedProgramId', programIds, true);
  checkRef('programsToServices', 'serviceId', serviceIds);
  checkRef('programsToServices', 'programId', programIds);
  checkRef('faqsToServices', 'faqId', faqIds);
  checkRef('faqsToServices', 'serviceId', serviceIds);
  checkRef('faqsToPrograms', 'faqId', faqIds);
  checkRef('faqsToPrograms', 'programId', programIds);

  const total = Object.values(payload.counts ?? {}).reduce((sum, n) => sum + n, 0);

  console.log(`Berkas   : ${file}`);
  console.log(`Dibuat   : ${payload.createdAt}`);
  console.log(`Total    : ${total} baris di ${Object.keys(TABLES).length} tabel`);

  if (problems.length > 0) {
    console.log(`\n✗ ${problems.length} masalah pada cadangan:`);
    for (const problem of [...new Set(problems)].slice(0, 20)) console.log(`    ${problem}`);
    process.exit(1);
  }

  console.log('\n✓ Cadangan utuh: jumlah baris cocok dan seluruh rujukan antarbaris lengkap.');
}

const [command, file] = process.argv.slice(2);

try {
  if (!command || command === 'create') {
    await backup();
  } else if (command === 'verify') {
    if (!file) throw new Error('Pakai: npm run db:backup -- verify <berkas>');
    await verify(file);
  } else {
    console.log('Perintah: create (default) | verify <berkas>');
    process.exit(1);
  }
  process.exit(0);
} catch (error) {
  console.error(`\n✗ ${(error as Error).message}`);
  process.exit(1);
}

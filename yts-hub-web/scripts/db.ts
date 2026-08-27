/**
 * CLI database: check, migrate, seed, clear, status.
 * Dijalankan lewat `npm run db:*`. Sengaja dipisah dari kode aplikasi.
 */
import 'dotenv/config';

import { createDatabase } from '../src/server/db/client.ts';
import { runMigrations } from '../src/server/db/migrate.ts';
import { clearSeed, runSeed, seedSummary } from '../src/server/db/seed.ts';
import { getServerEnv } from '../src/server/env.ts';

const command = process.argv[2];

/** Menyembunyikan password saat connection string ditampilkan. */
function redact(url: string): string {
  return url.replace(/\/\/([^:]+):[^@]+@/, '//$1:••••••@');
}

async function check() {
  const { databaseUrl, isNeon } = getServerEnv();
  const { sql } = await import('drizzle-orm');

  console.log(`Target  : ${redact(databaseUrl)}`);
  console.log(`Driver  : ${isNeon ? 'neon-http (HTTPS/443)' : 'postgres.js (TCP/5432)'}`);

  const db = createDatabase();
  const result = await db.execute(sql`select version() as version, current_database() as db`);
  const row = (Array.isArray(result) ? result[0] : (result as { rows?: unknown[] }).rows?.[0]) as
    { version: string; db: string } | undefined;

  console.log(`Server  : ${row?.version ?? '(tidak terbaca)'}`);
  console.log(`Database: ${row?.db ?? '(tidak terbaca)'}`);

  const tables = await db.execute(
    sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
  );
  const tableRow = (
    Array.isArray(tables) ? tables[0] : (tables as { rows?: unknown[] }).rows?.[0]
  ) as { n: number } | undefined;
  console.log(`Tabel   : ${tableRow?.n ?? 0} di schema public`);
  console.log('\n✓ Koneksi berhasil.');
}

async function main() {
  switch (command) {
    case 'check': {
      await check();
      break;
    }
    case 'migrate': {
      await runMigrations();
      console.log('✓ Migrasi selesai.');
      break;
    }
    case 'seed': {
      const db = createDatabase();
      await runSeed(db);
      console.table(await seedSummary(db));
      console.log('✓ Seed pengembangan dimuat (bertanda DEV-, bukan data resmi YTS).');
      break;
    }
    case 'seed:clear': {
      const db = createDatabase();
      await clearSeed(db);
      console.log('✓ Seed pengembangan dihapus. Data non-DEV tidak disentuh.');
      break;
    }
    case 'status': {
      const db = createDatabase();
      console.table(await seedSummary(db));
      break;
    }
    default:
      console.error(
        'Perintah tidak dikenal. Gunakan: check | migrate | seed | seed:clear | status',
      );
      process.exit(1);
  }
  process.exit(0);
}

/**
 * Drizzle membungkus error driver ("Failed query: ..."), sehingga penyebab
 * sebenarnya hanya ada di rantai `cause`. Kumpulkan seluruh rantai supaya
 * diagnosa di bawah melihat pesan aslinya, bukan pembungkusnya.
 */
function messageChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join('\n');
}

main().catch((error: unknown) => {
  const message = messageChain(error);

  // Kegagalan jaringan yang paling sering terjadi, dengan penjelasan penyebabnya
  // supaya tidak ditebak-tebak.
  if (message.includes('Host not in allowlist')) {
    console.error(
      `Gagal: jaringan tempat perintah ini berjalan memblokir host Neon.\n${message}\n\n` +
        'Driver neon-http memakai HTTPS ke host api.<region>.aws.neon.tech. Jalankan perintah ini\n' +
        'dari jaringan yang mengizinkannya (mis. laptop Anda), atau tambahkan host tersebut ke\n' +
        'pengaturan egress.',
    );
  } else if (message.includes('ETIMEDOUT') || message.includes('ECONNREFUSED')) {
    console.error(
      `Gagal terhubung ke database: ${message}\n\n` +
        'Untuk Postgres lokal pastikan server berjalan. Untuk Neon, port 5432 kadang diblokir\n' +
        'jaringan — driver neon-http (dipakai otomatis untuk URL neon.tech) memakai HTTPS.',
    );
  } else {
    console.error(message);
  }
  process.exit(1);
});

/**
 * Koneksi database.
 *
 * Dua driver, satu API Drizzle:
 * - Neon (staging/production di Netlify) memakai driver HTTP serverless — tidak
 *   memegang koneksi TCP yang mahal di lingkungan function;
 * - Postgres lokal (pengembangan dan test) memakai postgres.js.
 *
 * Pilihan driver ditentukan dari DATABASE_URL, bukan flag terpisah, supaya tidak
 * ada kombinasi env yang saling bertentangan.
 */
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';

import { getServerEnv } from '@/server/env';
import * as schema from '@/server/db/schema';

/**
 * Tipe tunggal untuk seluruh kode aplikasi.
 *
 * Kalau tipe kedua driver dibiarkan sebagai union, setiap pemanggilan
 * `.returning()` dan sejenisnya gagal di-typecheck karena TypeScript tidak bisa
 * memilih overload dari union. Query builder kedua driver identik untuk yang
 * dipakai di sini (select/insert/update/delete/returning), jadi satu tipe konkret
 * dipakai sebagai kontrak bersama.
 *
 * Yang TIDAK identik: neon-http tidak mendukung transaksi interaktif
 * (`db.transaction(...)` dengan beberapa round-trip). Kalau nanti ada operasi yang
 * membutuhkannya — kemungkinan besar pada Fase 5 saat lifecycle approve/publish —
 * pakai driver WebSocket Neon untuk jalur itu, jangan asumsikan transaksi berjalan
 * hanya karena lolos di Postgres lokal.
 */
export type Database = PostgresJsDatabase<typeof schema>;

export function createDatabase(): Database {
  const { databaseUrl, isNeon } = getServerEnv();

  if (isNeon) {
    return drizzleNeon(neon(databaseUrl), {
      schema,
      casing: 'snake_case',
    }) as unknown as Database;
  }

  const client = postgres(databaseUrl, {
    max: 5,
    // Build statis membuat banyak query pendek; jangan tahan koneksi menganggur.
    idle_timeout: 20,
  });
  return drizzlePostgres(client, { schema, casing: 'snake_case' });
}

let instance: Database | null = null;

/** Koneksi bersama untuk proses ini. Dibuat saat pertama dipakai. */
export function getDb(): Database {
  if (!instance) instance = createDatabase();
  return instance;
}

/** Untuk test: paksa koneksi baru setelah DATABASE_URL berubah. */
export function resetDb(): void {
  instance = null;
}

export { schema };

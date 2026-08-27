/**
 * Koneksi database.
 *
 * Dua driver, satu API Drizzle:
 * - Neon (staging/production di Netlify) memakai driver WebSocket serverless;
 * - Postgres lokal (pengembangan dan test) memakai postgres.js.
 *
 * Pilihan driver ditentukan dari DATABASE_URL, bukan flag terpisah, supaya tidak
 * ada kombinasi env yang saling bertentangan.
 *
 * ## Kenapa WebSocket, bukan HTTP seperti Fase 2-4
 *
 * Driver `neon-http` lebih ringan dan cukup selama seluruh operasi hanya membaca.
 * Fase 5 mengubah itu: setiap perpindahan status HARUS tercatat di audit log
 * dalam satu transaksi dengan perubahan barisnya. Tanpa transaksi hanya ada dua
 * pilihan, dan keduanya merusak governance — mencatat lebih dulu bisa
 * meninggalkan audit atas perubahan yang ternyata gagal, sedangkan mengubah
 * lebih dulu bisa kehilangan catatannya sama sekali.
 *
 * `neon-http` tidak mendukung transaksi interaktif; `neon-serverless` mendukung.
 * Peringatan soal ini sudah ditulis di file ini sejak Fase 2, dan inilah fase
 * yang dimaksud.
 */
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
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
 * Sejak Fase 5 kedua driver mendukung `db.transaction(...)`, jadi kontrak ini
 * mencakup transaksi juga — itulah alasan Neon dipindah dari HTTP ke WebSocket.
 */
export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Driver Neon memerlukan implementasi WebSocket. Node 22+ sudah punya `WebSocket`
 * global, jadi tidak ada paket tambahan yang perlu di-bundle ke function; baris
 * ini hanya menunjukkannya kepada driver. Netlify menjalankan Node 22
 * (lihat netlify.toml), dan `engines` di package.json menjaga batas bawahnya.
 */
if (typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

export function createDatabase(): Database {
  const { databaseUrl, isNeon } = getServerEnv();

  if (isNeon) {
    // Pool, bukan koneksi tunggal: satu instance function melayani banyak request
    // berurutan, dan transaksi butuh koneksi yang dipegang selama blok berjalan.
    const pool = new Pool({ connectionString: databaseUrl, max: 3 });
    return drizzleNeon(pool, {
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

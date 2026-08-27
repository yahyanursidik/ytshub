/**
 * Menjalankan migrasi SQL yang sudah di-generate ke database di DATABASE_URL.
 * Dipakai oleh `npm run db:migrate` dan oleh setup test integrasi.
 */
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';

import { createDatabase } from '@/server/db/client';
import { getServerEnv } from '@/server/env';

const MIGRATIONS_FOLDER = './drizzle';

export async function runMigrations(): Promise<void> {
  const db = createDatabase();
  const { isNeon } = getServerEnv();

  // Migrator tiap driver punya tipe database sendiri; Database di client.ts adalah
  // satu tipe konkret, jadi konversinya dilakukan di sini secara sadar.
  if (isNeon) {
    await migrateNeon(db as unknown as Parameters<typeof migrateNeon>[0], {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    return;
  }

  await migratePostgres(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

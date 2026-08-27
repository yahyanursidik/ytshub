/**
 * CLI database: migrate, seed, clear, status.
 * Dijalankan lewat `npm run db:*`. Sengaja dipisah dari kode aplikasi.
 */
import 'dotenv/config';

import { createDatabase } from '../src/server/db/client.ts';
import { runMigrations } from '../src/server/db/migrate.ts';
import { clearSeed, runSeed, seedSummary } from '../src/server/db/seed.ts';

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'migrate': {
      await runMigrations();
      console.log('✓ Migrasi selesai.');
      break;
    }
    case 'seed': {
      const db = createDatabase();
      await runSeed(db);
      const summary = await seedSummary(db);
      console.log('✓ Seed pengembangan dimuat (bertanda DEV-, bukan data resmi YTS):');
      console.table(summary);
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
      console.error('Perintah tidak dikenal. Gunakan: migrate | seed | seed:clear | status');
      process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

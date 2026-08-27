import { defineConfig } from 'drizzle-kit';

/**
 * Migrasi harus reproducible (11-AI-CODING-INSTRUCTIONS.md §Step 6):
 * file SQL di-generate dan di-commit, bukan `push` langsung ke database.
 */
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});

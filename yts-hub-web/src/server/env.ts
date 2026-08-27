/**
 * Validasi environment — 10-DEVELOPMENT-PLAN.md §3 ("environment validation").
 * Gagal cepat dengan pesan jelas, bukan `undefined` yang menyebar diam-diam.
 *
 * File ini hanya boleh diimpor dari kode server. Jangan diimpor dari komponen
 * yang dikirim ke klien — isinya rahasia.
 */

export interface ServerEnv {
  databaseUrl: string;
  /** true bila DATABASE_URL menunjuk ke Neon; menentukan driver yang dipakai. */
  isNeon: boolean;
}

let cached: ServerEnv | null = null;

function read(name: string): string | undefined {
  // Astro/Vite mengekspos env lewat import.meta.env. Di luar Astro (script seed,
  // drizzle-kit, test) import.meta.env tidak ada sama sekali — bukan sekadar kosong —
  // jadi aksesnya harus dijaga sebelum jatuh ke process.env.
  const meta = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const fromAstro = meta?.[name];
  const fromNode =
    typeof process !== 'undefined' && process.env
      ? (process.env as Record<string, string | undefined>)[name]
      : undefined;
  const value = fromAstro ?? fromNode;
  return value && value.length > 0 ? value : undefined;
}

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const databaseUrl = read('DATABASE_URL');

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi connection string ' +
        'PostgreSQL (Neon untuk staging/production, Postgres lokal untuk pengembangan).',
    );
  }

  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DATABASE_URL harus berupa connection string PostgreSQL (postgres://...).');
  }

  cached = { databaseUrl, isNeon: databaseUrl.includes('neon.tech') };
  return cached;
}

/** Untuk test: buang cache setelah mengganti env. */
export function resetServerEnv(): void {
  cached = null;
}

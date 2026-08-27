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
  /**
   * Kunci penanda tangan sesi & cookie admin (Fase 5).
   *
   * BOLEH null, dan itu disengaja. Situs publik tidak membutuhkannya sama
   * sekali: 32 halaman statis hanya perlu DATABASE_URL. Menjadikannya wajib di
   * sini berarti membangun halaman FAQ menuntut kunci sesi admin — dan itulah
   * yang sempat terjadi, membuat deploy gagal seluruhnya padahal yang belum
   * disiapkan hanya bagian adminnya.
   *
   * Yang menuntutnya adalah `getAuth()`, dan ia melempar pesan yang jelas bila
   * kosong. Konsekuensinya: situs publik tetap terbit, /admin yang gagal — dan
   * itu urutan kegagalan yang benar.
   */
  authSecret: string | null;
  /** Origin publik, dipakai better-auth untuk menyusun URL dan memvalidasi asal. */
  authBaseUrl: string;
  /** true bila origin publik masih memakai default pengembangan. */
  siteUrlIsDefault: boolean;
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

  const authSecret = read('BETTER_AUTH_SECRET') ?? null;

  // Nilai yang ADA tetapi terlalu pendek tetap ditolak keras. 32 byte acak
  // menghasilkan 44 karakter base64; batas ini menangkap kata sandi yang
  // diketik manual — kesalahan yang jauh lebih berbahaya daripada tidak diisi,
  // karena admin akan berjalan dan terlihat baik-baik saja.
  if (authSecret !== null && authSecret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET terlalu pendek (minimal 32 karakter). Gunakan nilai acak, ' +
        'bukan kata sandi yang diketik manual:\n' +
        '  node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"',
    );
  }

  const siteUrl = read('PUBLIC_SITE_URL');

  cached = {
    databaseUrl,
    isNeon: databaseUrl.includes('neon.tech'),
    authSecret,
    // Localhost hanya default pengembangan. Di production variabel ini wajib
    // diisi origin sungguhan: ia mengikat cookie sesi ke domain yang benar DAN
    // menjadi dasar canonical URL di read API registry.
    authBaseUrl: siteUrl ?? 'http://localhost:4321',
    siteUrlIsDefault: siteUrl === undefined,
  };
  return cached;
}

/** Untuk test: buang cache setelah mengganti env. */
export function resetServerEnv(): void {
  cached = null;
}

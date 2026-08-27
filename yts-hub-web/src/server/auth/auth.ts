/**
 * Autentikasi admin — 10-DEVELOPMENT-PLAN.md §8.
 *
 * ## Kenapa memakai pustaka, bukan menulis sendiri
 *
 * §1 dokumen yang sama meminta "pilih satu solusi yang mendukung RBAC dengan
 * baik". Bagian yang diserahkan ke better-auth sengaja sempit: hashing kata
 * sandi, pembuatan & rotasi token sesi, dan penanganan cookie. Itu bagian kecil
 * tapi paling mudah salah, dan salahnya tidak terlihat sampai terlambat.
 *
 * Yang TIDAK diserahkan ke pustaka mana pun adalah otorisasi — lihat
 * src/server/auth/authorize.ts. Izin di YTS Hub bergantung pada unit mana yang
 * memiliki konten, bukan sekadar peran global, dan aturan itu milik domain ini.
 *
 * ## Yang sengaja tidak diaktifkan
 *
 * - Pendaftaran mandiri (`disableSignUp`). Akun admin dibuat oleh admin lewat
 *   `npm run admin:user`, bukan oleh siapa pun yang menemukan halaman login.
 * - Reset kata sandi lewat email — belum ada infrastruktur surat. Sampai ada,
 *   admin yang menyetel ulang kata sandi lewat CLI.
 * - Verifikasi email. Akun dibuat oleh admin yang sudah tahu alamatnya.
 * - MFA. Layak untuk fase berikutnya; disebut di README supaya tidak terlupa.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { getDb } from '@/server/db/client';
import { getServerEnv } from '@/server/env';
import { accounts, sessions, users, verifications } from '@/server/db/schema';

/**
 * Membangun konfigurasi. Dipisah dari `getAuth()` supaya tipe kembaliannya bisa
 * disimpulkan utuh — `ReturnType<typeof betterAuth>` yang generik kehilangan
 * bentuk konkret opsi kita dan membuat pemanggilnya gagal di-typecheck.
 */
function build() {
  const env = getServerEnv();

  return betterAuth({
    secret: env.authSecret,
    baseURL: env.authBaseUrl,
    basePath: '/api/auth',

    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      // Nama tabel kami jamak; better-auth memakai tunggal. Pemetaan eksplisit
      // di sini supaya tidak ada tabel bayangan yang dibuat diam-diam.
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      // 12 karakter, bukan 8: akun ini bisa menerbitkan informasi resmi yayasan.
      minPasswordLength: 12,
      requireEmailVerification: false,
    },

    session: {
      // Tujuh hari, dengan perpanjangan otomatis bila dipakai dalam 24 jam
      // terakhir. Editor bekerja berhari-hari pada satu batch konten; sesi yang
      // putus di tengah penyuntingan mendorong orang memilih kata sandi lemah
      // agar cepat diketik ulang.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },

    advanced: {
      // Cookie sesi tidak boleh terbaca JavaScript, tidak ikut permintaan lintas
      // situs, dan hanya lewat HTTPS di production.
      useSecureCookies: env.authBaseUrl.startsWith('https://'),
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
      },
    },

    user: {
      additionalFields: {
        // Dideklarasikan agar terbawa ke objek sesi; nilainya diperiksa saat masuk.
        isActive: { type: 'boolean', input: false, defaultValue: true },
      },
    },
  });
}

type Auth = ReturnType<typeof build>;

let instance: Auth | null = null;

/**
 * Dibuat saat pertama dipakai, bukan saat modul dimuat.
 *
 * Modul ini ikut ter-import oleh middleware, dan middleware ikut berjalan saat
 * build me-render halaman statis. Kalau konfigurasi dibangun di tingkat modul,
 * `getServerEnv()` akan berjalan — dan gagal menuntut BETTER_AUTH_SECRET —
 * bahkan ketika yang dikerjakan hanya mencetak halaman FAQ.
 */
export function getAuth(): Auth {
  instance ??= build();
  return instance;
}

/** Untuk test: paksa konfigurasi baru setelah environment berubah. */
export function resetAuth(): void {
  instance = null;
}

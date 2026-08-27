/**
 * Penjaga route admin — 06-CONTENT-MODEL-AND-CMS.md §13.
 *
 * "Server-side authorization harus menjadi sumber kebenaran. Jangan hanya hide
 * komponen di frontend." Middleware inilah lapisan pertamanya: tidak ada halaman
 * di bawah /admin yang bisa dirender tanpa melewati berkas ini, sehingga sebuah
 * halaman baru tidak bisa lupa memeriksa sesi — kelalaian yang paling sering
 * terjadi justru saat menambah halaman, bukan saat menulisnya pertama kali.
 *
 * Lapisan kedua ada di setiap aksi (src/server/admin/governance.ts). Middleware
 * hanya menjawab "sudah masuk dan punya peran?"; pertanyaan "boleh menyentuh
 * konten unit INI?" hanya bisa dijawab setelah kontennya diketahui.
 */
import { defineMiddleware } from 'astro:middleware';

import { getActor } from '@/server/auth/session';
import { hasAnyRole } from '@/server/auth/roles';

/** Halaman admin yang boleh dibuka tanpa sesi. */
const PUBLIC_ADMIN_PATHS = ['/admin/masuk'];

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // Keluar lebih awal untuk seluruh halaman publik. Penting bukan hanya demi
  // kecepatan: middleware ini ikut berjalan saat build me-render 30 halaman
  // statis, dan memuat konfigurasi autentikasi di sana akan menuntut
  // BETTER_AUTH_SECRET hanya untuk mencetak halaman FAQ.
  if (!path.startsWith('/admin')) return next();

  if (PUBLIC_ADMIN_PATHS.includes(path)) return next();

  const actor = await getActor(context.request);

  if (!actor) {
    // Membawa tujuan semula agar setelah masuk pengguna kembali ke halaman yang
    // ia minta, bukan selalu ke dasbor.
    const target = encodeURIComponent(path + context.url.search);
    return context.redirect(`/admin/masuk?lanjut=${target}`, 302);
  }

  if (!hasAnyRole(actor)) {
    // Akun sah tetapi belum diberi peran apa pun. Dibedakan dari "belum masuk":
    // mengirimnya kembali ke halaman masuk akan membuat orang mencoba kata
    // sandi berulang kali untuk masalah yang bukan kata sandi.
    return context.redirect('/admin/tanpa-peran', 302);
  }

  // Diteruskan ke halaman lewat Astro.locals supaya tidak ada halaman yang
  // perlu membaca cookie sendiri.
  context.locals.actor = actor;

  return next();
});

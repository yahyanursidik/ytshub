/**
 * Tipe `Astro.locals`.
 *
 * `actor` diisi middleware untuk seluruh halaman /admin yang membutuhkan sesi,
 * dan TIDAK PERNAH ada di halaman publik. Karena itu tipenya opsional: halaman
 * admin yang lupa memeriksa keberadaannya akan gagal saat typecheck, bukan saat
 * dibuka pengunjung.
 */
declare namespace App {
  interface Locals {
    actor?: import('@/server/auth/roles').Actor;
  }
}

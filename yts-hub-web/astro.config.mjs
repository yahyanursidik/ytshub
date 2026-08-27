// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';

/**
 * YTS Hub — public web.
 * HTML-first: React dipakai hanya sebagai island untuk bagian interaktif
 * (lihat 09-ACCESSIBILITY-PERFORMANCE-SEO.md §5).
 *
 * ## Kenapa ada adapter, padahal situsnya statis
 *
 * `output: 'static'` tetap default — 30+ halaman direktori dan FAQ seluruhnya
 * di-prerender saat build, persis seperti Fase 1-3, dan tidak satu pun berubah
 * menjadi function.
 *
 * Yang tidak bisa statis hanyalah pencarian. Halaman hasil bergantung pada
 * `?q=` yang baru ada saat pengunjung mengetik, dan 07-SEARCH-AND-FAQ.md §5
 * meminta pencarian dijalankan PostgreSQL, bukan disalin lebih dulu ke indeks
 * JSON di klien. Dua kebutuhan lain juga menuntut sisi server: §11 mencatat
 * query yang tidak menemukan apa pun, dan §10 menerima feedback FAQ — keduanya
 * operasi tulis, dan HTML statis tidak punya tempat untuk menaruhnya.
 *
 * Route yang berjalan saat request menandai dirinya dengan `export const
 * prerender = false`; seluruhnya ada di src/pages/cari.astro dan src/pages/api/.
 */
/**
 * Origin publik situs.
 *
 * Dibaca dari environment, BUKAN ditulis tetap di berkas ini. Nilai ini menjadi
 * dasar canonical URL, Open Graph, dan structured data setiap halaman; nilai
 * yang salah membuat seluruh situs mengaku beralamat di tempat lain, dan
 * kesalahan itu tidak terlihat sampai mesin pencari sudah mengindeksnya.
 *
 * Netlify menyediakan `URL` (alamat produksi) dan `DEPLOY_PRIME_URL` (alamat
 * deploy preview) secara otomatis, jadi keduanya dipakai sebagai cadangan bila
 * PUBLIC_SITE_URL belum diisi — lebih baik alamat Netlify yang benar daripada
 * placeholder yang pasti salah.
 */
const SITE_FALLBACK = 'https://hub.example.org';
const site =
  process.env.PUBLIC_SITE_URL ??
  process.env.DEPLOY_PRIME_URL ??
  process.env.URL ??
  SITE_FALLBACK;

/**
 * Peringatan konfigurasi saat build.
 *
 * Bukan error: keduanya tidak menghalangi situs publik terbit, dan menghentikan
 * deploy karena bagian admin belum disiapkan pernah membuat seluruh rilis gagal
 * padahal halaman untuk jamaah sudah siap. Yang perlu adalah peringatan yang
 * tidak bisa dilewatkan begitu saja saat membaca log build.
 */
function konfigurasiWarning() {
  return {
    name: 'yts-config-warning',
    hooks: {
      'astro:build:start': () => {
        const pesan = [];

        if (site === SITE_FALLBACK) {
          pesan.push(
            'PUBLIC_SITE_URL belum diisi dan Netlify tidak menyediakan URL.\n' +
              `   Canonical URL dan Open Graph memakai contoh: ${SITE_FALLBACK}\n` +
              '   Isi PUBLIC_SITE_URL dengan domain resmi sebelum situs diindeks.',
          );
        }

        if (!process.env.BETTER_AUTH_SECRET) {
          pesan.push(
            'BETTER_AUTH_SECRET belum diisi.\n' +
              '   Situs publik tetap terbit; /admin akan menolak jalan sampai kunci ini ada.\n' +
              '   Hasilkan: node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"',
          );
        }

        for (const item of pesan) console.warn(`\n⚠  ${item}\n`);
      },
    },
  };
}

export default defineConfig({
  site,
  adapter: netlify({
    /**
     * Mematikan emulasi Netlify saat `astro dev`.
     *
     * Bukan preferensi, tapi keharusan pada layout repo ini. Emulator membaca
     * netlify.toml dan menghitung `base = "yts-hub-web"` relatif terhadap
     * direktori kerja — sedangkan `astro dev` dijalankan DARI dalam yts-hub-web.
     * Jalurnya menjadi yts-hub-web/yts-hub-web, direktori itu tidak ada, dan dev
     * server mati sebelum siap tanpa pesan yang terlihat di terminal (jejaknya
     * hanya tertinggal di .astro/dev.log).
     *
     * Yang hilang tidak dipakai proyek ini: Image CDN (belum ada gambar yang
     * dioptimasi), pemuatan environment variable dari akun Netlify (kami memakai
     * .env), dan emulasi edge function (tidak ada). Route /cari dan /api tetap
     * berjalan penuh di dev — itu Astro biasa, bukan fitur Netlify.
     */
    devFeatures: false,
  }),
  integrations: [react(), konfigurasiWarning()],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    inlineStylesheets: 'auto',
  },
});

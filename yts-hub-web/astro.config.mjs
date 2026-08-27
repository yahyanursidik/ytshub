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
export default defineConfig({
  site: 'https://hub.example.org', // ganti saat domain resmi YTS ditetapkan
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
  integrations: [react()],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    inlineStylesheets: 'auto',
  },
});

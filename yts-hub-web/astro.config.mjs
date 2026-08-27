// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

/**
 * YTS Hub — public web.
 * HTML-first: React dipakai hanya sebagai island untuk bagian interaktif
 * (lihat 09-ACCESSIBILITY-PERFORMANCE-SEO.md §5).
 */
export default defineConfig({
  site: 'https://hub.example.org', // ganti saat domain resmi YTS ditetapkan
  integrations: [react()],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    inlineStylesheets: 'auto',
  },
});

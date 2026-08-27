/**
 * Autocomplete pencarian — 07-SEARCH-AND-FAQ.md §6.
 *
 * Berjalan saat request karena isinya bergantung pada apa yang sedang diketik.
 * Tidak mencatat apa pun: yang layak dicatat adalah pencarian yang benar-benar
 * dijalankan (§11), bukan setiap ketukan tombol menuju ke sana.
 */
import type { APIRoute } from 'astro';

import { suggest } from '@/server/content/search-queries';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q') ?? '';

  try {
    const suggestions = await suggest(query);
    return new Response(JSON.stringify(suggestions), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Saran berubah hanya saat konten atau query populer berubah. Cache
        // pendek di CDN menahan ketikan cepat tanpa membuat daftar basi.
        'cache-control': 'public, max-age=0, s-maxage=60',
      },
    });
  } catch (error) {
    console.error('[search] saran gagal:', error);
    // Daftar kosong, bukan 500: kolom pencarian di klien memperlakukan kegagalan
    // sebagai "tidak ada saran" dan tetap bisa dipakai.
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
};

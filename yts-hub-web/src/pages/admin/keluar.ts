/**
 * Keluar dari admin.
 *
 * POST, bukan GET. Tautan keluar berbentuk GET bisa dipicu oleh apa pun yang
 * memuat URL — prefetch peramban, pemindai tautan, atau gambar di halaman lain —
 * sehingga pengguna terlempar keluar tanpa pernah menekan apa pun.
 */
import type { APIRoute } from 'astro';

import { getAuth } from '@/server/auth/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = new Headers({ Location: '/admin/masuk' });

  try {
    // Menghapus baris sesinya di database, bukan sekadar cookie di peramban:
    // cookie yang disalin sebelum keluar tetap berlaku kalau barisnya dibiarkan.
    const response = await getAuth().api.signOut({ headers: request.headers, asResponse: true });
    for (const cookie of response.headers.getSetCookie()) headers.append('set-cookie', cookie);
  } catch (error) {
    // Kegagalan di sini tidak boleh menahan orang di dalam. Cookie tetap
    // dibersihkan lewat jawaban better-auth bila ada, dan pengguna tetap
    // diarahkan ke halaman masuk.
    console.error('[auth] gagal mengakhiri sesi:', error);
  }

  return new Response(null, { status: 303, headers });
};

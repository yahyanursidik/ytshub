/**
 * Pencatat kunjungan halaman dan klik keluar —
 * 09-ACCESSIBILITY-PERFORMANCE-SEO.md §8.
 *
 * Dipanggil `navigator.sendBeacon` dari klien, bukan dicatat saat halaman
 * dirender di server. Alasannya: 30 halaman publik dibuat statis dan disajikan
 * CDN — server tidak pernah tahu halaman itu dibuka. Mencatatnya di server
 * berarti hanya menghitung yang lolos cache, dan angkanya akan salah dengan cara
 * yang tidak kelihatan salah.
 *
 * Konsekuensinya jujur: pengunjung tanpa JavaScript tidak terhitung, dan
 * pemblokir iklan bisa menahannya. Angka di sini adalah batas bawah, bukan
 * jumlah sebenarnya — dan halaman admin mengatakannya.
 */
import type { APIRoute } from 'astro';

import { recordOutboundClick, recordPageView } from '@/server/observability/usage';

export const prerender = false;

const PATH = /^\/[\w\-./]{0,199}$/;

export const POST: APIRoute = async ({ request }) => {
  // 204 di setiap jalur keluar: pengirimnya beacon yang tidak membaca jawaban,
  // dan status error hanya menimbulkan bunyi di log tanpa ada yang menindak.
  const noContent = new Response(null, { status: 204 });

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) return noContent;

    const { kind, path, target } = body as Record<string, unknown>;

    if (typeof path !== 'string' || !PATH.test(path)) return noContent;

    if (kind === 'view') {
      await recordPageView(path);
      return noContent;
    }

    if (kind === 'outbound') {
      if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) return noContent;
      await recordOutboundClick(path, target);
      return noContent;
    }
  } catch {
    // Payload rusak. Tidak dicatat sebagai kesalahan sistem: beacon bisa datang
    // dari mana saja, dan payload aneh bukan pertanda ada yang salah di sini.
  }

  return noContent;
};

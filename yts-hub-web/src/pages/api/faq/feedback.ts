/**
 * Feedback kebermanfaatan FAQ — 07-SEARCH-AND-FAQ.md §10.
 *
 * Berbeda dari endpoint klik: di sini pengunjung MENEKAN TOMBOL dan menunggu
 * tanggapan, jadi kegagalan harus dilaporkan apa adanya, bukan ditelan diam-diam.
 *
 * ## Yang belum dilakukan, dan disebut terus terang
 *
 * Endpoint ini tanpa autentikasi dan tanpa pembatasan laju — satu orang bisa
 * menekan "Ya" berkali-kali. Untuk MVP itu diterima: yang terpengaruh hanyalah
 * urutan FAQ, bukan isi jawabannya, dan `faq_feedback` menyimpan setiap kejadian
 * sehingga angka yang menyimpang bisa ditelusuri lalu direkonsiliasi. Pembatasan
 * laju masuk bersama governance pada Fase 5 (10-DEVELOPMENT-PLAN §8), tempat
 * server-side authorization memang dikerjakan.
 */
import type { APIRoute } from 'astro';

import {
  attachFaqFeedbackReason,
  recordFaqFeedback,
  type FaqFeedbackReason,
} from '@/server/content/search-analytics';

export const prerender = false;

const REASONS: FaqFeedbackReason[] = [
  'kurang-jelas',
  'kurang-lengkap',
  'sudah-tidak-berlaku',
  'bukan-jawaban-yang-dicari',
];

const SLUG = /^[a-z0-9-]{1,120}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Format permintaan tidak dikenali.' }, 400);
  }

  if (typeof body !== 'object' || body === null) {
    return json({ error: 'Format permintaan tidak dikenali.' }, 400);
  }

  const { slug, helpful, reason, feedbackId } = body as Record<string, unknown>;

  /**
   * Permintaan kedua: alasan untuk jawaban "Belum" yang sudah tercatat.
   * Dibedakan dari permintaan pertama supaya penghitung tidak naik dua kali
   * untuk satu orang — lihat attachFaqFeedbackReason().
   */
  if (feedbackId !== undefined) {
    if (typeof feedbackId !== 'string' || !UUID.test(feedbackId)) {
      return json({ error: 'Masukan tidak dikenali.' }, 400);
    }
    if (typeof reason !== 'string' || !REASONS.includes(reason as FaqFeedbackReason)) {
      return json({ error: 'Alasan tidak dikenali.' }, 400);
    }

    try {
      const ok = await attachFaqFeedbackReason(feedbackId, reason as FaqFeedbackReason);
      if (!ok) return json({ error: 'Masukan tidak dikenali.' }, 404);
      return json({ ok: true }, 200);
    } catch (error) {
      console.error('[faq] gagal menyimpan alasan:', error);
      return json({ error: 'Alasan gagal disimpan. Coba lagi sebentar lagi.' }, 500);
    }
  }

  if (typeof slug !== 'string' || !SLUG.test(slug)) {
    return json({ error: 'FAQ tidak dikenali.' }, 400);
  }
  if (typeof helpful !== 'boolean') {
    return json({ error: 'Jawaban harus "Ya" atau "Belum".' }, 400);
  }

  let parsedReason: FaqFeedbackReason | null = null;
  if (reason !== undefined && reason !== null) {
    if (typeof reason !== 'string' || !REASONS.includes(reason as FaqFeedbackReason)) {
      return json({ error: 'Alasan tidak dikenali.' }, 400);
    }
    parsedReason = reason as FaqFeedbackReason;
  }

  try {
    const result = await recordFaqFeedback(slug, helpful, parsedReason);
    // null berarti slug-nya tidak menunjuk FAQ publik yang terbit. Dijawab 404
    // dan bukan 400 karena bentuk permintaannya benar; yang tidak ada isinya.
    if (!result) return json({ error: 'FAQ tidak ditemukan.' }, 404);
    return json(result, 200);
  } catch (error) {
    console.error('[faq] gagal menyimpan feedback:', error);
    return json({ error: 'Masukan gagal disimpan. Coba lagi sebentar lagi.' }, 500);
  }
};

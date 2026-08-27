/**
 * Read API publik untuk core registry — 08-INTEGRATION-AND-ROUTING.md §2 Level 2.
 *
 *   GET /api/registry/unit.json
 *   GET /api/registry/layanan.json
 *   GET /api/registry/program.json
 *   GET /api/registry/event.json
 *   GET /api/registry/aplikasi.json
 *
 * Hanya baca, hanya konten terbit & publik, dan bentuk jawabannya tetap — tidak
 * ada parameter yang bisa memperluas kolom yang dikembalikan.
 *
 * ## Pembatasan laju (§7)
 *
 * Jawaban dibuat sangat mudah di-cache (`s-maxage`), sehingga permintaan
 * berulang dilayani CDN Netlify dan tidak pernah menyentuh function ini. Itulah
 * pertahanan utamanya, dan untuk data publik yang jarang berubah itu memang
 * jawaban yang tepat.
 *
 * Pembatas di bawah adalah lapisan kedua, dan batasnya perlu disebut jujur:
 * hitungannya ada di memori satu instance function. Beberapa instance yang
 * berjalan bersamaan punya hitungan masing-masing, dan instance yang baru
 * dimulai mulai dari nol. Ia menahan skrip ceroboh, bukan penyalahgunaan yang
 * disengaja. Bila itu terjadi, tempat memperbaikinya adalah pembatasan laju di
 * tingkat Netlify — bukan menambah kerumitan di sini.
 */
import type { APIRoute } from 'astro';

import { getServerEnv } from '@/server/env';
import { reportError } from '@/server/observability/errors';
import {
  readRegistry,
  REGISTRY_RESOURCES,
  type RegistryResource,
} from '@/server/integrations/registry';

export const prerender = false;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

const hits = new Map<string, { count: number; resetAt: number }>();

function overLimit(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // Membuang entri kedaluwarsa saat lewat, supaya Map tidak tumbuh tanpa batas
    // pada instance yang berumur panjang.
    if (hits.size > 1000) {
      for (const [existing, value] of hits) if (now >= value.resetAt) hits.delete(existing);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

export const GET: APIRoute = async ({ params, clientAddress }) => {
  const requested = (params.resource ?? '').replace(/\.json$/, '');

  if (!REGISTRY_RESOURCES.includes(requested as RegistryResource)) {
    return json(
      {
        error: 'Resource tidak dikenal.',
        available: REGISTRY_RESOURCES.map((name) => `/api/registry/${name}.json`),
      },
      404,
    );
  }

  // clientAddress bisa gagal di lingkungan tertentu; pembatas ini pelengkap,
  // jadi kegagalannya tidak boleh menghalangi permintaan yang sah.
  let key = 'tanpa-alamat';
  try {
    key = clientAddress ?? 'tanpa-alamat';
  } catch {
    /* diabaikan dengan sengaja — lihat catatan di atas */
  }

  if (overLimit(key)) {
    return json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' }, 429, {
      'retry-after': String(Math.ceil(WINDOW_MS / 1000)),
    });
  }

  try {
    const env = getServerEnv();
    const data = await readRegistry(requested as RegistryResource, env.authBaseUrl);

    return json(
      {
        resource: requested,
        count: data.length,
        generatedAt: new Date().toISOString(),
        /**
         * Disebut di badan jawaban, bukan hanya di dokumentasi: sistem yang
         * memakai API ini perlu tahu bahwa `id` dan `code` adalah referensi
         * yang boleh disimpan, sedangkan sisanya bisa berubah (§3).
         */
        canonicalFields: ['id', 'code'],
        data,
      },
      200,
      {
        // Lima menit di CDN, dan boleh menyajikan versi lama satu jam sambil
        // menyegarkan di latar. Registry berubah dalam hitungan hari; sistem
        // pemanggil lebih dirugikan oleh kegagalan daripada oleh data lima
        // menit yang lalu.
        'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
        // Registry adalah data publik yang memang untuk dibaca sistem lain.
        'access-control-allow-origin': '*',
        vary: 'accept-encoding',
      },
    );
  } catch (error) {
    await reportError(error, {
      source: 'registry',
      path: '/api/registry',
      context: { resource: requested },
    });
    return json({ error: 'Registry sedang tidak bisa dibaca.' }, 503);
  }
};

/** Preflight untuk pemanggil dari peramban. Hanya GET yang diizinkan. */
export const OPTIONS: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-max-age': '86400',
    },
  });

/**
 * Mencatat hasil mana yang dibuka dari sebuah pencarian — 07-SEARCH-AND-FAQ.md §11
 * ("click-through result", "search-to-service conversion").
 *
 * Dipanggil lewat `navigator.sendBeacon` saat pengunjung menekan hasil, sehingga
 * pencatatan tidak menunda perpindahan halaman. Konsekuensinya: jawaban dari
 * endpoint ini tidak pernah dibaca siapa pun, dan kegagalannya tidak boleh
 * mengganggu apa pun.
 *
 * Seluruh input divalidasi ketat di sini. Ini batas sistem — payload-nya datang
 * dari luar dan tidak boleh dipercaya hanya karena halaman kita yang mengirimnya.
 */
import type { APIRoute } from 'astro';

import { recordResultClick } from '@/server/content/search-analytics';
import type { SearchEntityType } from '@/server/content/search-queries';

export const prerender = false;

const ENTITIES: SearchEntityType[] = ['faq', 'service', 'program', 'unit', 'event', 'application'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,120}$/;

export const POST: APIRoute = async ({ request }) => {
  // 204 di setiap jalur keluar, termasuk saat payload ditolak: pengirimnya adalah
  // beacon yang tidak membaca jawaban, dan status error di sini hanya akan
  // menimbulkan bunyi di log tanpa ada yang bisa menindaklanjutinya.
  const noContent = new Response(null, { status: 204 });

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) return noContent;

    const { searchId, entity, slug, rank } = body as Record<string, unknown>;

    if (typeof searchId !== 'string' || !UUID.test(searchId)) return noContent;
    if (typeof entity !== 'string' || !ENTITIES.includes(entity as SearchEntityType)) {
      return noContent;
    }
    if (typeof slug !== 'string' || !SLUG.test(slug)) return noContent;
    if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 1 || rank > 100) {
      return noContent;
    }

    await recordResultClick(searchId, entity as SearchEntityType, slug, rank);
  } catch (error) {
    console.error('[analytics] payload klik ditolak:', error);
  }

  return noContent;
};

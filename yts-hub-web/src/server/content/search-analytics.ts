/**
 * Analytics pencarian dan feedback FAQ — 07-SEARCH-AND-FAQ.md §10 & §11.
 *
 * ## Apa yang TIDAK dicatat
 *
 * §11 meminta "track tanpa menyimpan data sensitif yang tidak dibutuhkan". Karena
 * itu tidak ada IP, user agent, session id, atau pengenal apa pun di sini — bukan
 * dihapus belakangan, melainkan tidak pernah diminta. Konsekuensinya disengaja:
 * laporan bisa menjawab "kata apa yang dicari orang dan mana yang tidak menemukan
 * apa pun", tetapi tidak bisa menjawab "siapa yang mencarinya". Pertanyaan kedua
 * memang bukan kebutuhan produk ini.
 *
 * ## Kenapa kegagalan pencatatan tidak pernah dilempar ke atas
 *
 * Analytics adalah efek samping, bukan tujuan kunjungan. Kalau `INSERT` gagal
 * — database sibuk, function timeout, koneksi putus — pengunjung tetap harus
 * mendapat hasil pencariannya. Setiap fungsi di file ini menelan errornya dan
 * mencatat ke log server. Satu-satunya pengecualian adalah feedback FAQ: di sana
 * pengguna menekan tombol dan berhak tahu bahwa masukannya gagal terkirim.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { faqFeedback, faqs, searchQueries } from '@/server/db/schema';
import { normalizeQuery } from '@/server/content/search-terms';
import type { SearchEntityType } from '@/server/content/search-queries';

export type FaqFeedbackReason =
  | 'kurang-jelas'
  | 'kurang-lengkap'
  | 'sudah-tidak-berlaku'
  | 'bukan-jawaban-yang-dicari';

export const faqFeedbackReasons: { value: FaqFeedbackReason; label: string }[] = [
  { value: 'kurang-jelas', label: 'Kurang jelas' },
  { value: 'kurang-lengkap', label: 'Kurang lengkap' },
  { value: 'sudah-tidak-berlaku', label: 'Sudah tidak berlaku' },
  { value: 'bukan-jawaban-yang-dicari', label: 'Bukan jawaban yang saya cari' },
];

/**
 * Mencatat satu pencarian. Mengembalikan id barisnya supaya halaman hasil bisa
 * menghubungkan klik berikutnya ke pencarian ini (§11 "click-through result").
 * Mengembalikan null bila pencatatan gagal — pemanggil cukup melewatkan fitur klik.
 */
export async function recordSearch(raw: string, resultCount: number): Promise<string | null> {
  const normalized = normalizeQuery(raw);
  if (normalized.length === 0) return null;

  try {
    const [row] = await getDb()
      .insert(searchQueries)
      .values({ queryRaw: raw.slice(0, 200), queryNormalized: normalized, resultCount })
      .returning({ id: searchQueries.id });
    return row?.id ?? null;
  } catch (error) {
    console.error('[analytics] gagal mencatat pencarian:', error);
    return null;
  }
}

/**
 * Menandai hasil mana yang dibuka dari sebuah pencarian.
 *
 * `rank` adalah posisi hasil pada halaman (1 = teratas). Itulah bahan untuk
 * menilai apakah peringkat sudah benar: klik yang selalu terjadi di posisi 5
 * berarti ekspresi skor perlu ditinjau, bukan penggunanya yang keliru.
 */
export async function recordResultClick(
  searchId: string,
  entity: SearchEntityType,
  slug: string,
  rank: number,
): Promise<void> {
  try {
    await getDb()
      .update(searchQueries)
      .set({ clickedEntity: entity, clickedSlug: slug, clickedRank: rank })
      .where(eq(searchQueries.id, searchId));
  } catch (error) {
    console.error('[analytics] gagal mencatat klik hasil:', error);
  }
}

/**
 * Query populer untuk saran di bawah kolom pencarian — §6 dan §11.
 *
 * Hanya query yang pernah menghasilkan sesuatu, supaya saran tidak pernah
 * menuntun ke halaman kosong. Ambang minimum mencegah satu orang yang mengetik
 * berulang kali membentuk "query populer" sendirian.
 */
export async function getTopQueries(limit = 4, minCount = 3): Promise<string[]> {
  try {
    const rows = await getDb()
      .select({
        query: searchQueries.queryNormalized,
        n: sql<number>`count(*)::int`,
      })
      .from(searchQueries)
      .where(sql`${searchQueries.resultCount} > 0`)
      .groupBy(searchQueries.queryNormalized)
      .having(sql`count(*) >= ${minCount}`)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows.map((row) => row.query);
  } catch (error) {
    console.error('[analytics] gagal membaca query populer:', error);
    return [];
  }
}

/**
 * Query yang tidak menemukan apa pun — daftar kerja untuk redaksi (§7, §11).
 * Belum dipakai halaman publik; dipakai laporan content gap pada Fase 5.
 */
export async function getZeroResultQueries(limit = 20) {
  return getDb()
    .select({
      query: searchQueries.queryNormalized,
      n: sql<number>`count(*)::int`,
      lastAt: sql<Date>`max(${searchQueries.createdAt})`,
    })
    .from(searchQueries)
    .where(eq(searchQueries.resultCount, 0))
    .groupBy(searchQueries.queryNormalized)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export interface FaqFeedbackResult {
  ok: boolean;
  /** Id catatan yang baru dibuat — dipakai untuk melengkapi alasannya menyusul. */
  feedbackId: string;
  helpfulYes: number;
  helpfulNo: number;
}

/**
 * Mencatat jawaban "Apakah informasi ini membantu?" — §10.
 *
 * Dua tulisan: baris mentah di `faq_feedback` (menyimpan alasannya) dan penghitung
 * agregat di `faqs` (dipakai peringkat search). Keduanya perlu — angka agregat
 * tidak bisa menjelaskan alasan, dan menghitung ulang dari baris mentah setiap
 * kali peringkat dihitung terlalu mahal.
 *
 * Tidak dibungkus transaksi: driver Neon HTTP tidak mendukung transaksi interaktif
 * (lihat client.ts). Kalau penulisan kedua gagal, yang terjadi adalah penghitung
 * tertinggal dari catatan mentah — dan catatan mentah adalah sumber kebenarannya,
 * jadi selisihnya bisa direkonsiliasi kapan saja. Kebalikannya tidak bisa.
 */
export async function recordFaqFeedback(
  faqSlug: string,
  isHelpful: boolean,
  reason: FaqFeedbackReason | null,
): Promise<FaqFeedbackResult | null> {
  const db = getDb();

  const [faq] = await db
    .select({ id: faqs.id })
    .from(faqs)
    .where(and(eq(faqs.slug, faqSlug), eq(faqs.status, 'published'), eq(faqs.visibility, 'public')))
    .limit(1);

  if (!faq) return null;

  const [inserted] = await db
    .insert(faqFeedback)
    .values({
      faqId: faq.id,
      isHelpful,
      // Alasan hanya bermakna untuk jawaban "Belum"; disimpan null bila membantu.
      reason: isHelpful ? null : reason,
    })
    .returning({ id: faqFeedback.id });

  const [updated] = await db
    .update(faqs)
    .set(
      isHelpful
        ? { helpfulYes: sql`${faqs.helpfulYes} + 1` }
        : { helpfulNo: sql`${faqs.helpfulNo} + 1` },
    )
    .where(eq(faqs.id, faq.id))
    .returning({ helpfulYes: faqs.helpfulYes, helpfulNo: faqs.helpfulNo });

  return {
    ok: true,
    feedbackId: inserted!.id,
    helpfulYes: updated?.helpfulYes ?? 0,
    helpfulNo: updated?.helpfulNo ?? 0,
  };
}

/**
 * Melengkapi alasan pada catatan feedback yang SUDAH ada.
 *
 * Alasan ditanyakan setelah pengguna menjawab "Belum", jadi ia tiba sebagai
 * permintaan kedua. Kalau permintaan itu diperlakukan sebagai feedback baru,
 * satu orang terhitung dua kali menekan "Belum" — persis yang terjadi sebelum
 * fungsi ini ada. Di sini hanya kolom `reason` yang disentuh; penghitung agregat
 * tidak ikut naik.
 *
 * Hanya berlaku untuk catatan yang benar-benar bernilai "Belum" dan yang
 * alasannya masih kosong, sehingga id yang bocor pun tidak bisa dipakai
 * mengubah-ubah alasan berkali-kali.
 */
export async function attachFaqFeedbackReason(
  feedbackId: string,
  reason: FaqFeedbackReason,
): Promise<boolean> {
  const updated = await getDb()
    .update(faqFeedback)
    .set({ reason })
    .where(
      and(
        eq(faqFeedback.id, feedbackId),
        eq(faqFeedback.isHelpful, false),
        isNull(faqFeedback.reason),
      ),
    )
    .returning({ id: faqFeedback.id });

  return updated.length > 0;
}

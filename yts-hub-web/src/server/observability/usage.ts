/**
 * Analytics kunjungan dan klik keluar —
 * 09-ACCESSIBILITY-PERFORMANCE-SEO.md §8, 10-DEVELOPMENT-PLAN.md §10.
 *
 * §8 menyebut lima hal yang boleh dikumpulkan. Tiga sudah ada sejak Fase 4
 * (search terms, result click, FAQ feedback); dua sisanya ada di sini:
 * route views dan service outbound click.
 *
 * ## Kenapa dihitung per hari, bukan per kejadian
 *
 * Baris per kunjungan — meski tanpa nama, tanpa IP, tanpa cookie — tetap
 * menyimpan urutan waktu. Deretan cap waktu berjarak beberapa detik pada
 * halaman yang berurutan sudah cukup untuk merangkai kembali kunjungan
 * seseorang. Penghitung harian tidak bisa dirangkai seperti itu, dan tetap
 * menjawab pertanyaan yang benar-benar dibutuhkan: halaman mana yang dipakai
 * orang, dan apakah mereka berhasil sampai ke sistem tujuannya.
 *
 * Yang hilang karenanya disebut terus terang: tidak ada alur antarhalaman,
 * tidak ada pengunjung unik, tidak ada rasio pentalan. Ketiganya menuntut
 * pelacakan per orang, dan itu bukan harga yang perlu dibayar YTS.
 */
import { desc, gte, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { outboundClicks, pageViews } from '@/server/db/schema';

/** Tanggal UTC sebagai `YYYY-MM-DD`. */
function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function daysAgo(days: number, now: Date = new Date()): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Menormalkan path sebelum disimpan.
 *
 * Query string dibuang: `/cari?q=...` memuat teks pencarian, dan teks itu sudah
 * punya tempatnya sendiri di `search_queries` — menyimpannya lagi di sini
 * berarti menyimpannya dua kali dengan aturan privasi yang berbeda.
 *
 * Path yang sangat panjang dipotong, dan slug detail DIPERTAHANKAN: mengetahui
 * layanan mana yang paling sering dibuka adalah inti dari laporan ini.
 */
export function normalizePath(path: string): string {
  const clean = path.split('?')[0]!.split('#')[0]!;
  const trimmed = clean.length > 1 ? clean.replace(/\/$/, '') : clean;
  return trimmed.slice(0, 200) || '/';
}

/** Mencatat satu kunjungan halaman. Tidak pernah melempar. */
export async function recordPageView(path: string, now: Date = new Date()): Promise<void> {
  try {
    await getDb()
      .insert(pageViews)
      .values({ path: normalizePath(path), day: today(now), count: 1 })
      .onConflictDoUpdate({
        target: [pageViews.path, pageViews.day],
        set: { count: sql`${pageViews.count} + 1` },
      });
  } catch (error) {
    // Analytics adalah efek samping; kegagalannya tidak boleh terlihat pengunjung.
    console.error('[analytics] gagal mencatat kunjungan:', error);
  }
}

/**
 * Mencatat klik ke sistem luar.
 *
 * Yang disimpan hanya HOST tujuan, bukan URL lengkap. URL lengkap bisa memuat
 * parameter yang menempel pada tautan tertentu, dan yang ingin diketahui di
 * sini adalah "berapa banyak orang sampai ke portal SPMB", bukan "dengan
 * parameter apa".
 */
export async function recordOutboundClick(
  path: string,
  targetUrl: string,
  now: Date = new Date(),
): Promise<void> {
  let host: string;
  try {
    host = new URL(targetUrl).host.slice(0, 200);
  } catch {
    return; // URL tak terurai: tidak ada yang berguna untuk dicatat.
  }

  try {
    await getDb()
      .insert(outboundClicks)
      .values({ path: normalizePath(path), targetHost: host, day: today(now), count: 1 })
      .onConflictDoUpdate({
        target: [outboundClicks.path, outboundClicks.targetHost, outboundClicks.day],
        set: { count: sql`${outboundClicks.count} + 1` },
      });
  } catch (error) {
    console.error('[analytics] gagal mencatat klik keluar:', error);
  }
}

export interface UsageSummary {
  days: number;
  totalViews: number;
  totalOutbound: number;
  topPages: { path: string; views: number }[];
  topDestinations: { host: string; clicks: number }[];
}

/** Ringkasan pemakaian untuk halaman admin. */
export async function usageSummary(days = 30, now: Date = new Date()): Promise<UsageSummary> {
  const since = daysAgo(days, now);
  const db = getDb();

  const [pages, destinations] = await Promise.all([
    db
      .select({
        path: pageViews.path,
        views: sql<number>`sum(${pageViews.count})::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.day, since))
      .groupBy(pageViews.path)
      .orderBy(desc(sql`sum(${pageViews.count})`))
      .limit(20),
    db
      .select({
        host: outboundClicks.targetHost,
        clicks: sql<number>`sum(${outboundClicks.count})::int`,
      })
      .from(outboundClicks)
      .where(gte(outboundClicks.day, since))
      .groupBy(outboundClicks.targetHost)
      .orderBy(desc(sql`sum(${outboundClicks.count})`))
      .limit(20),
  ]);

  return {
    days,
    totalViews: pages.reduce((total, row) => total + row.views, 0),
    totalOutbound: destinations.reduce((total, row) => total + row.clicks, 0),
    topPages: pages,
    topDestinations: destinations,
  };
}

/**
 * Menghapus catatan pemakaian yang lebih tua dari batas simpan.
 *
 * Data agregat pun tidak perlu disimpan selamanya. Setahun cukup untuk melihat
 * pola musiman — pendaftaran, ramadan, tahun ajaran — dan lebih dari itu hanya
 * menumpuk tanpa menjawab pertanyaan baru.
 */
export async function pruneUsage(retentionDays = 365, now: Date = new Date()): Promise<number> {
  const cutoff = daysAgo(retentionDays, now);
  const db = getDb();

  const [views, clicks] = await Promise.all([
    db
      .delete(pageViews)
      .where(sql`${pageViews.day} < ${cutoff}`)
      .returning({ id: pageViews.id }),
    db
      .delete(outboundClicks)
      .where(sql`${outboundClicks.day} < ${cutoff}`)
      .returning({ id: outboundClicks.id }),
  ]);

  return views.length + clicks.length;
}


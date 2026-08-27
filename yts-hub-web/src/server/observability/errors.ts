/**
 * Pencatatan kesalahan sisi server — 10-DEVELOPMENT-PLAN.md §10.
 *
 * Sebelum ini, seluruh kegagalan berakhir di `console.error`. Di Netlify itu
 * berarti tertimbun di log function yang tidak pernah dibuka pengelola YTS —
 * sehingga pencarian yang gagal semalaman terlihat persis sama dengan pencarian
 * yang tidak pernah dicoba.
 *
 * ## Tiga aturan yang dipegang di sini
 *
 * 1. `reportError` TIDAK PERNAH melempar. Ia dipanggil dari dalam blok `catch`;
 *    kegagalan pencatatan yang melempar akan mengubah gangguan kecil menjadi
 *    halaman error, dan menutupi kesalahan aslinya.
 * 2. Tetap menulis ke `console.error`. Bila database-lah yang bermasalah, log
 *    function menjadi satu-satunya jejak yang tersisa.
 * 3. Tidak menyimpan masukan pengguna. 09-A11Y §8 melarang merekam isi form ke
 *    analytics; larangan yang sama berlaku di sini, dan justru di sinilah
 *    godaannya paling besar karena "konteks lengkap" terasa membantu.
 */
import { createHash } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { errorLog } from '@/server/db/schema';

export interface ReportOptions {
  /** Bagian sistem yang melapor, mis. 'search', 'faq-feedback', 'links'. */
  source: string;
  /** Path yang sedang diproses. Query string dibuang sebelum disimpan. */
  path?: string;
  level?: 'warning' | 'error';
  /**
   * Konteks tambahan yang aman dibaca siapa pun yang membuka admin.
   *
   * JANGAN mengisinya dengan masukan pengguna: teks pencarian, isi formulir,
   * alamat email, atau apa pun yang diketik seseorang. Yang berguna di sini
   * adalah identitas benda, bukan isinya — mis. `{ entity: 'service', slug }`.
   */
  context?: Record<string, string | number | boolean | null>;
}

/** Membuang query string dan fragment; keduanya bisa memuat teks pencarian. */
function safePath(path: string | undefined): string | null {
  if (!path) return null;
  return path.split('?')[0]!.split('#')[0]!.slice(0, 200);
}

/**
 * Pesan yang stabil untuk penggabungan.
 *
 * Yang diganti penanda hanya angka yang memang berbeda tiap kejadian:
 * - uuid dan id panjang;
 * - angka berdampingan dengan satuan, mis. `1234ms`, `512kb`.
 *
 * Angka pendek yang berdiri sendiri DIBIARKAN. "HTTP 404" dan "HTTP 500" adalah
 * dua masalah berbeda dengan penanganan berbeda; menggabungkannya akan membuat
 * satu baris yang menyembunyikan keduanya. Batasnya memang tidak sempurna —
 * tetapi salah di sisi ini hanya menghasilkan dua baris, sedangkan salah di sisi
 * sebaliknya menghilangkan informasi.
 */
function normalizeMessage(message: string): string {
  return message
    .slice(0, 500)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/\b\d{5,}\b/g, '<n>')
    .replace(/\d+(?=[a-z])/gi, '<n>');
}

function fingerprintOf(source: string, message: string): string {
  return createHash('sha256')
    .update(`${source}|${normalizeMessage(message)}`)
    .digest('hex')
    .slice(0, 32);
}

/** Beberapa bingkai teratas sudah cukup untuk menemukan asalnya. */
function trimStack(stack: string | undefined): string | null {
  if (!stack) return null;
  return stack.split('\n').slice(0, 8).join('\n').slice(0, 2000);
}

/**
 * Mencatat satu kesalahan.
 *
 * Kejadian berulang menaikkan penghitung pada baris yang sama, bukan menambah
 * baris baru — dan menyalakan kembali kesalahan yang sudah ditandai selesai,
 * karena kembalinya masalah lama adalah kabar yang harus terlihat.
 */
export async function reportError(caught: unknown, options: ReportOptions): Promise<void> {
  const error = caught instanceof Error ? caught : new Error(String(caught));
  const level = options.level ?? 'error';

  // Selalu ke log function lebih dulu — lihat aturan 2 di atas.
  console.error(`[${options.source}] ${error.message}`, error);

  try {
    const fingerprint = fingerprintOf(options.source, error.message);

    await getDb()
      .insert(errorLog)
      .values({
        fingerprint,
        level,
        source: options.source.slice(0, 100),
        message: error.message.slice(0, 500),
        stack: trimStack(error.stack),
        path: safePath(options.path),
        context: options.context ?? null,
        count: 1,
      })
      .onConflictDoUpdate({
        target: errorLog.fingerprint,
        set: {
          count: sql`${errorLog.count} + 1`,
          lastSeenAt: new Date(),
          message: error.message.slice(0, 500),
          stack: trimStack(error.stack),
          path: safePath(options.path),
          context: options.context ?? null,
          // Kesalahan yang muncul lagi dibuka kembali. Kalau tidak, baris yang
          // pernah ditandai selesai akan diam-diam menelan kejadian baru.
          resolvedAt: null,
          resolvedBy: null,
        },
      });
  } catch (loggingFailure) {
    // Tidak dilempar. Lihat aturan 1.
    console.error('[observability] gagal mencatat kesalahan:', loggingFailure);
  }
}

export interface ErrorEntry {
  id: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  path: string | null;
  context: unknown;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

/** Kesalahan untuk halaman admin. Yang belum selesai lebih dulu, terbaru di atas. */
export async function listErrors(options: { resolved?: boolean; limit?: number } = {}) {
  const { resolved = false, limit = 100 } = options;

  return getDb()
    .select({
      id: errorLog.id,
      level: errorLog.level,
      source: errorLog.source,
      message: errorLog.message,
      stack: errorLog.stack,
      path: errorLog.path,
      context: errorLog.context,
      count: errorLog.count,
      firstSeenAt: errorLog.firstSeenAt,
      lastSeenAt: errorLog.lastSeenAt,
      resolvedAt: errorLog.resolvedAt,
    })
    .from(errorLog)
    .where(resolved ? sql`${errorLog.resolvedAt} is not null` : isNull(errorLog.resolvedAt))
    .orderBy(desc(errorLog.lastSeenAt))
    .limit(limit) as unknown as Promise<ErrorEntry[]>;
}

/** Jumlah kesalahan yang belum ditandai selesai — dipakai dasbor. */
export async function countOpenErrors(): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(errorLog)
    .where(isNull(errorLog.resolvedAt));
  return rows[0]?.n ?? 0;
}

/**
 * Menandai kesalahan selesai ditangani.
 *
 * Tidak menghapus barisnya: bila masalah yang sama kembali, `reportError` akan
 * membukanya lagi dan riwayat "pernah terjadi, pernah diperbaiki, muncul lagi"
 * itulah yang memberi tahu bahwa perbaikannya belum menyentuh akar masalah.
 */
export async function resolveError(id: string, userId: string): Promise<boolean> {
  const updated = await getDb()
    .update(errorLog)
    .set({ resolvedAt: new Date(), resolvedBy: userId })
    .where(and(eq(errorLog.id, id), isNull(errorLog.resolvedAt)))
    .returning({ id: errorLog.id });

  return updated.length > 0;
}

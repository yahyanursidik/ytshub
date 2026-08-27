/**
 * Test integrasi observability (Fase 7).
 *
 * Empat hal yang dijaga di sini, semuanya hanya bisa dibuktikan dengan database:
 *
 * 1. kesalahan yang sama DIGABUNG, bukan menumpuk — daftar yang penuh oleh satu
 *    masalah akan berhenti dibaca, dan itu membatalkan seluruh gunanya;
 * 2. `reportError` tidak pernah melempar, bahkan ketika pencatatannya gagal;
 * 3. analytics tidak menyimpan yang dilarang 09-A11Y §8 — query string dibuang,
 *    tujuan klik hanya host;
 * 4. laporan kesehatan konten menemukan PLACEHOLDER yang sudah terbit.
 *
 * Di-skip otomatis bila DATABASE_URL_TEST kosong.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, schema } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { runSeed } from '@/server/db/seed';
import { PLACEHOLDER } from '@/server/db/seed-data';
import {
  countOpenErrors,
  listErrors,
  reportError,
  resolveError,
} from '@/server/observability/errors';
import {
  normalizePath,
  pruneUsage,
  recordOutboundClick,
  recordPageView,
  usageSummary,
} from '@/server/observability/usage';
import { contentHealth } from '@/server/observability/content-health';

const testUrl = process.env.DATABASE_URL_TEST;
const describeDb = testUrl ? describe : describe.skip;

describeDb('observability', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    await runMigrations();
    db = createDatabase();
    await db
      .insert(schema.users)
      .values({ id: 'user-observability', name: 'Uji', email: 'obs@yts.test' })
      .onConflictDoNothing();
  }, 60_000);

  afterAll(async () => {
    await closeDatabase(db);
  });

  beforeEach(async () => {
    await db.delete(schema.errorLog);
    await db.delete(schema.pageViews);
    await db.delete(schema.outboundClicks);
  });

  describe('pencatatan kesalahan', () => {
    it('menggabungkan kejadian yang sama menjadi satu baris', async () => {
      for (let i = 0; i < 5; i += 1) {
        await reportError(new Error('koneksi gagal'), { source: 'uji' });
      }

      const errors = await listErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.count).toBe(5);
    });

    /**
     * Tanpa normalisasi, "gagal setelah 120ms" dan "gagal setelah 340ms"
     * menjadi dua baris; satu masalah akan memenuhi daftar dan menyembunyikan
     * yang lain.
     */
    it('pesan yang hanya berbeda angka tetap dianggap satu masalah', async () => {
      await reportError(new Error('timeout setelah 120ms'), { source: 'uji' });
      await reportError(new Error('timeout setelah 340ms'), { source: 'uji' });

      expect(await listErrors()).toHaveLength(1);
    });

    /**
     * Batas penggabungan yang disengaja: 404 dan 500 adalah dua masalah dengan
     * penanganan berbeda, dan menyatukannya menyembunyikan salah satunya.
     */
    it('kode status yang berbeda TIDAK digabung', async () => {
      await reportError(new Error('sistem tujuan menjawab 404'), { source: 'uji' });
      await reportError(new Error('sistem tujuan menjawab 500'), { source: 'uji' });

      expect(await listErrors()).toHaveLength(2);
    });

    it('id panjang tidak memecah satu masalah menjadi banyak baris', async () => {
      await reportError(new Error('baris 3ed22766-ad87-4219-9058-fc2d1dd4aa7e gagal'), {
        source: 'uji',
      });
      await reportError(new Error('baris c52859b5-07e1-4fef-a6c9-f14ea1ca2ed9 gagal'), {
        source: 'uji',
      });

      expect(await listErrors()).toHaveLength(1);
    });

    it('sumber berbeda tetap menjadi baris berbeda', async () => {
      await reportError(new Error('koneksi gagal'), { source: 'search' });
      await reportError(new Error('koneksi gagal'), { source: 'links' });

      expect(await listErrors()).toHaveLength(2);
    });

    it('membuang query string dari path — bisa memuat teks pencarian', async () => {
      await reportError(new Error('gagal'), { source: 'uji', path: '/cari?q=rahasia' });

      const [entry] = await listErrors();
      expect(entry?.path).toBe('/cari');
    });

    /** Dipanggil dari dalam `catch`; melempar berarti menutupi kesalahan asli. */
    it('tidak pernah melempar, apa pun yang dilemparkan padanya', async () => {
      await expect(reportError('bukan Error', { source: 'uji' })).resolves.toBeUndefined();
      await expect(reportError(null, { source: 'uji' })).resolves.toBeUndefined();
      await expect(
        reportError(new Error('x'.repeat(5000)), { source: 'uji' }),
      ).resolves.toBeUndefined();
    });

    it('menandai selesai, dan kejadian baru membukanya kembali', async () => {
      await reportError(new Error('kambuhan'), { source: 'uji' });
      const [entry] = await listErrors();

      expect(await resolveError(entry!.id, 'user-observability')).toBe(true);
      expect(await countOpenErrors()).toBe(0);
      // Menandai dua kali tidak berpengaruh.
      expect(await resolveError(entry!.id, 'user-observability')).toBe(false);

      await reportError(new Error('kambuhan'), { source: 'uji' });
      expect(await countOpenErrors()).toBe(1);
    });
  });

  describe('analytics pemakaian', () => {
    it('membuang query string dan garis miring di ujung', () => {
      expect(normalizePath('/layanan/ppdb?utm=x')).toBe('/layanan/ppdb');
      expect(normalizePath('/layanan/')).toBe('/layanan');
      expect(normalizePath('/')).toBe('/');
      expect(normalizePath('/faq#bagian')).toBe('/faq');
    });

    it('menghitung kunjungan pada baris harian yang sama', async () => {
      await recordPageView('/faq');
      await recordPageView('/faq?dari=beranda');

      const rows = await db.select().from(schema.pageViews);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.count).toBe(2);
    });

    /**
     * Menyimpan URL lengkap akan ikut menyimpan parameter yang menempel pada
     * tautan; yang ingin diketahui hanya "berapa yang sampai ke portal itu".
     */
    it('klik keluar hanya menyimpan host tujuannya', async () => {
      await recordOutboundClick('/aplikasi', 'https://hub.tslabschool.sch.id/spmb?token=abc');

      const [row] = await db.select().from(schema.outboundClicks);
      expect(row?.targetHost).toBe('hub.tslabschool.sch.id');
      expect(JSON.stringify(row)).not.toContain('token');
    });

    it('URL tujuan yang tidak bisa diurai tidak dicatat', async () => {
      await recordOutboundClick('/aplikasi', 'bukan-url');
      expect(await db.select().from(schema.outboundClicks)).toHaveLength(0);
    });

    it('tidak menyimpan kolom identitas apa pun', () => {
      // Bukan sekadar tidak diisi — kolomnya memang tidak boleh ada (09-A11Y §8).
      for (const table of [schema.pageViews, schema.outboundClicks]) {
        const columns = Object.keys(table).map((key) => key.toLowerCase());
        for (const forbidden of ['ip', 'ipaddress', 'useragent', 'sessionid', 'userid', 'referrer']) {
          expect(columns).not.toContain(forbidden);
        }
      }
    });

    it('meringkas kunjungan dan klik dalam rentang hari', async () => {
      await recordPageView('/faq');
      await recordPageView('/layanan');
      await recordOutboundClick('/aplikasi', 'https://tarbiyahsunnah.com/');

      const summary = await usageSummary(30);
      expect(summary.totalViews).toBe(2);
      expect(summary.totalOutbound).toBe(1);
      expect(summary.topPages.map((row) => row.path)).toContain('/faq');
    });

    it('membuang catatan yang melewati batas simpan', async () => {
      const lama = new Date();
      lama.setUTCDate(lama.getUTCDate() - 400);
      await recordPageView('/lama', lama);
      await recordPageView('/baru');

      const dibuang = await pruneUsage(365);
      expect(dibuang).toBe(1);

      const sisa = await db.select().from(schema.pageViews);
      expect(sisa.map((row) => row.path)).toEqual(['/baru']);
    });
  });

  describe('kesehatan konten', () => {
    beforeEach(async () => {
      await runSeed(db);
    });

    /** Pelanggaran yang paling ditakuti proyek ini: 05-HALLMARK §7. */
    it('menemukan konten terbit yang masih berisi PLACEHOLDER', async () => {
      const report = await contentHealth(null);
      const placeholder = report.issues.filter((issue) => issue.kind === 'placeholder');

      expect(placeholder.length).toBeGreaterThan(0);
      expect(placeholder.some((issue) => issue.slug === 'ppdb-online')).toBe(true);
    });

    it('konten yang belum terbit tidak ikut dilaporkan', async () => {
      await db
        .update(schema.services)
        .set({ status: 'draft' })
        .where(eq(schema.services.slug, 'ppdb-online'));

      const report = await contentHealth(null);
      expect(report.issues.some((issue) => issue.slug === 'ppdb-online')).toBe(false);
    });

    it('temuan hilang begitu placeholder diganti isi sungguhan', async () => {
      await db
        .update(schema.services)
        .set({
          requirements: 'Fotokopi kartu keluarga.',
          processSteps: 'Isi formulir, unggah berkas, tunggu verifikasi.',
          feeInformation: 'Tidak dipungut biaya pendaftaran.',
        })
        .where(eq(schema.services.slug, 'ppdb-online'));

      const report = await contentHealth(null);
      const found = report.issues.filter(
        (issue) => issue.slug === 'ppdb-online' && issue.kind === 'placeholder',
      );
      expect(found).toHaveLength(0);
    });

    it('seed menerbitkan konten dengan jadwal tinjauan', async () => {
      // Tanpa ini, seluruh konten seed akan muncul sebagai temuan
      // "tanpa-tinjauan" — dan laporan yang penuh temuan sepele tidak dibaca.
      const report = await contentHealth(null);
      expect(report.byKind['tanpa-tinjauan']).toBe(0);
    });

    it('dibatasi unit yang boleh dilihat pemanggil', async () => {
      const [unit] = await db
        .select({ id: schema.units.id })
        .from(schema.units)
        .where(eq(schema.units.slug, 'ts-lab-school'));

      const report = await contentHealth([unit!.id]);
      for (const issue of report.issues) expect(issue.unitId).toBe(unit!.id);
    });

    it('orang tanpa unit tidak melihat temuan apa pun', async () => {
      expect((await contentHealth([])).issues).toEqual([]);
    });

    it('PLACEHOLDER yang dipakai seed memang penanda yang dicari laporan', () => {
      // Menjaga keduanya tetap sejalan: bila teks penandanya diubah di
      // seed-data.ts tanpa mengubah laporan, laporan akan diam-diam bersih.
      expect(PLACEHOLDER.startsWith('PLACEHOLDER')).toBe(true);
    });
  });
});

/**
 * Test integrasi pemantauan tautan (Fase 6).
 *
 * Memakai server HTTP lokal, bukan situs sungguhan: hasilnya harus sama setiap
 * kali dijalankan, dan test yang bergantung pada sistem orang lain akan gagal
 * karena alasan yang tidak ada hubungannya dengan kode ini.
 *
 * Yang dibuktikan di sini dan tidak bisa dibuktikan oleh test unit:
 * 1. URL benar-benar dikumpulkan dari kelima entity, dan hanya dari konten terbit;
 * 2. riwayat kegagalan bertahan antar pemeriksaan sehingga eskalasi berjalan;
 * 3. URL yang berubah memulai riwayat baru;
 * 4. baris untuk URL yang sudah dihapus editor ikut dibuang.
 *
 * Di-skip otomatis bila DATABASE_URL_TEST kosong.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, schema } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { runSeed } from '@/server/db/seed';
import { checkAllLinks, collectTargets, listLinks } from '@/server/integrations/link-monitor';
import { FAILURES_BEFORE_BROKEN } from '@/server/integrations/link-status';

const testUrl = process.env.DATABASE_URL_TEST;
const describeDb = testUrl ? describe : describe.skip;

describeDb('pemantauan tautan', () => {
  let db: ReturnType<typeof createDatabase>;
  let server: Server;
  let base: string;

  /** Diubah tiap test untuk mengatur jawaban server palsu. */
  let responses: Record<string, number> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    await runMigrations();
    db = createDatabase();

    server = createServer((req, res) => {
      const path = req.url ?? '/';
      if (path === '/pindah') {
        res.writeHead(302, { location: `${base}/tujuan-baru` });
        res.end();
        return;
      }
      res.writeHead(responses[path] ?? 200);
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    server?.close();
    await closeDatabase(db);
  });

  beforeEach(async () => {
    responses = {};
    await db.delete(schema.externalLinks);
    await runSeed(db);
  });

  /** Menempelkan URL ke konten terbit agar ada yang bisa diperiksa. */
  async function setServiceUrl(slug: string, url: string | null) {
    await db.update(schema.services).set({ ctaUrl: url }).where(eq(schema.services.slug, slug));
  }

  describe('pengumpulan target', () => {
    it('mengumpulkan URL dari kelima entity yang bisa punya tautan', async () => {
      await setServiceUrl('ppdb-online', `${base}/layanan`);
      await db.update(schema.units).set({ websiteUrl: `${base}/unit` });
      await db.update(schema.programs).set({ ctaUrl: `${base}/program` });
      await db.update(schema.events).set({ registrationUrl: `${base}/event` });
      await db.update(schema.applications).set({ url: `${base}/aplikasi` });

      const entities = new Set((await collectTargets()).map((target) => target.entity));
      expect(entities).toEqual(new Set(['unit', 'service', 'program', 'event', 'application']));
    });

    it('mengabaikan skema selain http(s)', async () => {
      await setServiceUrl('ppdb-online', 'mailto:admin@yts.test');
      const targets = await collectTargets();
      expect(targets.some((target) => target.field === 'ctaUrl')).toBe(false);
    });

    /**
     * Tautan pada draft belum menjanjikan apa pun kepada siapa pun, dan
     * memeriksanya berarti menghubungi sistem luar atas nama halaman yang
     * belum terbit.
     */
    it('tidak memeriksa tautan pada konten yang belum terbit', async () => {
      await setServiceUrl('ppdb-online', `${base}/rahasia`);
      await db
        .update(schema.services)
        .set({ status: 'draft' })
        .where(eq(schema.services.slug, 'ppdb-online'));

      const targets = await collectTargets();
      expect(targets.some((target) => target.url.includes('/rahasia'))).toBe(false);
    });

    it('tidak memeriksa tautan pada konten yang tidak publik', async () => {
      await setServiceUrl('ppdb-online', `${base}/internal`);
      await db
        .update(schema.services)
        .set({ visibility: 'internal' })
        .where(eq(schema.services.slug, 'ppdb-online'));

      const targets = await collectTargets();
      expect(targets.some((target) => target.url.includes('/internal'))).toBe(false);
    });
  });

  describe('pemeriksaan & penyimpanan', () => {
    it('mencatat tautan sehat', async () => {
      await setServiceUrl('ppdb-online', `${base}/ok`);
      const summary = await checkAllLinks();

      expect(summary.checked).toBe(1);
      expect(summary.healthy).toBe(1);

      const [row] = await db.select().from(schema.externalLinks);
      expect(row?.status).toBe('healthy');
      expect(row?.httpStatus).toBe(200);
      expect(row?.checkedAt).toBeInstanceOf(Date);
    });

    it('404 langsung rusak dan dilaporkan sebagai baru rusak', async () => {
      await setServiceUrl('ppdb-online', `${base}/hilang`);
      responses['/hilang'] = 404;

      const summary = await checkAllLinks();
      expect(summary.broken).toBe(1);
      expect(summary.newlyBroken).toHaveLength(1);
      expect(summary.newlyBroken[0]?.note).toContain('404');

      const [row] = await db.select().from(schema.externalLinks);
      expect(row?.firstBrokenAt).toBeInstanceOf(Date);
    });

    it('mencatat pengalihan beserta alamat tujuannya', async () => {
      await setServiceUrl('ppdb-online', `${base}/pindah`);
      const summary = await checkAllLinks();

      expect(summary.redirected).toBe(1);
      const [row] = await db.select().from(schema.externalLinks);
      expect(row?.status).toBe('redirected');
      expect(row?.redirectTarget).toContain('/tujuan-baru');
    });

    /** Inti dari desain ini: gangguan sesaat tidak boleh langsung jadi alarm. */
    it('5xx naik menjadi rusak hanya setelah gagal berturut-turut', async () => {
      await setServiceUrl('ppdb-online', `${base}/goyah`);
      responses['/goyah'] = 503;

      for (let attempt = 1; attempt < FAILURES_BEFORE_BROKEN; attempt += 1) {
        const summary = await checkAllLinks();
        expect(summary.warning).toBe(1);
        expect(summary.newlyBroken).toHaveLength(0);
      }

      const final = await checkAllLinks();
      expect(final.broken).toBe(1);
      expect(final.newlyBroken).toHaveLength(1);
    });

    it('pulih menghapus riwayat kegagalan', async () => {
      await setServiceUrl('ppdb-online', `${base}/pulih`);
      responses['/pulih'] = 503;
      await checkAllLinks();

      responses['/pulih'] = 200;
      await checkAllLinks();

      const [row] = await db.select().from(schema.externalLinks);
      expect(row?.status).toBe('healthy');
      expect(row?.consecutiveFailures).toBe(0);
      expect(row?.firstBrokenAt).toBeNull();
    });

    /**
     * Editor yang memperbaiki alamat tidak boleh langsung mendapat cap rusak
     * dari riwayat alamat lama.
     */
    it('URL yang diganti memulai riwayat kegagalan dari nol', async () => {
      await setServiceUrl('ppdb-online', `${base}/lama`);
      responses['/lama'] = 503;
      for (let i = 0; i < FAILURES_BEFORE_BROKEN; i += 1) await checkAllLinks();

      expect((await db.select().from(schema.externalLinks))[0]?.status).toBe('broken');

      await setServiceUrl('ppdb-online', `${base}/baru`);
      responses['/baru'] = 503;
      const summary = await checkAllLinks();

      expect(summary.warning).toBe(1);
      expect(summary.broken).toBe(0);
    });

    it('tautan yang dihapus editor ikut hilang dari daftar', async () => {
      await setServiceUrl('ppdb-online', `${base}/sementara`);
      await checkAllLinks();
      expect(await db.select().from(schema.externalLinks)).toHaveLength(1);

      await setServiceUrl('ppdb-online', null);
      const summary = await checkAllLinks();

      expect(summary.removed).toBe(1);
      expect(await db.select().from(schema.externalLinks)).toHaveLength(0);
    });

    it('tautan yang sudah rusak tidak dilaporkan ulang sebagai baru rusak', async () => {
      await setServiceUrl('ppdb-online', `${base}/hilang`);
      responses['/hilang'] = 404;

      expect((await checkAllLinks()).newlyBroken).toHaveLength(1);
      // Melaporkannya setiap hari akan membuat orang berhenti membaca laporan.
      expect((await checkAllLinks()).newlyBroken).toHaveLength(0);
    });
  });

  describe('laporan', () => {
    it('menyertakan judul konten dan unit pemiliknya', async () => {
      await setServiceUrl('ppdb-online', `${base}/ok`);
      await checkAllLinks();

      const rows = await listLinks();
      expect(rows[0]?.title).toBe('PPDB Online');
      expect(rows[0]?.unitName).toBeTruthy();
    });

    it('mengurutkan yang rusak lebih dulu', async () => {
      await setServiceUrl('ppdb-online', `${base}/ok`);
      await db.update(schema.applications).set({ url: `${base}/hilang` });
      responses['/hilang'] = 404;
      await checkAllLinks();

      const rows = await listLinks();
      expect(rows[0]?.status).toBe('broken');
    });
  });
});

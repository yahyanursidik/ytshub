/**
 * Test integrasi pengumuman.
 *
 * Yang dijaga di sini adalah satu sifat yang membedakan entity ini dari yang
 * lain: ia berhenti tampil SENDIRI. Seluruh kegagalannya berbentuk sama —
 * pengumuman pendaftaran yang tetap tayang setelah pendaftaran ditutup — dan
 * kegagalan itu tidak melempar error, tidak merusak halaman, dan tidak
 * terlihat oleh siapa pun kecuali pembaca yang telanjur mempercayainya.
 *
 * Di-skip otomatis bila DATABASE_URL_TEST kosong.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, schema } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { runSeed } from '@/server/db/seed';
import {
  getAnnouncement,
  getHighlightedAnnouncement,
  listActiveAnnouncements,
} from '@/server/content/announcement-queries';
import { contentHealth } from '@/server/observability/content-health';

const testUrl = process.env.DATABASE_URL_TEST;
const describeDb = testUrl ? describe : describe.skip;

describeDb('pengumuman', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    await runMigrations();
    db = createDatabase();
  }, 60_000);

  afterAll(async () => {
    await closeDatabase(db);
  });

  beforeEach(async () => {
    // Pengumuman dimuat `onConflictDoNothing`, jadi baris lama harus dibuang
    // dulu agar tiap test mulai dari keadaan yang sama.
    await db.delete(schema.announcementsToApplications);
    await db.delete(schema.announcements);
    await runSeed(db);
  });

  const setPeriod = (startAt: Date, endAt: Date | null) =>
    db.update(schema.announcements).set({ startAt, endAt }).where(eq(schema.announcements.slug, 'spmb'));

  const hariLalu = (n: number) => new Date(Date.now() - n * 86_400_000);
  const hariDepan = (n: number) => new Date(Date.now() + n * 86_400_000);

  describe('seed data resmi', () => {
    it('memuat pengumuman SPMB beserta kedua portalnya', async () => {
      const banner = await getHighlightedAnnouncement();

      expect(banner).not.toBeNull();
      expect(banner!.slug).toBe('spmb');
      expect(banner!.targets.map((target) => target.slug)).toEqual([
        'spmb-mahad-tahfidzul-quran',
        'spmb-ts-lab-school',
      ]);
    });

    /**
     * Alamat portal hidup di registry, bukan disalin ke pengumuman. Kalau ia
     * ikut tersalin, pemantau tautan akan memeriksa alamat yang sama dua kali
     * dan admin melihat dua baris yang bisa berbeda statusnya.
     */
    it('mengambil URL dari registry, bukan menyimpannya sendiri', async () => {
      const kolom = Object.keys(schema.announcements).map((key) => key.toLowerCase());
      expect(kolom).not.toContain('url');
      expect(kolom).not.toContain('ctaurl');

      const banner = await getHighlightedAnnouncement();
      expect(banner!.targets[0]?.url).toMatch(/^https:\/\/hub\.mahadtarbiyahsunnah\.com/);
    });

    it('dimuat ulang tanpa menggandakan atau menimpa suntingan pengurus', async () => {
      await db
        .update(schema.announcements)
        .set({ bannerText: 'Teks yang disunting pengurus.' })
        .where(eq(schema.announcements.slug, 'spmb'));

      await runSeed(db);

      const rows = await db.select().from(schema.announcements);
      expect(rows).toHaveLength(1);
      // Inilah alasan pengumuman dimuat onConflictDoNothing, bukan upsert.
      expect(rows[0]?.bannerText).toBe('Teks yang disunting pengurus.');
    });
  });

  describe('masa berlaku', () => {
    it('tampil selama masanya berjalan', async () => {
      await setPeriod(hariLalu(1), hariDepan(30));
      expect(await getHighlightedAnnouncement()).not.toBeNull();
      expect(await listActiveAnnouncements()).toHaveLength(1);
    });

    /** Inti entity ini: berhenti sendiri, tanpa menunggu ada yang mencabutnya. */
    it('berhenti tampil setelah tanggal berakhir lewat', async () => {
      await setPeriod(hariLalu(60), hariLalu(1));

      expect(await getHighlightedAnnouncement()).toBeNull();
      expect(await listActiveAnnouncements()).toHaveLength(0);
    });

    it('belum tampil sebelum tanggal mulai', async () => {
      await setPeriod(hariDepan(7), hariDepan(60));

      expect(await getHighlightedAnnouncement()).toBeNull();
      expect(await listActiveAnnouncements()).toHaveLength(0);
    });

    it('tanpa tanggal berakhir berarti masih berlaku', async () => {
      await setPeriod(hariLalu(1), null);
      expect(await getHighlightedAnnouncement()).not.toBeNull();
    });

    /**
     * Halaman detail sengaja TIDAK ikut aturan masa berlaku: tautan pengumuman
     * beredar di grup dan pesan berantai jauh setelah masanya lewat, dan 404
     * membuat orang mengira dirinya salah alamat.
     */
    it('halaman detail tetap bisa dibuka setelah masanya berakhir', async () => {
      await setPeriod(hariLalu(60), hariLalu(1));

      const detail = await getAnnouncement('spmb');
      expect(detail).not.toBeNull();
      expect(detail!.hasEnded).toBe(true);
      expect(detail!.targets.length).toBeGreaterThan(0);
    });
  });

  describe('gate publik', () => {
    it('pengumuman draft tidak tampil di mana pun', async () => {
      await db
        .update(schema.announcements)
        .set({ status: 'draft' })
        .where(eq(schema.announcements.slug, 'spmb'));

      expect(await getHighlightedAnnouncement()).toBeNull();
      expect(await getAnnouncement('spmb')).toBeNull();
    });

    it('banner hanya menampilkan yang ditandai disorot', async () => {
      await db.update(schema.announcements).set({ isHighlighted: false });
      expect(await getHighlightedAnnouncement()).toBeNull();
      // Tetap aktif dan tetap punya halamannya sendiri.
      expect(await listActiveAnnouncements()).toHaveLength(1);
    });

    it('portal yang belum terbit tidak muncul lewat pintu pengumuman', async () => {
      await db
        .update(schema.applications)
        .set({ status: 'draft' })
        .where(eq(schema.applications.slug, 'spmb-ts-lab-school'));

      const banner = await getHighlightedAnnouncement();
      expect(banner!.targets.map((target) => target.slug)).toEqual([
        'spmb-mahad-tahfidzul-quran',
      ]);
    });
  });

  describe('kesehatan konten', () => {
    it('menandai pengumuman tayang tanpa tanggal berakhir', async () => {
      await setPeriod(hariLalu(1), null);

      const report = await contentHealth(null);
      const temuan = report.issues.filter((issue) => issue.kind === 'tanpa-akhir');
      expect(temuan).toHaveLength(1);
      expect(temuan[0]?.slug).toBe('spmb');
    });

    it('temuan hilang begitu tanggal berakhirnya diisi', async () => {
      await setPeriod(hariLalu(1), hariDepan(30));

      const report = await contentHealth(null);
      expect(report.byKind['tanpa-akhir']).toBe(0);
    });
  });
});

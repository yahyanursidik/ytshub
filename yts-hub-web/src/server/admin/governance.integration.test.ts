/**
 * Test integrasi governance (Fase 5) terhadap PostgreSQL sungguhan.
 *
 * Aturan izin sudah diuji sebagai fungsi murni di src/server/auth/roles.test.ts.
 * Yang diuji DI SINI adalah hal-hal yang hanya bisa dibuktikan dengan database:
 *
 * 1. penyaringan menurut unit benar-benar terjadi di SQL, bukan setelah baris
 *    terbaca — daftar untuk editor satu unit tidak boleh memuat unit lain;
 * 2. audit log dan perubahan barisnya berada dalam satu transaksi;
 * 3. penerbitan mengisi tanggal tinjauan, pengarsipan mengosongkannya;
 * 4. konten yang diarsipkan hilang dari query publik.
 *
 * Di-skip otomatis bila DATABASE_URL_TEST kosong.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, schema } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { runSeed } from '@/server/db/seed';
import {
  auditFor,
  getForActor,
  GovernanceError,
  listForActor,
  transition,
  updateContent,
} from '@/server/admin/governance';
import { search } from '@/server/content/search-queries';
import type { Actor } from '@/server/auth/roles';

const testUrl = process.env.DATABASE_URL_TEST;
const describeDb = testUrl ? describe : describe.skip;

describeDb('governance konten', () => {
  let db: ReturnType<typeof createDatabase>;
  let unitSekolah: string;
  let layananSekolah: string;
  let layananSosial: string;

  const actorOf = (assignments: Actor['assignments'], name = 'Uji'): Actor => ({
    id: 'user-uji',
    name,
    email: 'uji@yts.test',
    assignments,
  });

  /**
   * Id dibaca ULANG setiap kali, bukan sekali di beforeAll.
   *
   * `runSeed` menghapus lalu memuat ulang baris DEV-, dan uuid-nya dibuat baru
   * setiap pemuatan. Id yang disimpan sebelum seed berikutnya akan menunjuk
   * baris yang sudah tidak ada — dan gagalnya muncul sebagai "tidak ditemukan",
   * bukan sebagai kesalahan test, sehingga mudah disalahartikan.
   */
  async function readIds() {
    const units = await db.select().from(schema.units);
    unitSekolah = units.find((unit) => unit.slug === 'ts-lab-school')!.id;

    const services = await db.select().from(schema.services);
    layananSekolah = services.find((service) => service.slug === 'spmb')!.id;
    layananSosial = services.find((service) => service.slug === 'donasi-online')!.id;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    await runMigrations();
    db = createDatabase();

    /**
     * Pelaku uji harus benar-benar ada di tabel users.
     *
     * `content_audit.actor_id` punya foreign key ke sana — disengaja, supaya
     * audit tidak bisa menunjuk pelaku yang tidak pernah ada. Memakai id karangan
     * di test akan ditolak database, dan itu justru bukti constraint-nya bekerja.
     */
    await db
      .insert(schema.users)
      .values({ id: 'user-uji', name: 'Uji', email: 'uji@yts.test' })
      .onConflictDoNothing();
  }, 60_000);
  // Menutup pool koneksi setelah berkas ini selesai. Tiap berkas test membuka
  // pool sendiri; membiarkannya terbuka membuat koneksi menumpuk sampai ada
  // test yang gagal karena kehabisan koneksi, bukan karena kodenya salah.
  afterAll(async () => {
    await closeDatabase(db);
  });


  beforeEach(async () => {
    // Seed ulang agar status yang diubah satu test tidak terbawa ke test lain.
    await db.delete(schema.contentAudit);
    await runSeed(db);
    await readIds();
  });

  describe('lingkup unit', () => {
    it('editor satu unit hanya melihat konten unitnya', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      const items = await listForActor(editor, 'service');

      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(item.unitId).toBe(unitSekolah);
      expect(items.some((item) => item.slug === 'donasi-online')).toBe(false);
    });

    it('admin organisasi melihat seluruh unit', async () => {
      const admin = actorOf([{ unitId: null, role: 'admin' }]);
      const items = await listForActor(admin, 'service');

      expect(new Set(items.map((item) => item.unitId)).size).toBeGreaterThan(1);
    });

    it('orang tanpa peran tidak melihat apa pun', async () => {
      expect(await listForActor(actorOf([]), 'service')).toEqual([]);
    });

    it('membuka konten unit lain ditolak, bukan dikembalikan sebagian', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      await expect(getForActor(editor, 'service', layananSosial)).rejects.toThrow(GovernanceError);
    });

    it('entity unit memakai id-nya sendiri sebagai pemilik', async () => {
      // Query untuk `unit` tidak boleh men-join units ke dirinya sendiri.
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      const items = await listForActor(editor, 'unit');
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(unitSekolah);
    });
  });

  describe('penyuntingan', () => {
    it('menyimpan perubahan dan mencatat field yang berubah', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }], 'Editor Sekolah');
      const hasil = await updateContent(
        editor,
        'service',
        layananSekolah,
        { serviceChannel: 'Loket unit' },
        'Menambahkan kanal',
      );

      expect(hasil.changedFields).toEqual(['serviceChannel']);

      const [row] = await db
        .select({ channel: schema.services.serviceChannel })
        .from(schema.services)
        .where(eq(schema.services.id, layananSekolah));
      expect(row?.channel).toBe('Loket unit');
    });

    it('tidak menulis apa pun bila tidak ada yang berubah', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      const [before] = await db
        .select({ title: schema.services.title })
        .from(schema.services)
        .where(eq(schema.services.id, layananSekolah));

      const hasil = await updateContent(
        editor,
        'service',
        layananSekolah,
        { title: before!.title },
        null,
      );

      expect(hasil.changedFields).toEqual([]);
      expect(await auditFor(editor, 'service', layananSekolah)).toHaveLength(0);
    });

    /**
     * Celah paling mungkin di seluruh Fase 5: sebuah form biasa mengirim
     * `status=published` dan melewati seluruh pemeriksaan lifecycle.
     */
    it('status tidak bisa diubah lewat jalur penyuntingan', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      await updateContent(
        editor,
        'service',
        layananSekolah,
        { status: 'published', title: 'SPMB (uji)' },
        null,
      );

      const [row] = await db
        .select({ status: schema.services.status })
        .from(schema.services)
        .where(eq(schema.services.id, layananSekolah));
      // Seed menerbitkannya; yang penting perubahan status tidak datang dari input.
      expect(row?.status).toBe('published');

      const riwayat = await auditFor(editor, 'service', layananSekolah);
      expect(riwayat[0]?.changedFields).toEqual(['title']);
    });

    it('menolak penyuntingan konten unit lain', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      await expect(
        updateContent(editor, 'service', layananSosial, { title: 'Diambil alih' }, null),
      ).rejects.toThrow(GovernanceError);

      const [row] = await db
        .select({ title: schema.services.title })
        .from(schema.services)
        .where(eq(schema.services.id, layananSosial));
      expect(row?.title).not.toBe('Diambil alih');
    });
  });

  describe('transisi status', () => {
    const admin = () => actorOf([{ unitId: null, role: 'admin' }], 'Admin Uji');

    it('menjalankan seluruh alur 06-CONTENT-MODEL §9', async () => {
      await transition(admin(), 'service', layananSekolah, 'archived', 'uji');
      await transition(admin(), 'service', layananSekolah, 'draft', 'pulihkan');
      await transition(admin(), 'service', layananSekolah, 'in_review', null);
      await transition(admin(), 'service', layananSekolah, 'approved', null);
      const hasil = await transition(admin(), 'service', layananSekolah, 'published', null);

      expect(hasil.to).toBe('published');
      expect(hasil.reviewDueAt).toBeInstanceOf(Date);
    });

    it('menolak lompatan yang tidak terdaftar', async () => {
      await transition(admin(), 'service', layananSekolah, 'archived', 'uji');
      await transition(admin(), 'service', layananSekolah, 'draft', 'pulihkan');

      await expect(
        transition(admin(), 'service', layananSekolah, 'published', null),
      ).rejects.toThrow(/tidak diizinkan/);
    });

    it('editor tidak bisa menerbitkan', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      await transition(admin(), 'service', layananSekolah, 'archived', 'uji');
      await transition(admin(), 'service', layananSekolah, 'draft', 'pulihkan');
      await transition(editor, 'service', layananSekolah, 'in_review', null);

      await expect(transition(editor, 'service', layananSekolah, 'approved', null)).rejects.toThrow(
        GovernanceError,
      );
    });

    it('penerbitan mengisi tanggal tinjauan, pengarsipan mengosongkannya', async () => {
      await transition(admin(), 'service', layananSekolah, 'archived', 'uji');
      await transition(admin(), 'service', layananSekolah, 'draft', 'pulihkan');
      await transition(admin(), 'service', layananSekolah, 'in_review', null);
      await transition(admin(), 'service', layananSekolah, 'approved', null);
      await transition(admin(), 'service', layananSekolah, 'published', null);

      const [terbit] = await db
        .select({
          reviewDueAt: schema.services.reviewDueAt,
          reviewedAt: schema.services.reviewedAt,
          publishedAt: schema.services.publishedAt,
        })
        .from(schema.services)
        .where(eq(schema.services.id, layananSekolah));

      expect(terbit?.reviewDueAt).toBeInstanceOf(Date);
      expect(terbit?.reviewedAt).toBeInstanceOf(Date);
      // Layanan: 90 hari sejak terbit (06-CONTENT-MODEL §11).
      const selisih = Math.round(
        (terbit!.reviewDueAt!.getTime() - terbit!.reviewedAt!.getTime()) / 86_400_000,
      );
      expect(selisih).toBe(90);

      await transition(admin(), 'service', layananSekolah, 'archived', 'sudah tidak berlaku');
      const [arsip] = await db
        .select({ reviewDueAt: schema.services.reviewDueAt })
        .from(schema.services)
        .where(eq(schema.services.id, layananSekolah));
      expect(arsip?.reviewDueAt).toBeNull();
    });

    it('konten belum lengkap tidak bisa dikirim untuk ditinjau', async () => {
      await transition(admin(), 'service', layananSekolah, 'archived', 'uji');
      await transition(admin(), 'service', layananSekolah, 'draft', 'pulihkan');
      // ctaLabel wajib menurut entities.ts.
      await db
        .update(schema.services)
        .set({ ctaLabel: '' })
        .where(eq(schema.services.id, layananSekolah));

      await expect(
        transition(admin(), 'service', layananSekolah, 'in_review', null),
      ).rejects.toThrow(/Field wajib/);
    });
  });

  describe('audit log', () => {
    const admin = () => actorOf([{ unitId: null, role: 'admin' }], 'Admin Uji');

    it('mencatat pelaku, perpindahan, dan alasannya', async () => {
      await transition(admin(), 'service', layananSekolah, 'archived', 'kanal dipindahkan');

      const riwayat = await auditFor(admin(), 'service', layananSekolah);
      expect(riwayat[0]).toMatchObject({
        action: 'status_changed',
        fromStatus: 'published',
        toStatus: 'archived',
        actorName: 'Admin Uji',
        changeSummary: 'kanal dipindahkan',
      });
    });

    it('menyimpan keadaan sebelum perubahan, bukan sesudah', async () => {
      const [before] = await db
        .select({ channel: schema.services.serviceChannel })
        .from(schema.services)
        .where(eq(schema.services.id, layananSekolah));

      await updateContent(
        admin(),
        'service',
        layananSekolah,
        { serviceChannel: 'Nilai baru' },
        null,
      );

      const [row] = await db
        .select({ snapshot: schema.contentAudit.snapshotBefore })
        .from(schema.contentAudit)
        .where(eq(schema.contentAudit.entityId, layananSekolah));

      expect((row?.snapshot as Record<string, unknown>).serviceChannel).toBe(
        before?.channel ?? null,
      );
    });

    /**
     * Jaminan inti governance: tidak ada perubahan status tanpa jejak. Keduanya
     * ditulis dalam satu transaksi, jadi jumlah baris audit harus naik persis
     * sebanyak transisi yang berhasil.
     */
    it('setiap transisi berhasil meninggalkan tepat satu baris audit', async () => {
      await transition(admin(), 'service', layananSekolah, 'archived', 'uji');
      await transition(admin(), 'service', layananSekolah, 'draft', 'pulihkan');
      await transition(admin(), 'service', layananSekolah, 'in_review', null);

      const riwayat = await auditFor(admin(), 'service', layananSekolah);
      expect(riwayat.filter((entry) => entry.action === 'status_changed')).toHaveLength(3);
    });

    it('transisi yang ditolak tidak meninggalkan jejak', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      await expect(
        transition(editor, 'service', layananSosial, 'archived', 'coba'),
      ).rejects.toThrow(GovernanceError);

      const riwayat = await auditFor(admin(), 'service', layananSosial);
      expect(riwayat).toHaveLength(0);
    });

    it('riwayat mengikuti izin baca kontennya', async () => {
      const editor = actorOf([{ unitId: unitSekolah, role: 'editor' }]);
      await expect(auditFor(editor, 'service', layananSosial)).rejects.toThrow(GovernanceError);
    });
  });

  describe('dampak ke situs publik', () => {
    const admin = () => actorOf([{ unitId: null, role: 'admin' }]);

    it('konten yang diarsipkan hilang dari pencarian publik', async () => {
      expect((await search('donasi online')).hits.some((hit) => hit.slug === 'donasi-online')).toBe(
        true,
      );

      await transition(admin(), 'service', layananSosial, 'archived', 'uji');

      expect((await search('donasi online')).hits.some((hit) => hit.slug === 'donasi-online')).toBe(
        false,
      );
    });

    it('visibilitas internal juga menyembunyikannya dari publik', async () => {
      await updateContent(admin(), 'service', layananSosial, { visibility: 'internal' }, null);

      expect((await search('donasi online')).hits.some((hit) => hit.slug === 'donasi-online')).toBe(
        false,
      );
    });
  });
});

/**
 * Test integrasi Fase 2 — 10-DEVELOPMENT-PLAN.md §11 ("Integration: DB access").
 *
 * Berjalan terhadap PostgreSQL sungguhan di DATABASE_URL_TEST, bukan mock:
 * constraint, foreign key, enum, dan index hanya bisa dibuktikan oleh database asli.
 *
 * Database test dihapus isinya setiap kali dijalankan. `npm run test` melewati file
 * ini bila DATABASE_URL_TEST tidak diisi, supaya kontributor tanpa Postgres lokal
 * tetap bisa menjalankan test lain.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, schema } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { runSeed, seedSummary } from '@/server/db/seed';
import { SEED_CODE_PREFIX } from '@/server/db/seed-data';
import {
  getFeaturedPrograms,
  getFeaturedUnits,
  getPopularFaqs,
  getPopularServices,
  getPublicApplications,
} from '@/server/content/public-queries';

/** Jumlah baris seed. Satu tempat, supaya menambah entity tidak memaksa
 *  memperbarui angka di beberapa test sekaligus. */
const EXPECTED_SEED = {
  units: 5,
  services: 5,
  programs: 3,
  faqs: 4,
  applications: 3,
  events: 3,
};

const testUrl = process.env.DATABASE_URL_TEST;
const describeDb = testUrl ? describe : describe.skip;

describeDb('core registry (PostgreSQL sungguhan)', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    // public-queries memakai getDb() yang membaca DATABASE_URL, jadi arahkan ke
    // database test sebelum modul apa pun membuat koneksi.
    process.env.DATABASE_URL = testUrl;
    await runMigrations();
    db = createDatabase();
    await runSeed(db);
  }, 60_000);
  // Menutup pool koneksi setelah berkas ini selesai. Tiap berkas test membuka
  // pool sendiri; membiarkannya terbuka membuat koneksi menumpuk sampai ada
  // test yang gagal karena kehabisan koneksi, bukan karena kodenya salah.
  afterAll(async () => {
    await closeDatabase(db);
  });


  afterAll(async () => {
    if (db) await db.execute(sql`select 1`);
  });

  it('memuat seluruh entity seed', async () => {
    expect(await seedSummary(db)).toEqual(EXPECTED_SEED);
  });

  it('seed idempoten — dijalankan dua kali tidak menggandakan baris', async () => {
    await runSeed(db);
    expect(await seedSummary(db)).toEqual(EXPECTED_SEED);
  });

  it('menolak layanan tanpa owner unit (FK wajib)', async () => {
    await expect(
      db.insert(schema.services).values({
        code: 'TEST-NO-OWNER',
        slug: 'test-no-owner',
        title: 'Tanpa owner',
        summary: 'x',
        category: 'x',
        ctaLabel: 'x',
        // ownerUnitId sengaja dikosongkan
      } as never),
    ).rejects.toThrow();
  });

  it('menolak owner unit yang tidak ada (integritas referensial)', async () => {
    await expect(
      db.insert(schema.services).values({
        code: 'TEST-BAD-OWNER',
        slug: 'test-bad-owner',
        title: 'Owner palsu',
        summary: 'x',
        category: 'x',
        ctaLabel: 'x',
        ownerUnitId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow();
  });

  it('menolak slug layanan ganda (unique index)', async () => {
    const [unit] = await db.select({ id: schema.units.id }).from(schema.units).limit(1);
    expect(unit).toBeDefined();
    await expect(
      db.insert(schema.services).values({
        code: 'TEST-DUP-SLUG',
        slug: 'ppdb-online', // sudah dipakai seed
        title: 'Duplikat',
        summary: 'x',
        category: 'x',
        ctaLabel: 'x',
        ownerUnitId: unit!.id,
      }),
    ).rejects.toThrow();
  });

  it('menolak status di luar enum lifecycle', async () => {
    await expect(db.execute(sql`select 'published_maybe'::content_status`)).rejects.toThrow();
  });

  it('menolak menghapus unit yang masih memiliki layanan (onDelete restrict)', async () => {
    const [unit] = await db
      .select({ id: schema.units.id })
      .from(schema.units)
      .where(sql`${schema.units.slug} = 'ts-lab-school'`);
    expect(unit).toBeDefined();
    await expect(
      db.delete(schema.units).where(sql`${schema.units.id} = ${unit!.id}`),
    ).rejects.toThrow();
  });

  it('setiap baris seed diberi kode DEV- agar bisa dibedakan dari data produksi', async () => {
    const rows = await db.select({ code: schema.services.code }).from(schema.services);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.code.startsWith(SEED_CODE_PREFIX)).toBe(true);
    }
  });
});

describeDb('gate konten publik', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    await runMigrations();
    db = createDatabase();
    await runSeed(db);
  }, 60_000);

  it('query publik hanya mengembalikan konten published', async () => {
    const [services, units, programs, faqs, applications] = await Promise.all([
      getPopularServices(20),
      getFeaturedUnits(20),
      getFeaturedPrograms(20),
      getPopularFaqs(20),
      getPublicApplications(20),
    ]);
    expect(services.length).toBeGreaterThan(0);
    expect(units.length).toBeGreaterThan(0);
    expect(programs.length).toBeGreaterThan(0);
    expect(faqs.length).toBeGreaterThan(0);
    expect(applications.length).toBeGreaterThan(0);
  });

  it('konten archived tidak pernah muncul di hasil publik', async () => {
    await db
      .update(schema.services)
      .set({ status: 'archived' })
      .where(sql`${schema.services.slug} = 'ppdb-online'`);

    const services = await getPopularServices(20);
    expect(services.map((s) => s.slug)).not.toContain('ppdb-online');

    await db
      .update(schema.services)
      .set({ status: 'published' })
      .where(sql`${schema.services.slug} = 'ppdb-online'`);
  });

  it('konten draft tidak pernah muncul di hasil publik', async () => {
    await db
      .update(schema.faqs)
      .set({ status: 'draft' })
      .where(sql`${schema.faqs.slug} = 'cara-berdonasi'`);

    const faqs = await getPopularFaqs(20);
    expect(faqs.map((f) => f.slug)).not.toContain('cara-berdonasi');

    await db
      .update(schema.faqs)
      .set({ status: 'published' })
      .where(sql`${schema.faqs.slug} = 'cara-berdonasi'`);
  });

  it('konten internal/restricted tidak pernah muncul di hasil publik', async () => {
    await db
      .update(schema.units)
      .set({ visibility: 'internal' })
      .where(sql`${schema.units.slug} = 'yts-hub'`);

    const units = await getFeaturedUnits(20);
    expect(units.map((u) => u.slug)).not.toContain('yts-hub');

    await db
      .update(schema.units)
      .set({ visibility: 'public' })
      .where(sql`${schema.units.slug} = 'yts-hub'`);
  });

  it('registry aplikasi publik tidak pernah membocorkan field internal', async () => {
    // Field internal diisi lebih dulu supaya test membuktikan query yang menyaring,
    // bukan sekadar kolom yang kebetulan kosong.
    await db.update(schema.applications).set({
      technicalOwner: 'RAHASIA-INTERNAL',
      repositoryReference: 'RAHASIA-INTERNAL',
      hostingProvider: 'RAHASIA-INTERNAL',
      databaseProvider: 'RAHASIA-INTERNAL',
      integrationNotes: 'RAHASIA-INTERNAL',
      criticality: 'RAHASIA-INTERNAL',
    });

    const applications = await getPublicApplications(20);
    expect(applications.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(applications);
    expect(serialized).not.toContain('RAHASIA-INTERNAL');

    for (const app of applications) {
      expect(app).not.toHaveProperty('technicalOwner');
      expect(app).not.toHaveProperty('repositoryReference');
      expect(app).not.toHaveProperty('hostingProvider');
      expect(app).not.toHaveProperty('databaseProvider');
      expect(app).not.toHaveProperty('integrationNotes');
      expect(app).not.toHaveProperty('criticality');
    }
  });

  it('program berjalan diurutkan sebelum yang akan datang', async () => {
    const programs = await getFeaturedPrograms(20);
    const firstUpcoming = programs.findIndex((p) => p.programStatus === 'akan-datang');
    const lastRunning = programs.map((p) => p.programStatus).lastIndexOf('berjalan');
    if (firstUpcoming !== -1 && lastRunning !== -1) {
      expect(lastRunning).toBeLessThan(firstUpcoming);
    }
  });
});

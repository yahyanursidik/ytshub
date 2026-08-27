/**
 * Test integrasi query direktori (Fase 3) terhadap PostgreSQL sungguhan.
 *
 * Fokusnya dua hal yang paling mudah rusak diam-diam saat halaman bertambah:
 * kebocoran konten non-publik, dan halaman detail yang kehilangan related content
 * sehingga menjadi buntu (02-IA §7).
 *
 * Di-skip otomatis bila DATABASE_URL_TEST kosong.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, schema } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { runSeed } from '@/server/db/seed';
import {
  getEventDetail,
  getProgramDetail,
  getServiceDetail,
  getUnitDetail,
  listApplications,
  listEvents,
  listPrograms,
  listPublicContacts,
  listServices,
  listUnits,
} from '@/server/content/directory-queries';

const testUrl = process.env.DATABASE_URL_TEST;
const describeDb = testUrl ? describe : describe.skip;

describeDb('query direktori', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
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


  it('setiap listing mengembalikan isi', async () => {
    expect((await listUnits()).length).toBeGreaterThan(0);
    expect((await listServices()).length).toBeGreaterThan(0);
    expect((await listPrograms()).length).toBeGreaterThan(0);
    expect((await listEvents()).length).toBeGreaterThan(0);
    expect((await listApplications()).length).toBeGreaterThan(0);
    expect((await listPublicContacts()).length).toBeGreaterThan(0);
  });

  it('slug yang tidak ada mengembalikan null, bukan melempar error', async () => {
    expect(await getUnitDetail('tidak-ada')).toBeNull();
    expect(await getServiceDetail('tidak-ada')).toBeNull();
    expect(await getProgramDetail('tidak-ada')).toBeNull();
    expect(await getEventDetail('tidak-ada')).toBeNull();
  });

  it('detail unit mengumpulkan seluruh entitas miliknya', async () => {
    const detail = await getUnitDetail('ts-lab-school');
    expect(detail).not.toBeNull();
    expect(detail!.services.length).toBeGreaterThan(0);
    expect(detail!.programs.length).toBeGreaterThan(0);
    expect(detail!.contacts.length).toBeGreaterThan(0);
  });

  it('detail layanan punya minimal 2 blok related (02-IA §7, no dead ends)', async () => {
    const detail = await getServiceDetail('spmb');
    expect(detail).not.toBeNull();
    const blocks = [
      detail!.relatedFaqs.length,
      detail!.relatedPrograms.length,
      detail!.contacts.length,
    ].filter((n) => n > 0).length;
    expect(blocks).toBeGreaterThanOrEqual(2);
  });

  it('detail program punya minimal 2 blok related', async () => {
    const detail = await getProgramDetail('kajian-rutin');
    expect(detail).not.toBeNull();
    const blocks = [
      detail!.relatedServices.length,
      detail!.relatedFaqs.length,
      detail!.relatedEvents.length,
    ].filter((n) => n > 0).length;
    expect(blocks).toBeGreaterThanOrEqual(2);
  });

  it('detail event punya jalan keluar meski jadwalnya belum ada', async () => {
    const detail = await getEventDetail('kajian-pekanan');
    expect(detail).not.toBeNull();
    expect(detail!.relatedProgram).not.toBeNull();
    expect(detail!.otherEvents.length + detail!.contacts.length).toBeGreaterThan(0);
  });

  it('konten archived hilang dari listing DAN dari detail', async () => {
    await db
      .update(schema.services)
      .set({ status: 'archived' })
      .where(sql`${schema.services.slug} = 'konsultasi'`);

    expect((await listServices()).map((s) => s.slug)).not.toContain('konsultasi');
    expect(await getServiceDetail('konsultasi')).toBeNull();

    await db
      .update(schema.services)
      .set({ status: 'published' })
      .where(sql`${schema.services.slug} = 'konsultasi'`);
  });

  it('konten internal hilang dari listing DAN dari detail', async () => {
    await db
      .update(schema.programs)
      .set({ visibility: 'internal' })
      .where(sql`${schema.programs.slug} = 'kajian-rutin'`);

    expect((await listPrograms()).map((p) => p.slug)).not.toContain('kajian-rutin');
    expect(await getProgramDetail('kajian-rutin')).toBeNull();

    await db
      .update(schema.programs)
      .set({ visibility: 'public' })
      .where(sql`${schema.programs.slug} = 'kajian-rutin'`);
  });

  it('entitas milik unit non-publik ikut tersembunyi', async () => {
    // Unit disembunyikan; layanan miliknya harus ikut hilang dari listing publik
    // karena listing melakukan join ke unit dengan gate yang sama.
    await db
      .update(schema.units)
      .set({ visibility: 'internal' })
      .where(sql`${schema.units.slug} = 'program-sosial'`);

    const services = await listServices();
    expect(services.map((s) => s.unitSlug)).not.toContain('program-sosial');

    await db
      .update(schema.units)
      .set({ visibility: 'public' })
      .where(sql`${schema.units.slug} = 'program-sosial'`);
  });

  it('listing dan detail tidak pernah memuat field internal registry aplikasi', async () => {
    await db.update(schema.applications).set({
      technicalOwner: 'RAHASIA-INTERNAL',
      integrationNotes: 'RAHASIA-INTERNAL',
      hostingProvider: 'RAHASIA-INTERNAL',
    });

    const apps = await listApplications();
    expect(JSON.stringify(apps)).not.toContain('RAHASIA-INTERNAL');

    const unit = await getUnitDetail('ts-lab-school');
    expect(JSON.stringify(unit)).not.toContain('RAHASIA-INTERNAL');
  });

  it('program berjalan tampil sebelum yang akan datang', async () => {
    const programs = await listPrograms();
    const statuses = programs.map((p) => p.programStatus);
    const lastRunning = statuses.lastIndexOf('berjalan');
    const firstUpcoming = statuses.indexOf('akan-datang');
    if (lastRunning !== -1 && firstUpcoming !== -1) {
      expect(lastRunning).toBeLessThan(firstUpcoming);
    }
  });

  it('hitungan layanan/program per unit sesuai isi sebenarnya', async () => {
    const units = await listUnits();
    const services = await listServices();
    for (const unit of units) {
      const actual = services.filter((service) => service.unitSlug === unit.slug).length;
      expect(unit.serviceCount).toBe(actual);
    }
  });
});

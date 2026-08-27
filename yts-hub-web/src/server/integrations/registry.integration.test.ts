/**
 * Test integrasi read API registry (Fase 6).
 *
 * Fokusnya satu hal yang tidak boleh pernah rusak: API ini membuka core registry
 * kepada sistem lain, dan 08-INTEGRATION-AND-ROUTING.md §7 melarang endpoint
 * maupun field internal terekspos lewatnya. Sekali sebuah kolom internal ikut
 * terkirim, ia sudah tersalin ke sistem orang lain dan tidak bisa ditarik.
 *
 * Di-skip otomatis bila DATABASE_URL_TEST kosong.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, schema } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { runSeed } from '@/server/db/seed';
import { INTERNAL_APPLICATION_FIELDS } from '@/server/admin/entities';
import { readRegistry, REGISTRY_RESOURCES } from '@/server/integrations/registry';

const testUrl = process.env.DATABASE_URL_TEST;
const describeDb = testUrl ? describe : describe.skip;

const BASE = 'https://hub.example.org';

describeDb('read API registry', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    await runMigrations();
    db = createDatabase();
  }, 60_000);
  // Menutup pool koneksi setelah berkas ini selesai. Tiap berkas test membuka
  // pool sendiri; membiarkannya terbuka membuat koneksi menumpuk sampai ada
  // test yang gagal karena kehabisan koneksi, bukan karena kodenya salah.
  afterAll(async () => {
    await closeDatabase(db);
  });


  beforeEach(async () => {
    await runSeed(db);
  });

  it('setiap resource mengembalikan isi', async () => {
    for (const resource of REGISTRY_RESOURCES) {
      const rows = await readRegistry(resource, BASE);
      expect(rows.length, `resource ${resource}`).toBeGreaterThan(0);
    }
  });

  /** §3-§4: id dan code adalah referensi yang boleh disimpan sistem lain. */
  it('setiap baris membawa id canonical, code, dan URL halaman publiknya', async () => {
    for (const resource of REGISTRY_RESOURCES) {
      for (const row of await readRegistry(resource, BASE)) {
        expect(row.id, `${resource}.id`).toMatch(/^[0-9a-f-]{36}$/);
        expect(row.code, `${resource}.code`).toBeTruthy();
        expect(row.canonicalUrl.startsWith(BASE), `${resource}.canonicalUrl`).toBe(true);
      }
    }
  });

  /**
   * Inti test ini. Field internal registry aplikasi diisi penanda, lalu
   * dibuktikan tidak muncul di mana pun dalam jawaban — bukan sekadar "tidak
   * dipakai komponen", tetapi memang tidak pernah di-select.
   */
  it('field internal registry aplikasi tidak pernah ikut terkirim', async () => {
    const penanda = 'rahasiainternalyangtidakbolehkeluar';
    await db.update(schema.applications).set({
      technicalOwner: penanda,
      repositoryReference: penanda,
      hostingProvider: penanda,
      databaseProvider: penanda,
      integrationNotes: penanda,
      criticality: penanda,
    });

    const rows = await readRegistry('aplikasi', BASE);
    const serialized = JSON.stringify(rows);

    expect(serialized).not.toContain(penanda);
    for (const field of INTERNAL_APPLICATION_FIELDS) {
      expect(Object.keys(rows[0] ?? {}), `field ${field}`).not.toContain(field);
    }
  });

  it('konten draft tidak muncul di registry', async () => {
    await db
      .update(schema.services)
      .set({ status: 'draft' })
      .where(eq(schema.services.slug, 'spmb'));

    const rows = await readRegistry('layanan', BASE);
    expect(rows.some((row) => row.slug === 'spmb')).toBe(false);
  });

  it('konten internal tidak muncul di registry', async () => {
    await db
      .update(schema.services)
      .set({ visibility: 'internal' })
      .where(eq(schema.services.slug, 'spmb'));

    const rows = await readRegistry('layanan', BASE);
    expect(rows.some((row) => row.slug === 'spmb')).toBe(false);
  });

  it('konten milik unit yang tidak publik ikut tersembunyi', async () => {
    // Layanan bisa saja terbit sementara unit pemiliknya belum — hasilnya tidak
    // boleh separuh terbuka.
    await db
      .update(schema.units)
      .set({ visibility: 'internal' })
      .where(eq(schema.units.slug, 'ts-lab-school'));

    const rows = await readRegistry('layanan', BASE);
    expect(rows.some((row) => row.slug === 'spmb')).toBe(false);
  });

  it('layanan menyertakan referensi unit pemiliknya, bukan salinan namanya', async () => {
    const rows = await readRegistry('layanan', BASE);
    const row = rows[0] as Record<string, unknown>;

    // Yang diberikan adalah referensi (id + code) agar sistem lain menyimpannya
    // dan tidak menggandakan definisi unit — 08-INTEGRATION §3.
    expect(row.ownerUnitId).toBeTruthy();
    expect(row.ownerUnitCode).toBeTruthy();
  });
});

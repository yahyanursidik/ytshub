/**
 * Read API registry — 08-INTEGRATION-AND-ROUTING.md §2 (Level 2) dan §3.
 *
 * "YTS Hub/Core Registry menjadi sumber canonical untuk Unit, Division, Program,
 * Service, Website, Application. Sistem transaksional tidak perlu menggandakan
 * definisi jika bisa memakai foreign reference/canonical ID."
 *
 * Karena itu setiap baris membawa `id` (UUID canonical) dan `code`
 * (referensi terbaca manusia) — §4. Sistem lain menyimpan salah satunya, bukan
 * menyalin nama dan alamat yang akan basi begitu YTS mengubahnya.
 *
 * ## Batas yang dipegang di sini
 *
 * 1. Hanya `published` + `public`. Gate yang sama dengan halaman publik.
 * 2. Kolom dipilih eksplisit. Field internal registry aplikasi (technical owner,
 *    repository, hosting, integration notes, criticality) TIDAK PERNAH ikut —
 *    §7 melarang endpoint internal terekspos lewat registry publik, dan API
 *    yang mengembalikan seluruh baris adalah cara paling mudah melanggarnya.
 * 3. Tidak ada parameter yang bisa memperluas kolom yang dikembalikan. Bentuk
 *    jawabannya tetap, apa pun yang diminta pemanggil.
 */
import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { applications, events, programs, services, units } from '@/server/db/schema';

export type RegistryResource = 'unit' | 'layanan' | 'program' | 'event' | 'aplikasi';

export const REGISTRY_RESOURCES: RegistryResource[] = [
  'unit',
  'layanan',
  'program',
  'event',
  'aplikasi',
];

const publicOnly = (table: {
  status: Parameters<typeof eq>[0];
  visibility: Parameters<typeof eq>[0];
}) => and(eq(table.status, 'published'), eq(table.visibility, 'public'));

/** Alamat kanonik halaman publik sebuah entity, sebagai URL absolut. */
function canonical(base: string, path: string): string {
  return new URL(path, base).href;
}

/**
 * @param baseUrl origin publik situs, untuk menyusun `canonicalUrl`
 */
export async function readRegistry(resource: RegistryResource, baseUrl: string) {
  const db = getDb();

  if (resource === 'unit') {
    const rows = await db
      .select({
        id: units.id,
        code: units.code,
        slug: units.slug,
        name: units.title,
        shortName: units.shortName,
        kind: units.kind,
        summary: units.summary,
        websiteUrl: units.websiteUrl,
        updatedAt: units.updatedAt,
      })
      .from(units)
      .where(publicOnly(units))
      .orderBy(asc(units.sortOrder), asc(units.title));

    return rows.map((row) => ({
      ...row,
      canonicalUrl: canonical(baseUrl, `/unit/${row.slug}`),
    }));
  }

  if (resource === 'layanan') {
    const rows = await db
      .select({
        id: services.id,
        code: services.code,
        slug: services.slug,
        name: services.title,
        summary: services.summary,
        category: services.category,
        ctaUrl: services.ctaUrl,
        isExternal: services.isExternal,
        ownerUnitId: services.ownerUnitId,
        ownerUnitCode: units.code,
        updatedAt: services.updatedAt,
      })
      .from(services)
      .innerJoin(units, eq(services.ownerUnitId, units.id))
      .where(and(publicOnly(services), publicOnly(units)))
      .orderBy(asc(services.sortOrder), asc(services.title));

    return rows.map((row) => ({
      ...row,
      canonicalUrl: canonical(baseUrl, `/layanan/${row.slug}`),
    }));
  }

  if (resource === 'program') {
    const rows = await db
      .select({
        id: programs.id,
        code: programs.code,
        slug: programs.slug,
        name: programs.title,
        summary: programs.summary,
        category: programs.category,
        programStatus: programs.programStatus,
        startDate: programs.startDate,
        endDate: programs.endDate,
        ownerUnitId: programs.ownerUnitId,
        ownerUnitCode: units.code,
        updatedAt: programs.updatedAt,
      })
      .from(programs)
      .innerJoin(units, eq(programs.ownerUnitId, units.id))
      .where(and(publicOnly(programs), publicOnly(units)))
      .orderBy(asc(programs.sortOrder), asc(programs.title));

    return rows.map((row) => ({
      ...row,
      canonicalUrl: canonical(baseUrl, `/program/${row.slug}`),
    }));
  }

  if (resource === 'event') {
    const rows = await db
      .select({
        id: events.id,
        code: events.code,
        slug: events.slug,
        name: events.title,
        summary: events.summary,
        format: events.format,
        startAt: events.startAt,
        endAt: events.endAt,
        location: events.location,
        registrationUrl: events.registrationUrl,
        organizerUnitId: events.organizerUnitId,
        organizerUnitCode: units.code,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .innerJoin(units, eq(events.organizerUnitId, units.id))
      .where(and(publicOnly(events), publicOnly(units)))
      .orderBy(asc(events.startAt), asc(events.title));

    return rows.map((row) => ({
      ...row,
      canonicalUrl: canonical(baseUrl, `/event/${row.slug}`),
    }));
  }

  /**
   * Registry aplikasi. Perhatikan kolom yang TIDAK ada: technicalOwner,
   * repositoryReference, hostingProvider, databaseProvider, integrationNotes,
   * criticality. Itu disengaja dan dijaga oleh test — 06-CONTENT-MODEL §8
   * dan 08-INTEGRATION §7.
   */
  const rows = await db
    .select({
      id: applications.id,
      code: applications.code,
      slug: applications.slug,
      name: applications.name,
      summary: applications.summary,
      kind: applications.kind,
      url: applications.url,
      ownerUnitId: applications.ownerUnitId,
      ownerUnitCode: units.code,
      updatedAt: applications.updatedAt,
    })
    .from(applications)
    .innerJoin(units, eq(applications.ownerUnitId, units.id))
    .where(and(publicOnly(applications), publicOnly(units)))
    .orderBy(asc(applications.sortOrder), asc(applications.name));

  return rows.map((row) => ({
    ...row,
    canonicalUrl: canonical(baseUrl, `/aplikasi#${row.slug}`),
  }));
}

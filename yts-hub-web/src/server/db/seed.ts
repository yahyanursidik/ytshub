/**
 * Mengisi database dengan dua lapis data yang sengaja dibedakan:
 *
 * 1. DATA RESMI (official-data.ts, berkode `YTS-`) — unit yayasan dan registry
 *    sistemnya. Nama dan alamatnya diberikan pengurus, jadi ini informasi
 *    sungguhan. Dimuat dengan upsert dan TIDAK PERNAH dihapus `clearSeed`.
 * 2. DATA PENGEMBANGAN (seed-data.ts, berkode `DEV-`) — layanan, program, FAQ,
 *    event, dan kontak yang isinya masih placeholder. Dihapus dan dimuat ulang
 *    setiap kali, dan bisa dibuang seluruhnya lewat `db:seed:clear`.
 *
 * Pembedaan ini yang membuat `db:seed:clear` aman dijalankan saat konten asli
 * mulai masuk: yang hilang hanya contohnya, bukan registry sistem YTS.
 *
 * Keduanya idempoten — dijalankan berulang menghasilkan keadaan yang sama, dan
 * tidak pernah menimpa baris yang dibuat pengelola lewat admin.
 */
import { inArray, like, sql } from 'drizzle-orm';

import { schema, type Database } from '@/server/db/client';
import { nextReviewDate } from '@/server/auth/roles';
import {
  OFFICIAL_CODE_PREFIX,
  officialApplications,
  officialUnits,
} from '@/server/db/official-data';
import {
  SEED_CODE_PREFIX,
  seedAudiences,
  seedContacts,
  seedEvents,
  seedFaqCategories,
  seedFaqs,
  seedPrograms,
  seedServices,
} from '@/server/db/seed-data';

type Db = Database;

const devCode = `${SEED_CODE_PREFIX}%`;
const officialCode = `${OFFICIAL_CODE_PREFIX}%`;
const publishedAt = new Date('2026-01-01T00:00:00.000Z');

/** Menghapus seluruh baris seed pengembangan. Tidak menyentuh data non-DEV. */
export async function clearSeed(db: Db): Promise<void> {
  // Urutan penting: tabel penghubung dulu, lalu entity, lalu unit.
  const devServices = await db
    .select({ id: schema.services.id })
    .from(schema.services)
    .where(like(schema.services.code, devCode));
  const devPrograms = await db
    .select({ id: schema.programs.id })
    .from(schema.programs)
    .where(like(schema.programs.code, devCode));
  const devFaqs = await db
    .select({ id: schema.faqs.id })
    .from(schema.faqs)
    .where(like(schema.faqs.code, devCode));

  const serviceIds = devServices.map((row) => row.id);
  const programIds = devPrograms.map((row) => row.id);
  const faqIds = devFaqs.map((row) => row.id);

  if (faqIds.length) {
    await db.delete(schema.faqsToServices).where(inArray(schema.faqsToServices.faqId, faqIds));
    await db.delete(schema.faqsToPrograms).where(inArray(schema.faqsToPrograms.faqId, faqIds));
  }
  if (programIds.length) {
    await db
      .delete(schema.programsToServices)
      .where(inArray(schema.programsToServices.programId, programIds));
    await db
      .delete(schema.programsToAudiences)
      .where(inArray(schema.programsToAudiences.programId, programIds));
  }
  if (serviceIds.length) {
    await db
      .delete(schema.servicesToAudiences)
      .where(inArray(schema.servicesToAudiences.serviceId, serviceIds));
  }

  await db.delete(schema.contacts).where(like(schema.contacts.code, devCode));
  await db.delete(schema.faqs).where(like(schema.faqs.code, devCode));
  await db.delete(schema.events).where(like(schema.events.code, devCode));
  await db.delete(schema.programs).where(like(schema.programs.code, devCode));
  await db.delete(schema.services).where(like(schema.services.code, devCode));
  await db.delete(schema.applications).where(like(schema.applications.code, devCode));

  // Unit TIDAK dihapus di sini. Sejak Fase 6 unit adalah data resmi berkode
  // `YTS-`; `db:seed:clear` hanya membuang contoh, bukan registry yayasan.
  await db.delete(schema.units).where(like(schema.units.code, devCode));
}

export async function runSeed(db: Db): Promise<void> {
  await clearSeed(db);

  // ---- referensi ----
  await db.insert(schema.audiences).values(seedAudiences).onConflictDoNothing();
  await db.insert(schema.faqCategories).values(seedFaqCategories).onConflictDoNothing();

  const audienceRows = await db
    .select({ id: schema.audiences.id, slug: schema.audiences.slug })
    .from(schema.audiences);
  const audienceIdBySlug = new Map(audienceRows.map((row) => [row.slug, row.id]));

  const categoryRows = await db
    .select({ id: schema.faqCategories.id, slug: schema.faqCategories.slug })
    .from(schema.faqCategories);
  const categoryIdBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));

  // ---- unit: DATA RESMI ----
  //
  // Upsert berdasarkan `code`, bukan hapus-lalu-masukkan. Unit resmi dirujuk
  // audit log, penugasan peran, dan konten yang dibuat pengelola; menghapusnya
  // tiap kali seed berjalan akan memutus seluruh rujukan itu.
  await db
    .insert(schema.units)
    .values(
      officialUnits.map((unit) => ({
        ...unit,
        status: 'published' as const,
        visibility: 'public' as const,
        publishedAt,
        reviewedAt: publishedAt,
        reviewDueAt: nextReviewDate('unit', publishedAt),
      })),
    )
    .onConflictDoUpdate({
      target: schema.units.code,
      set: {
        slug: sql`excluded.slug`,
        title: sql`excluded.title`,
        shortName: sql`excluded.short_name`,
        kind: sql`excluded.kind`,
        summary: sql`excluded.summary`,
        websiteUrl: sql`excluded.website_url`,
        sortOrder: sql`excluded.sort_order`,
        // Status dan visibilitas IKUT dipulihkan. `db:seed` menyatakan keadaan
        // kanonik data resmi; tanpa dua kolom ini, unit yang pernah diarsipkan
        // atau dijadikan internal tidak akan pernah kembali terbit meski seed
        // dijalankan ulang — dan perintah yang tidak bisa memulihkan keadaan
        // yang dinyatakannya bukan perintah yang idempoten.
        status: sql`excluded.status`,
        visibility: sql`excluded.visibility`,
        reviewDueAt: sql`excluded.review_due_at`,
        updatedAt: new Date(),
      },
    });

  const unitRows = await db
    .select({ id: schema.units.id, slug: schema.units.slug })
    .from(schema.units);
  const unitIdBySlug = new Map(unitRows.map((row) => [row.slug, row.id]));

  const requireUnit = (slug: string): string => {
    const id = unitIdBySlug.get(slug);
    if (!id) throw new Error(`Seed rusak: unit "${slug}" tidak ditemukan.`);
    return id;
  };

  // ---- services ----
  const serviceRows = await db
    .insert(schema.services)
    .values(
      seedServices.map((service) => ({
        code: service.code,
        slug: service.slug,
        title: service.title,
        summary: service.summary,
        category: service.category,
        ownerUnitId: requireUnit(service.ownerUnitSlug),
        requirements: service.requirements,
        processSteps: service.processSteps,
        feeInformation: service.feeInformation,
        ctaLabel: service.ctaLabel,
        ctaUrl: service.ctaUrl,
        isExternal: service.isExternal,
        isPopular: service.isPopular,
        sortOrder: service.sortOrder,
        status: 'published' as const,
        visibility: 'public' as const,
        publishedAt,
        reviewedAt: publishedAt,
        reviewDueAt: nextReviewDate('service', publishedAt),
      })),
    )
    .returning({ id: schema.services.id, slug: schema.services.slug });
  const serviceIdBySlug = new Map(serviceRows.map((row) => [row.slug, row.id]));

  const serviceAudienceLinks = seedServices.flatMap((service) =>
    service.audienceSlugs.flatMap((slug) => {
      const audienceId = audienceIdBySlug.get(slug);
      const serviceId = serviceIdBySlug.get(service.slug);
      return audienceId && serviceId ? [{ serviceId, audienceId }] : [];
    }),
  );
  if (serviceAudienceLinks.length) {
    await db.insert(schema.servicesToAudiences).values(serviceAudienceLinks).onConflictDoNothing();
  }

  // ---- programs ----
  const programRows = await db
    .insert(schema.programs)
    .values(
      seedPrograms.map((program) => ({
        code: program.code,
        slug: program.slug,
        title: program.title,
        summary: program.summary,
        category: program.category,
        ownerUnitId: requireUnit(program.ownerUnitSlug),
        programStatus: program.programStatus,
        scheduleSummary: program.scheduleSummary,
        locationSummary: program.locationSummary,
        isFeatured: program.isFeatured,
        sortOrder: program.sortOrder,
        status: 'published' as const,
        visibility: 'public' as const,
        publishedAt,
        reviewedAt: publishedAt,
        reviewDueAt: nextReviewDate('program', publishedAt),
      })),
    )
    .returning({ id: schema.programs.id, slug: schema.programs.slug });
  const programIdBySlug = new Map(programRows.map((row) => [row.slug, row.id]));

  const programAudienceLinks = seedPrograms.flatMap((program) =>
    program.audienceSlugs.flatMap((slug) => {
      const audienceId = audienceIdBySlug.get(slug);
      const programId = programIdBySlug.get(program.slug);
      return audienceId && programId ? [{ programId, audienceId }] : [];
    }),
  );
  if (programAudienceLinks.length) {
    await db.insert(schema.programsToAudiences).values(programAudienceLinks).onConflictDoNothing();
  }

  const programServiceLinks = seedPrograms.flatMap((program) =>
    program.relatedServiceSlugs.flatMap((slug) => {
      const serviceId = serviceIdBySlug.get(slug);
      const programId = programIdBySlug.get(program.slug);
      return serviceId && programId ? [{ programId, serviceId }] : [];
    }),
  );
  if (programServiceLinks.length) {
    await db.insert(schema.programsToServices).values(programServiceLinks).onConflictDoNothing();
  }

  // ---- faqs ----
  const faqRows = await db
    .insert(schema.faqs)
    .values(
      seedFaqs.map((faq) => {
        const categoryId = categoryIdBySlug.get(faq.categorySlug);
        if (!categoryId) throw new Error(`Seed rusak: kategori FAQ "${faq.categorySlug}" hilang.`);
        return {
          code: faq.code,
          slug: faq.slug,
          title: faq.question,
          question: faq.question,
          answer: faq.answer,
          summary: faq.summary,
          categoryId,
          ownerUnitId: requireUnit(faq.ownerUnitSlug),
          keywords: faq.keywords,
          isPopular: faq.isPopular,
          sortOrder: faq.sortOrder,
          status: 'published' as const,
          visibility: 'public' as const,
          publishedAt,
          reviewedAt: publishedAt,
          reviewDueAt: nextReviewDate('faq', publishedAt),
        };
      }),
    )
    .returning({ id: schema.faqs.id, slug: schema.faqs.slug });
  const faqIdBySlug = new Map(faqRows.map((row) => [row.slug, row.id]));

  const faqServiceLinks = seedFaqs.flatMap((faq) =>
    faq.relatedServiceSlugs.flatMap((slug) => {
      const serviceId = serviceIdBySlug.get(slug);
      const faqId = faqIdBySlug.get(faq.slug);
      return serviceId && faqId ? [{ faqId, serviceId }] : [];
    }),
  );
  if (faqServiceLinks.length) {
    await db.insert(schema.faqsToServices).values(faqServiceLinks).onConflictDoNothing();
  }

  const faqProgramLinks = seedFaqs.flatMap((faq) =>
    faq.relatedProgramSlugs.flatMap((slug) => {
      const programId = programIdBySlug.get(slug);
      const faqId = faqIdBySlug.get(faq.slug);
      return programId && faqId ? [{ faqId, programId }] : [];
    }),
  );
  if (faqProgramLinks.length) {
    await db.insert(schema.faqsToPrograms).values(faqProgramLinks).onConflictDoNothing();
  }

  // ---- events ----
  await db.insert(schema.events).values(
    seedEvents.map((event) => {
      const relatedProgramId = event.relatedProgramSlug
        ? (programIdBySlug.get(event.relatedProgramSlug) ?? null)
        : null;
      return {
        code: event.code,
        slug: event.slug,
        title: event.title,
        summary: event.summary,
        organizerUnitId: requireUnit(event.organizerUnitSlug),
        format: event.format,
        location: event.location,
        speakerSummary: event.speakerSummary,
        relatedProgramId,
        status: 'published' as const,
        visibility: 'public' as const,
        publishedAt,
        reviewedAt: publishedAt,
        reviewDueAt: nextReviewDate('event', publishedAt),
      };
    }),
  );

  // ---- contacts ----
  await db.insert(schema.contacts).values(
    seedContacts.map((contact) => ({
      code: contact.code,
      ownerUnitId: requireUnit(contact.ownerUnitSlug),
      label: contact.label,
      channel: contact.channel,
      value: contact.value,
      note: contact.note,
      isPublic: true,
    })),
  );

  // ---- registry aplikasi & website: DATA RESMI ----
  //
  // Upsert, sama seperti unit. `clearSeed` tidak menghapusnya karena berkode
  // `YTS-`, jadi insert biasa akan gagal pada pemuatan kedua — dan yang gagal
  // bukan hanya baris itu, melainkan seluruh seed.
  await db
    .insert(schema.applications)
    .values(
      officialApplications.map((app) => ({
        code: app.code,
        slug: app.slug,
        title: app.title,
        name: app.name,
        summary: app.summary,
        kind: app.kind,
        ownerUnitId: requireUnit(app.ownerUnitSlug),
        url: app.url,
        ctaLabel: app.ctaLabel,
        sortOrder: app.sortOrder,
        status: 'published' as const,
        visibility: 'public' as const,
        publishedAt,
        reviewedAt: publishedAt,
        reviewDueAt: nextReviewDate('application', publishedAt),
      })),
    )
    .onConflictDoUpdate({
      target: schema.applications.code,
      set: {
        slug: sql`excluded.slug`,
        title: sql`excluded.title`,
        name: sql`excluded.name`,
        summary: sql`excluded.summary`,
        kind: sql`excluded.kind`,
        ownerUnitId: sql`excluded.owner_unit_id`,
        url: sql`excluded.url`,
        ctaLabel: sql`excluded.cta_label`,
        sortOrder: sql`excluded.sort_order`,
        status: sql`excluded.status`,
        visibility: sql`excluded.visibility`,
        reviewDueAt: sql`excluded.review_due_at`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Ringkasan untuk output CLI dan assertion di test.
 *
 * Unit dan registry aplikasi dihitung dengan prefix `YTS-` karena keduanya kini
 * data resmi; sisanya tetap dihitung dengan `DEV-`. Menghitung semuanya dengan
 * satu prefix akan melaporkan nol unit dan membuat orang mengira seed gagal.
 */
export async function seedSummary(db: Db) {
  const [units, services, programs, faqs, applications, events] = await Promise.all([
    db
      .select({ id: schema.units.id })
      .from(schema.units)
      .where(like(schema.units.code, officialCode)),
    db
      .select({ id: schema.services.id })
      .from(schema.services)
      .where(like(schema.services.code, devCode)),
    db
      .select({ id: schema.programs.id })
      .from(schema.programs)
      .where(like(schema.programs.code, devCode)),
    db.select({ id: schema.faqs.id }).from(schema.faqs).where(like(schema.faqs.code, devCode)),
    db
      .select({ id: schema.applications.id })
      .from(schema.applications)
      .where(like(schema.applications.code, officialCode)),
    db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(like(schema.events.code, devCode)),
  ]);

  return {
    units: units.length,
    services: services.length,
    programs: programs.length,
    faqs: faqs.length,
    applications: applications.length,
    events: events.length,
  };
}

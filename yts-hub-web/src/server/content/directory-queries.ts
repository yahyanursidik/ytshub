/**
 * Query untuk halaman direktori publik (Fase 3).
 *
 * Aturan yang sama seperti public-queries.ts berlaku penuh:
 * hanya `published` + `public`, kolom dipilih eksplisit, tidak ada field internal.
 * Gate-nya diimpor dari sana supaya definisinya tetap satu.
 *
 * Setiap detail mengembalikan `related` — 02-IA §7 mewajibkan minimal 2 dari 4 blok
 * (FAQ terkait, layanan terkait, program terkait, kontak/next action) agar tidak ada
 * halaman buntu.
 */
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import {
  applications,
  audiences,
  contacts,
  events,
  faqCategories,
  faqs,
  faqsToPrograms,
  faqsToServices,
  programs,
  programsToAudiences,
  programsToServices,
  services,
  servicesToAudiences,
  units,
} from '@/server/db/schema';

/** Sama dengan gate di public-queries.ts. Didefinisikan sekali, dipakai semua query. */
const publicOnly = (table: {
  status: Parameters<typeof eq>[0];
  visibility: Parameters<typeof eq>[0];
}) => and(eq(table.status, 'published'), eq(table.visibility, 'public'));

/* ================================================================== units */

export async function listUnits() {
  const db = getDb();
  const rows = await db
    .select({
      id: units.id,
      slug: units.slug,
      title: units.title,
      shortName: units.shortName,
      kind: units.kind,
      summary: units.summary,
    })
    .from(units)
    .where(publicOnly(units))
    .orderBy(asc(units.sortOrder), asc(units.title));

  // Jumlah layanan & program per unit — membantu pengguna memilih, bukan angka hiasan.
  const counts = await db
    .select({
      unitId: services.ownerUnitId,
      n: sql<number>`count(*)::int`,
    })
    .from(services)
    .where(publicOnly(services))
    .groupBy(services.ownerUnitId);
  const serviceCount = new Map(counts.map((row) => [row.unitId, row.n]));

  const programCounts = await db
    .select({ unitId: programs.ownerUnitId, n: sql<number>`count(*)::int` })
    .from(programs)
    .where(publicOnly(programs))
    .groupBy(programs.ownerUnitId);
  const programCount = new Map(programCounts.map((row) => [row.unitId, row.n]));

  return rows.map((unit) => ({
    ...unit,
    serviceCount: serviceCount.get(unit.id) ?? 0,
    programCount: programCount.get(unit.id) ?? 0,
  }));
}

export type UnitListItem = Awaited<ReturnType<typeof listUnits>>[number];

export async function getUnitDetail(slug: string) {
  const db = getDb();
  const [unit] = await db
    .select({
      id: units.id,
      slug: units.slug,
      code: units.code,
      title: units.title,
      shortName: units.shortName,
      kind: units.kind,
      summary: units.summary,
      about: units.about,
      websiteUrl: units.websiteUrl,
      seoTitle: units.seoTitle,
      seoDescription: units.seoDescription,
      updatedAt: units.updatedAt,
    })
    .from(units)
    .where(and(publicOnly(units), eq(units.slug, slug)))
    .limit(1);

  if (!unit) return null;

  const [unitServices, unitPrograms, unitEvents, unitFaqs, unitApps, unitContacts] =
    await Promise.all([
      db
        .select({
          slug: services.slug,
          title: services.title,
          summary: services.summary,
          category: services.category,
        })
        .from(services)
        .where(and(publicOnly(services), eq(services.ownerUnitId, unit.id)))
        .orderBy(asc(services.sortOrder), asc(services.title)),
      db
        .select({
          slug: programs.slug,
          title: programs.title,
          summary: programs.summary,
          programStatus: programs.programStatus,
        })
        .from(programs)
        .where(and(publicOnly(programs), eq(programs.ownerUnitId, unit.id)))
        .orderBy(asc(programs.sortOrder), asc(programs.title)),
      db
        .select({ slug: events.slug, title: events.title, format: events.format })
        .from(events)
        .where(and(publicOnly(events), eq(events.organizerUnitId, unit.id)))
        .orderBy(asc(events.title)),
      db
        .select({ slug: faqs.slug, question: faqs.question })
        .from(faqs)
        .where(and(publicOnly(faqs), eq(faqs.ownerUnitId, unit.id)))
        .orderBy(asc(faqs.sortOrder), asc(faqs.question)),
      db
        .select({
          slug: applications.slug,
          name: applications.name,
          kind: applications.kind,
          url: applications.url,
        })
        .from(applications)
        .where(and(publicOnly(applications), eq(applications.ownerUnitId, unit.id)))
        .orderBy(asc(applications.sortOrder), asc(applications.name)),
      db
        .select({
          label: contacts.label,
          channel: contacts.channel,
          value: contacts.value,
          note: contacts.note,
        })
        .from(contacts)
        .where(and(eq(contacts.ownerUnitId, unit.id), eq(contacts.isPublic, true)))
        .orderBy(asc(contacts.label)),
    ]);

  return {
    unit,
    services: unitServices,
    programs: unitPrograms,
    events: unitEvents,
    faqs: unitFaqs,
    applications: unitApps,
    contacts: unitContacts,
  };
}

export type UnitDetail = NonNullable<Awaited<ReturnType<typeof getUnitDetail>>>;

/* =============================================================== services */

export async function listServices() {
  const db = getDb();
  const rows = await db
    .select({
      id: services.id,
      slug: services.slug,
      title: services.title,
      summary: services.summary,
      category: services.category,
      ctaLabel: services.ctaLabel,
      ctaUrl: services.ctaUrl,
      isExternal: services.isExternal,
      unitSlug: units.slug,
      unitName: units.shortName,
    })
    .from(services)
    .innerJoin(units, eq(services.ownerUnitId, units.id))
    .where(and(publicOnly(services), publicOnly(units)))
    .orderBy(asc(services.sortOrder), asc(services.title));

  const audienceRows = await db
    .select({
      serviceId: servicesToAudiences.serviceId,
      slug: audiences.slug,
      label: audiences.label,
    })
    .from(servicesToAudiences)
    .innerJoin(audiences, eq(servicesToAudiences.audienceId, audiences.id));

  const byService = new Map<string, { slug: string; label: string }[]>();
  for (const row of audienceRows) {
    const list = byService.get(row.serviceId) ?? [];
    list.push({ slug: row.slug, label: row.label });
    byService.set(row.serviceId, list);
  }

  return rows.map((service) => ({ ...service, audiences: byService.get(service.id) ?? [] }));
}

export type ServiceListItem = Awaited<ReturnType<typeof listServices>>[number];

export async function getServiceDetail(slug: string) {
  const db = getDb();
  const [service] = await db
    .select({
      id: services.id,
      slug: services.slug,
      code: services.code,
      title: services.title,
      summary: services.summary,
      description: services.description,
      category: services.category,
      requirements: services.requirements,
      processSteps: services.processSteps,
      feeInformation: services.feeInformation,
      serviceChannel: services.serviceChannel,
      ctaLabel: services.ctaLabel,
      ctaUrl: services.ctaUrl,
      isExternal: services.isExternal,
      seoTitle: services.seoTitle,
      seoDescription: services.seoDescription,
      updatedAt: services.updatedAt,
      unitSlug: units.slug,
      unitName: units.shortName,
      unitTitle: units.title,
    })
    .from(services)
    .innerJoin(units, eq(services.ownerUnitId, units.id))
    .where(and(publicOnly(services), publicOnly(units), eq(services.slug, slug)))
    .limit(1);

  if (!service) return null;

  const [serviceAudiences, relatedFaqs, relatedPrograms, unitContacts] = await Promise.all([
    db
      .select({ slug: audiences.slug, label: audiences.label })
      .from(servicesToAudiences)
      .innerJoin(audiences, eq(servicesToAudiences.audienceId, audiences.id))
      .where(eq(servicesToAudiences.serviceId, service.id))
      .orderBy(asc(audiences.label)),
    db
      .select({ slug: faqs.slug, question: faqs.question, summary: faqs.summary })
      .from(faqsToServices)
      .innerJoin(faqs, eq(faqsToServices.faqId, faqs.id))
      .where(and(publicOnly(faqs), eq(faqsToServices.serviceId, service.id)))
      .orderBy(asc(faqs.sortOrder)),
    db
      .select({ slug: programs.slug, title: programs.title, summary: programs.summary })
      .from(programsToServices)
      .innerJoin(programs, eq(programsToServices.programId, programs.id))
      .where(and(publicOnly(programs), eq(programsToServices.serviceId, service.id)))
      .orderBy(asc(programs.sortOrder)),
    db
      .select({ label: contacts.label, channel: contacts.channel, value: contacts.value })
      .from(contacts)
      .innerJoin(units, eq(contacts.ownerUnitId, units.id))
      .where(and(eq(units.slug, service.unitSlug), eq(contacts.isPublic, true)))
      .orderBy(asc(contacts.label)),
  ]);

  return {
    service,
    audiences: serviceAudiences,
    relatedFaqs,
    relatedPrograms,
    contacts: unitContacts,
  };
}

export type ServiceDetail = NonNullable<Awaited<ReturnType<typeof getServiceDetail>>>;

/* =============================================================== programs */

export async function listPrograms() {
  const db = getDb();
  const rows = await db
    .select({
      id: programs.id,
      slug: programs.slug,
      title: programs.title,
      summary: programs.summary,
      category: programs.category,
      programStatus: programs.programStatus,
      scheduleSummary: programs.scheduleSummary,
      unitSlug: units.slug,
      unitName: units.shortName,
    })
    .from(programs)
    .innerJoin(units, eq(programs.ownerUnitId, units.id))
    .where(and(publicOnly(programs), publicOnly(units)))
    .orderBy(
      sql`case ${programs.programStatus} when 'berjalan' then 0 when 'akan-datang' then 1 else 2 end`,
      asc(programs.sortOrder),
      asc(programs.title),
    );

  const audienceRows = await db
    .select({
      programId: programsToAudiences.programId,
      slug: audiences.slug,
      label: audiences.label,
    })
    .from(programsToAudiences)
    .innerJoin(audiences, eq(programsToAudiences.audienceId, audiences.id));

  const byProgram = new Map<string, { slug: string; label: string }[]>();
  for (const row of audienceRows) {
    const list = byProgram.get(row.programId) ?? [];
    list.push({ slug: row.slug, label: row.label });
    byProgram.set(row.programId, list);
  }

  return rows.map((program) => ({ ...program, audiences: byProgram.get(program.id) ?? [] }));
}

export type ProgramListItem = Awaited<ReturnType<typeof listPrograms>>[number];

export async function getProgramDetail(slug: string) {
  const db = getDb();
  const [program] = await db
    .select({
      id: programs.id,
      slug: programs.slug,
      code: programs.code,
      title: programs.title,
      summary: programs.summary,
      description: programs.description,
      category: programs.category,
      programStatus: programs.programStatus,
      scheduleSummary: programs.scheduleSummary,
      locationSummary: programs.locationSummary,
      ctaLabel: programs.ctaLabel,
      ctaUrl: programs.ctaUrl,
      seoTitle: programs.seoTitle,
      seoDescription: programs.seoDescription,
      updatedAt: programs.updatedAt,
      unitSlug: units.slug,
      unitName: units.shortName,
      unitTitle: units.title,
    })
    .from(programs)
    .innerJoin(units, eq(programs.ownerUnitId, units.id))
    .where(and(publicOnly(programs), publicOnly(units), eq(programs.slug, slug)))
    .limit(1);

  if (!program) return null;

  const [programAudiences, relatedServices, relatedFaqs, relatedEvents] = await Promise.all([
    db
      .select({ slug: audiences.slug, label: audiences.label })
      .from(programsToAudiences)
      .innerJoin(audiences, eq(programsToAudiences.audienceId, audiences.id))
      .where(eq(programsToAudiences.programId, program.id))
      .orderBy(asc(audiences.label)),
    db
      .select({
        slug: services.slug,
        title: services.title,
        summary: services.summary,
        ctaLabel: services.ctaLabel,
        ctaUrl: services.ctaUrl,
        isExternal: services.isExternal,
      })
      .from(programsToServices)
      .innerJoin(services, eq(programsToServices.serviceId, services.id))
      .where(and(publicOnly(services), eq(programsToServices.programId, program.id)))
      .orderBy(asc(services.sortOrder)),
    db
      .select({ slug: faqs.slug, question: faqs.question, summary: faqs.summary })
      .from(faqsToPrograms)
      .innerJoin(faqs, eq(faqsToPrograms.faqId, faqs.id))
      .where(and(publicOnly(faqs), eq(faqsToPrograms.programId, program.id)))
      .orderBy(asc(faqs.sortOrder)),
    db
      .select({ slug: events.slug, title: events.title, format: events.format })
      .from(events)
      .where(and(publicOnly(events), eq(events.relatedProgramId, program.id)))
      .orderBy(asc(events.title)),
  ]);

  return { program, audiences: programAudiences, relatedServices, relatedFaqs, relatedEvents };
}

export type ProgramDetail = NonNullable<Awaited<ReturnType<typeof getProgramDetail>>>;

/* ================================================================= events */

export async function listEvents() {
  return getDb()
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      summary: events.summary,
      format: events.format,
      startAt: events.startAt,
      location: events.location,
      unitSlug: units.slug,
      unitName: units.shortName,
    })
    .from(events)
    .innerJoin(units, eq(events.organizerUnitId, units.id))
    .where(and(publicOnly(events), publicOnly(units)))
    .orderBy(asc(events.startAt), asc(events.title));
}

export type EventListItem = Awaited<ReturnType<typeof listEvents>>[number];

export async function getEventDetail(slug: string) {
  const db = getDb();
  const [event] = await db
    .select({
      id: events.id,
      slug: events.slug,
      code: events.code,
      title: events.title,
      summary: events.summary,
      description: events.description,
      format: events.format,
      startAt: events.startAt,
      endAt: events.endAt,
      location: events.location,
      mapUrl: events.mapUrl,
      speakerSummary: events.speakerSummary,
      registrationUrl: events.registrationUrl,
      relatedProgramId: events.relatedProgramId,
      seoTitle: events.seoTitle,
      seoDescription: events.seoDescription,
      updatedAt: events.updatedAt,
      unitSlug: units.slug,
      unitName: units.shortName,
      unitTitle: units.title,
    })
    .from(events)
    .innerJoin(units, eq(events.organizerUnitId, units.id))
    .where(and(publicOnly(events), publicOnly(units), eq(events.slug, slug)))
    .limit(1);

  if (!event) return null;

  const relatedProgram = event.relatedProgramId
    ? ((
        await db
          .select({ slug: programs.slug, title: programs.title, summary: programs.summary })
          .from(programs)
          .where(and(publicOnly(programs), eq(programs.id, event.relatedProgramId)))
          .limit(1)
      )[0] ?? null)
    : null;

  const otherEvents = await db
    .select({ slug: events.slug, title: events.title, format: events.format })
    .from(events)
    .where(and(publicOnly(events), ne(events.id, event.id)))
    .orderBy(asc(events.title))
    .limit(3);

  const unitContacts = await db
    .select({ label: contacts.label, channel: contacts.channel, value: contacts.value })
    .from(contacts)
    .innerJoin(units, eq(contacts.ownerUnitId, units.id))
    .where(and(eq(units.slug, event.unitSlug), eq(contacts.isPublic, true)))
    .orderBy(asc(contacts.label));

  return { event, relatedProgram, otherEvents, contacts: unitContacts };
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;

/* =========================================================== applications */

export async function listApplications() {
  return getDb()
    .select({
      id: applications.id,
      slug: applications.slug,
      name: applications.name,
      summary: applications.summary,
      kind: applications.kind,
      url: applications.url,
      ctaLabel: applications.ctaLabel,
      linkHealth: applications.linkHealth,
      unitSlug: units.slug,
      unitName: units.shortName,
    })
    .from(applications)
    .innerJoin(units, eq(applications.ownerUnitId, units.id))
    .where(and(publicOnly(applications), publicOnly(units)))
    .orderBy(asc(applications.sortOrder), asc(applications.name));
}

export type ApplicationListItem = Awaited<ReturnType<typeof listApplications>>[number];

/* =================================================================== faqs */

export async function listFaqCategories() {
  return getDb()
    .select({
      slug: faqCategories.slug,
      label: faqCategories.label,
      summary: faqCategories.summary,
    })
    .from(faqCategories)
    .orderBy(asc(faqCategories.label));
}

/**
 * Daftar FAQ untuk FAQ Center — 07-SEARCH-AND-FAQ.md §8.
 *
 * "FAQ adalah knowledge entity, bukan hardcoded accordion di landing page":
 * yang dikembalikan di sini adalah entity penuh dengan kategori dan unit
 * pemiliknya, supaya halaman /faq bisa menyaring keduanya.
 */
export async function listFaqs() {
  return getDb()
    .select({
      slug: faqs.slug,
      question: faqs.question,
      summary: faqs.summary,
      categorySlug: faqCategories.slug,
      categoryLabel: faqCategories.label,
      unitSlug: units.slug,
      unitName: units.shortName,
      helpfulYes: faqs.helpfulYes,
      isPopular: faqs.isPopular,
    })
    .from(faqs)
    .innerJoin(faqCategories, eq(faqs.categoryId, faqCategories.id))
    .innerJoin(units, eq(faqs.ownerUnitId, units.id))
    .where(and(publicOnly(faqs), publicOnly(units)))
    // Urutan pengelola dulu, lalu kebermanfaatan — sinyal yang sama dengan
    // peringkat search (07-SEARCH §4 butir 4), supaya daftar dan hasil pencarian
    // tidak memberi kesan prioritas yang berbeda.
    .orderBy(asc(faqs.sortOrder), desc(faqs.helpfulYes), asc(faqs.question));
}

export type FaqListItem = Awaited<ReturnType<typeof listFaqs>>[number];

/**
 * Detail FAQ — 07-SEARCH-AND-FAQ.md §9.
 *
 * `reviewedAt` ikut dikembalikan karena §9 meminta "updated/reviewed date bila
 * relevan": untuk FAQ, kapan jawabannya terakhir ditinjau adalah bagian dari
 * jawabannya sendiri.
 */
export async function getFaqDetail(slug: string) {
  const db = getDb();
  const [faq] = await db
    .select({
      id: faqs.id,
      slug: faqs.slug,
      code: faqs.code,
      question: faqs.question,
      answer: faqs.answer,
      summary: faqs.summary,
      seoTitle: faqs.seoTitle,
      seoDescription: faqs.seoDescription,
      updatedAt: faqs.updatedAt,
      reviewedAt: faqs.reviewedAt,
      helpfulYes: faqs.helpfulYes,
      helpfulNo: faqs.helpfulNo,
      categorySlug: faqCategories.slug,
      categoryLabel: faqCategories.label,
      unitSlug: units.slug,
      unitName: units.shortName,
      unitTitle: units.title,
    })
    .from(faqs)
    .innerJoin(faqCategories, eq(faqs.categoryId, faqCategories.id))
    .innerJoin(units, eq(faqs.ownerUnitId, units.id))
    .where(and(publicOnly(faqs), publicOnly(units), eq(faqs.slug, slug)))
    .limit(1);

  if (!faq) return null;

  const [relatedServices, relatedPrograms, sameCategory] = await Promise.all([
    db
      .select({
        slug: services.slug,
        title: services.title,
        summary: services.summary,
        ctaLabel: services.ctaLabel,
      })
      .from(faqsToServices)
      .innerJoin(services, eq(faqsToServices.serviceId, services.id))
      .where(and(publicOnly(services), eq(faqsToServices.faqId, faq.id)))
      .orderBy(asc(services.sortOrder)),
    db
      .select({ slug: programs.slug, title: programs.title, summary: programs.summary })
      .from(faqsToPrograms)
      .innerJoin(programs, eq(faqsToPrograms.programId, programs.id))
      .where(and(publicOnly(programs), eq(faqsToPrograms.faqId, faq.id)))
      .orderBy(asc(programs.sortOrder)),
    // Cadangan agar halaman tidak buntu bila FAQ ini belum punya relasi apa pun
    // (02-IA §7 mensyaratkan minimal dua blok related).
    db
      .select({ slug: faqs.slug, question: faqs.question })
      .from(faqs)
      .innerJoin(faqCategories, eq(faqs.categoryId, faqCategories.id))
      .where(
        and(publicOnly(faqs), eq(faqCategories.slug, faq.categorySlug), ne(faqs.id, faq.id)),
      )
      .orderBy(asc(faqs.sortOrder))
      .limit(4),
  ]);

  return { faq, relatedServices, relatedPrograms, sameCategory };
}

export type FaqDetail = NonNullable<Awaited<ReturnType<typeof getFaqDetail>>>;

/** Dipakai halaman kontak untuk menampilkan seluruh kanal resmi per unit. */
export async function listPublicContacts() {
  return getDb()
    .select({
      unitSlug: units.slug,
      unitTitle: units.title,
      label: contacts.label,
      channel: contacts.channel,
      value: contacts.value,
      note: contacts.note,
    })
    .from(contacts)
    .innerJoin(units, eq(contacts.ownerUnitId, units.id))
    .where(and(publicOnly(units), eq(contacts.isPublic, true)))
    .orderBy(asc(units.sortOrder), asc(contacts.label));
}

/** Slug untuk getStaticPaths. */
export async function getEventSlugs() {
  return getDb().select({ slug: events.slug }).from(events).where(publicOnly(events));
}

/**
 * Layanan yang relevan untuk sekumpulan audience — dipakai blok "untuk siapa"
 * bila suatu saat dibutuhkan. Disediakan sekarang karena querynya sejalan dengan
 * filter di 02-IA §9.
 */
export async function listServicesForAudiences(audienceSlugs: string[]) {
  if (audienceSlugs.length === 0) return [];
  const db = getDb();
  const ids = await db
    .select({ id: audiences.id })
    .from(audiences)
    .where(inArray(audiences.slug, audienceSlugs));
  if (ids.length === 0) return [];

  return db
    .selectDistinct({ slug: services.slug, title: services.title })
    .from(servicesToAudiences)
    .innerJoin(services, eq(servicesToAudiences.serviceId, services.id))
    .where(
      and(
        publicOnly(services),
        or(...ids.map((row) => eq(servicesToAudiences.audienceId, row.id))),
      ),
    )
    .orderBy(asc(services.title));
}

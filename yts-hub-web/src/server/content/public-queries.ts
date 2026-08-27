/**
 * Query konten publik.
 *
 * Satu-satunya jalan komponen publik mengambil data. Aturannya di satu tempat:
 *
 * 1. HANYA `status = 'published'` dan `visibility = 'public'` yang keluar.
 *    Draft, internal, restricted, dan archived tidak pernah bocor ke halaman publik
 *    maupun ke search (06-CONTENT-MODEL §13, 07-SEARCH-AND-FAQ.md §4).
 * 2. Kolom dipilih eksplisit. Field internal registry aplikasi (technical_owner,
 *    repository, hosting, integration notes) tidak pernah ikut terkirim
 *    (06-CONTENT-MODEL §8) — bukan karena komponen lupa memakainya, tapi karena
 *    memang tidak pernah di-select.
 * 3. Bentuk hasilnya sengaja sama dengan tipe di src/types/content.ts supaya
 *    komponen Fase 1 tidak perlu berubah saat pindah dari fixture ke database.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { applications, faqs, programs, services, units } from '@/server/db/schema';

/**
 * Gate publik yang dipakai SETIAP query di file ini.
 * Satu definisi, supaya tidak ada query yang lupa menyaring status/visibility.
 */
const publicOnly = (table: {
  status: Parameters<typeof eq>[0];
  visibility: Parameters<typeof eq>[0];
}) => and(eq(table.status, 'published'), eq(table.visibility, 'public'));

/* ------------------------------------------------------------------ units */

export async function getFeaturedUnits(limit = 4) {
  return getDb()
    .select({
      id: units.id,
      slug: units.slug,
      code: units.code,
      title: units.title,
      shortName: units.shortName,
      kind: units.kind,
      summary: units.summary,
      updatedAt: units.updatedAt,
    })
    .from(units)
    .where(publicOnly(units))
    .orderBy(asc(units.sortOrder), asc(units.title))
    .limit(limit);
}

export type PublicUnit = Awaited<ReturnType<typeof getFeaturedUnits>>[number];

/* --------------------------------------------------------------- services */

export async function getPopularServices(limit = 5) {
  return getDb()
    .select({
      id: services.id,
      slug: services.slug,
      code: services.code,
      title: services.title,
      summary: services.summary,
      category: services.category,
      ctaLabel: services.ctaLabel,
      ctaUrl: services.ctaUrl,
      isExternal: services.isExternal,
      updatedAt: services.updatedAt,
    })
    .from(services)
    .where(and(publicOnly(services), eq(services.isPopular, true)))
    // Urutan ditentukan pengelola lewat sortOrder; judul hanya penyeimbang
    // agar hasilnya stabil, bukan penentu "paling sering dicari".
    .orderBy(asc(services.sortOrder), asc(services.title))
    .limit(limit);
}

export type PublicService = Awaited<ReturnType<typeof getPopularServices>>[number];

export async function getServiceSlugs() {
  return getDb()
    .select({ slug: services.slug, title: services.title, summary: services.summary })
    .from(services)
    .where(publicOnly(services));
}

/* --------------------------------------------------------------- programs */

export async function getFeaturedPrograms(limit = 3) {
  return getDb()
    .select({
      id: programs.id,
      slug: programs.slug,
      code: programs.code,
      title: programs.title,
      summary: programs.summary,
      category: programs.category,
      programStatus: programs.programStatus,
      scheduleSummary: programs.scheduleSummary,
      updatedAt: programs.updatedAt,
    })
    .from(programs)
    .where(and(publicOnly(programs), eq(programs.isFeatured, true)))
    // Yang sedang berjalan lebih dulu, lalu yang akan datang, baru urutan pengelola.
    .orderBy(
      sql`case ${programs.programStatus} when 'berjalan' then 0 when 'akan-datang' then 1 else 2 end`,
      asc(programs.sortOrder),
      asc(programs.title),
    )
    .limit(limit);
}

export type PublicProgram = Awaited<ReturnType<typeof getFeaturedPrograms>>[number];

export async function getProgramSlugs() {
  return getDb()
    .select({ slug: programs.slug, title: programs.title, summary: programs.summary })
    .from(programs)
    .where(publicOnly(programs));
}

/* ------------------------------------------------------------------- faqs */

export async function getPopularFaqs(limit = 4) {
  return getDb()
    .select({
      id: faqs.id,
      slug: faqs.slug,
      code: faqs.code,
      question: faqs.question,
      answer: faqs.answer,
      summary: faqs.summary,
      updatedAt: faqs.updatedAt,
    })
    .from(faqs)
    .where(and(publicOnly(faqs), eq(faqs.isPopular, true)))
    // Prioritas: urutan pengelola, lalu skor kebermanfaatan (07-SEARCH §4 butir 4).
    .orderBy(asc(faqs.sortOrder), desc(faqs.helpfulYes), asc(faqs.question))
    .limit(limit);
}

export type PublicFaq = Awaited<ReturnType<typeof getPopularFaqs>>[number];

export async function getFaqSlugs() {
  return getDb()
    .select({ slug: faqs.slug, question: faqs.question, summary: faqs.summary })
    .from(faqs)
    .where(publicOnly(faqs));
}

/* ----------------------------------------------------- application registry */

/**
 * Registry publik. Perhatikan kolom yang TIDAK ada di sini: technicalOwner,
 * repositoryReference, hostingProvider, databaseProvider, integrationNotes,
 * criticality. Itu disengaja — 06-CONTENT-MODEL §8 dan 08-INTEGRATION §7.
 */
export async function getPublicApplications(limit = 3) {
  return getDb()
    .select({
      id: applications.id,
      slug: applications.slug,
      code: applications.code,
      name: applications.name,
      title: applications.title,
      summary: applications.summary,
      kind: applications.kind,
      url: applications.url,
      ctaLabel: applications.ctaLabel,
      updatedAt: applications.updatedAt,
    })
    .from(applications)
    .where(publicOnly(applications))
    .orderBy(asc(applications.sortOrder), asc(applications.name))
    .limit(limit);
}

export type PublicApplication = Awaited<ReturnType<typeof getPublicApplications>>[number];

export async function getUnitSlugs() {
  return getDb()
    .select({ slug: units.slug, title: units.title, summary: units.summary })
    .from(units)
    .where(publicOnly(units));
}

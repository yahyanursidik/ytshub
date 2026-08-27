/**
 * Query pengumuman publik.
 *
 * Aturan gate yang sama seperti seluruh query publik lain — `published` +
 * `public` — DITAMBAH satu syarat yang khas entity ini: masa berlakunya harus
 * sedang berjalan.
 *
 * Syarat waktu itu dihitung di SQL terhadap `now()`, bukan disaring setelah
 * baris terbaca dan bukan ditentukan sebuah kolom `is_active` yang harus
 * dimatikan seseorang. Pengumuman yang sudah lewat berhenti tampil dengan
 * sendirinya, dan itulah satu-satunya cara ia benar-benar berhenti tampil:
 * kolom yang menunggu dimatikan manusia akan tetap menyala berbulan-bulan
 * setelah pendaftaran ditutup.
 */
import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import {
  announcements,
  announcementsToApplications,
  applications,
  units,
} from '@/server/db/schema';

/** Terbit, publik, DAN sedang dalam masa berlakunya. */
const activeNow = () =>
  and(
    eq(announcements.status, 'published'),
    eq(announcements.visibility, 'public'),
    lte(announcements.startAt, sql`now()`),
    // endAt kosong berarti belum ditetapkan kapan berakhir — masih aktif.
    or(isNull(announcements.endAt), sql`${announcements.endAt} > now()`),
  );

export interface AnnouncementTarget {
  /** Id registry — dipakai memeriksa kesehatan tautannya (Fase 6). */
  id: string;
  slug: string;
  name: string;
  summary: string;
  kind: string;
  url: string | null;
  ctaLabel: string;
  unitName: string | null;
}

export interface ActiveAnnouncement {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  bannerText: string;
  ctaLabel: string;
  startAt: Date;
  endAt: Date | null;
  isHighlighted: boolean;
  unitName: string | null;
  targets: AnnouncementTarget[];
}

/** Sistem yang dituju sekumpulan pengumuman, dalam satu query. */
async function targetsFor(ids: string[]): Promise<Map<string, AnnouncementTarget[]>> {
  if (ids.length === 0) return new Map();

  const rows = await getDb()
    .select({
      announcementId: announcementsToApplications.announcementId,
      id: applications.id,
      slug: applications.slug,
      name: applications.name,
      summary: applications.summary,
      kind: applications.kind,
      url: applications.url,
      ctaLabel: applications.ctaLabel,
      unitName: units.shortName,
      sortOrder: announcementsToApplications.sortOrder,
    })
    .from(announcementsToApplications)
    .innerJoin(applications, eq(announcementsToApplications.applicationId, applications.id))
    .leftJoin(units, eq(applications.ownerUnitId, units.id))
    // Sistem yang belum terbit tidak boleh muncul lewat pintu pengumuman.
    .where(
      and(
        sql`${announcementsToApplications.announcementId} in ${ids}`,
        eq(applications.status, 'published'),
        eq(applications.visibility, 'public'),
      ),
    )
    .orderBy(asc(announcementsToApplications.sortOrder), asc(applications.name));

  const byAnnouncement = new Map<string, AnnouncementTarget[]>();
  for (const row of rows) {
    const list = byAnnouncement.get(row.announcementId) ?? [];
    list.push({
      id: row.id,
      slug: row.slug,
      name: row.name,
      summary: row.summary,
      kind: row.kind,
      url: row.url,
      ctaLabel: row.ctaLabel,
      unitName: row.unitName,
    });
    byAnnouncement.set(row.announcementId, list);
  }
  return byAnnouncement;
}

const BASE_COLUMNS = {
  id: announcements.id,
  slug: announcements.slug,
  title: announcements.title,
  summary: announcements.summary,
  description: announcements.description,
  bannerText: announcements.bannerText,
  ctaLabel: announcements.ctaLabel,
  startAt: announcements.startAt,
  endAt: announcements.endAt,
  isHighlighted: announcements.isHighlighted,
  unitName: units.shortName,
};

/** Seluruh pengumuman yang sedang berlaku. */
export async function listActiveAnnouncements(): Promise<ActiveAnnouncement[]> {
  const rows = await getDb()
    .select(BASE_COLUMNS)
    .from(announcements)
    .leftJoin(units, eq(announcements.ownerUnitId, units.id))
    .where(activeNow())
    .orderBy(asc(announcements.sortOrder), asc(announcements.title));

  const targets = await targetsFor(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, targets: targets.get(row.id) ?? [] }));
}

/**
 * Pengumuman yang layak dipasang di banner beranda.
 *
 * Satu saja, meski beberapa ditandai. Dua banner sekaligus membuat keduanya
 * terabaikan, dan yang kedua justru menghilangkan urgensi yang pertama.
 */
export async function getHighlightedAnnouncement(): Promise<ActiveAnnouncement | null> {
  const rows = await getDb()
    .select(BASE_COLUMNS)
    .from(announcements)
    .leftJoin(units, eq(announcements.ownerUnitId, units.id))
    .where(and(activeNow(), eq(announcements.isHighlighted, true)))
    .orderBy(asc(announcements.sortOrder), asc(announcements.title))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const targets = await targetsFor([row.id]);
  return { ...row, targets: targets.get(row.id) ?? [] };
}

/**
 * Detail satu pengumuman.
 *
 * Sengaja TIDAK terbatas pada yang sedang berlaku: pengumuman yang sudah lewat
 * tetap bisa dibuka bila tautannya sudah tersebar, dan halamannya menyatakan
 * bahwa masanya sudah berakhir. Itu jauh lebih baik daripada 404 yang membuat
 * orang mengira dirinya salah alamat.
 */
export async function getAnnouncement(slug: string) {
  const rows = await getDb()
    .select({
      ...BASE_COLUMNS,
      code: announcements.code,
      updatedAt: announcements.updatedAt,
      seoTitle: announcements.seoTitle,
      seoDescription: announcements.seoDescription,
    })
    .from(announcements)
    .leftJoin(units, eq(announcements.ownerUnitId, units.id))
    .where(
      and(
        eq(announcements.slug, slug),
        eq(announcements.status, 'published'),
        eq(announcements.visibility, 'public'),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const targets = await targetsFor([row.id]);
  const now = new Date();

  return {
    ...row,
    targets: targets.get(row.id) ?? [],
    hasStarted: row.startAt.getTime() <= now.getTime(),
    hasEnded: row.endAt !== null && row.endAt.getTime() <= now.getTime(),
  };
}

/** Slug seluruh pengumuman terbit — untuk getStaticPaths. */
export async function getAnnouncementSlugs() {
  return getDb()
    .select({ slug: announcements.slug, title: announcements.title })
    .from(announcements)
    .where(and(eq(announcements.status, 'published'), eq(announcements.visibility, 'public')))
    .orderBy(asc(announcements.sortOrder));
}

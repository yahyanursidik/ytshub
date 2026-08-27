/**
 * YTS Hub — tipe konten publik.
 * Mengikuti 06-CONTENT-MODEL-AND-CMS.md. Pada Fase 1 tipe ini dipakai untuk
 * typed mock data; pada Fase 2 tipe yang sama menjadi kontrak dari database.
 */

export type ContentStatus =
  'draft' | 'in_review' | 'approved' | 'published' | 'needs_review' | 'archived';

export type Visibility = 'public' | 'internal' | 'restricted';

export type Audience = 'orang-tua' | 'siswa' | 'jamaah' | 'donatur' | 'relawan' | 'mitra' | 'umum';

export type ProgramStatus = 'berjalan' | 'akan-datang' | 'selesai';

/** Field yang wajib dimiliki setiap entity publik (06-CONTENT-MODEL §2). */
export interface PublicEntityBase {
  id: string;
  code: string;
  slug: string;
  title: string;
  summary: string;
  status: ContentStatus;
  visibility: Visibility;
  ownerUnitId: string;
  updatedAt: string;
  reviewDueAt?: string;
}

export interface Unit extends PublicEntityBase {
  shortName: string;
  kind: 'pendidikan' | 'dakwah' | 'sosial' | 'digital' | 'operasional';
  websiteUrl?: string;
}

export interface Service extends PublicEntityBase {
  audiences: Audience[];
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  /** true bila CTA membuka sistem lain di luar domain Hub. */
  isExternal: boolean;
}

export interface Program extends PublicEntityBase {
  category: string;
  audiences: Audience[];
  programStatus: ProgramStatus;
  scheduleSummary?: string;
}

export interface Faq extends PublicEntityBase {
  question: string;
  answer: string;
  categoryId: string;
  keywords: string[];
}

export interface AppRegistryEntry extends PublicEntityBase {
  name: string;
  url: string;
  kind: 'aplikasi' | 'website' | 'portal';
  ctaLabel: string;
}

/** Task shortcut di landing page — navigasi, bukan entity konten. */
export interface TaskShortcut {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: IconName;
}

export type IconName =
  | 'search'
  | 'arrow-right'
  | 'external'
  | 'school'
  | 'lecture'
  | 'learn'
  | 'donate'
  | 'calendar'
  | 'help'
  | 'chevron-down'
  | 'menu'
  | 'close'
  | 'document'
  | 'chat';

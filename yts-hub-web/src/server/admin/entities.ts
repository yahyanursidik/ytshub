/**
 * Peta entity yang tunduk pada governance.
 *
 * Enam entity punya lifecycle yang sama tetapi kolom yang berbeda. Alih-alih
 * enam modul admin yang nyaris kembar — enam tempat untuk lupa memeriksa izin —
 * masing-masing dijelaskan sekali di sini sebagai data, lalu satu route dan satu
 * handler melayani semuanya.
 *
 * Konsekuensinya disengaja: menambah entity baru berarti menambah satu entri di
 * berkas ini, bukan menyalin sebuah folder.
 */
import { applications, events, faqs, programs, services, units } from '@/server/db/schema';

export type EntityKey = 'unit' | 'service' | 'program' | 'event' | 'faq' | 'application';

export type FieldType = 'text' | 'textarea' | 'url' | 'select' | 'boolean' | 'number' | 'datetime';

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  /** Wajib diisi sebelum konten boleh dikirim untuk ditinjau. */
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  maxLength?: number;
}

export interface EntitySpec {
  key: EntityKey;
  /** Segmen URL admin, mis. /admin/layanan. */
  slug: string;
  label: string;
  labelPlural: string;
  table:
    | typeof units
    | typeof services
    | typeof programs
    | typeof events
    | typeof faqs
    | typeof applications;
  /** Kolom unit pemilik — dasar seluruh pemeriksaan izin berlingkup unit. */
  ownerColumn: 'ownerUnitId' | 'organizerUnitId' | 'self';
  /** Kolom yang dipakai sebagai judul di daftar admin. */
  titleColumn: 'title' | 'question' | 'name';
  /** Path halaman publiknya, untuk tautan "lihat di situs". */
  publicPath: (slug: string) => string | null;
  fields: FieldSpec[];
}

/** Kolom yang dimiliki setiap entity publik — 06-CONTENT-MODEL §2. */
const commonFields: FieldSpec[] = [
  { name: 'slug', label: 'Slug', type: 'text', required: true, help: 'Bagian akhir URL publik.' },
  { name: 'summary', label: 'Ringkasan', type: 'textarea', required: true, maxLength: 300 },
  { name: 'description', label: 'Deskripsi', type: 'textarea' },
  { name: 'seoTitle', label: 'Judul SEO', type: 'text', maxLength: 70 },
  { name: 'seoDescription', label: 'Deskripsi SEO', type: 'textarea', maxLength: 160 },
];

const visibilityField: FieldSpec = {
  name: 'visibility',
  label: 'Visibilitas',
  type: 'select',
  required: true,
  help: 'Hanya konten "public" yang bisa muncul di halaman publik dan hasil pencarian.',
  options: [
    { value: 'public', label: 'Public' },
    { value: 'internal', label: 'Internal' },
    { value: 'restricted', label: 'Restricted' },
  ],
};

export const ENTITIES: Record<EntityKey, EntitySpec> = {
  unit: {
    key: 'unit',
    slug: 'unit',
    label: 'Unit',
    labelPlural: 'Unit',
    table: units,
    // Unit adalah pemiliknya sendiri: izin atas unit diperiksa terhadap id-nya.
    ownerColumn: 'self',
    titleColumn: 'title',
    publicPath: (slug) => `/unit/${slug}`,
    fields: [
      { name: 'title', label: 'Nama unit', type: 'text', required: true },
      { name: 'shortName', label: 'Nama pendek', type: 'text', required: true },
      {
        name: 'kind',
        label: 'Jenis',
        type: 'select',
        required: true,
        options: [
          { value: 'pendidikan', label: 'Pendidikan' },
          { value: 'dakwah', label: 'Dakwah' },
          { value: 'sosial', label: 'Sosial' },
          { value: 'digital', label: 'Digital' },
          { value: 'operasional', label: 'Operasional' },
        ],
      },
      ...commonFields,
      { name: 'about', label: 'Tentang', type: 'textarea' },
      { name: 'websiteUrl', label: 'Situs unit', type: 'url' },
      { name: 'sortOrder', label: 'Urutan tampil', type: 'number' },
      visibilityField,
    ],
  },

  service: {
    key: 'service',
    slug: 'layanan',
    label: 'Layanan',
    labelPlural: 'Layanan',
    table: services,
    ownerColumn: 'ownerUnitId',
    titleColumn: 'title',
    publicPath: (slug) => `/layanan/${slug}`,
    fields: [
      { name: 'title', label: 'Nama layanan', type: 'text', required: true },
      { name: 'category', label: 'Kategori', type: 'text', required: true },
      ...commonFields,
      {
        name: 'requirements',
        label: 'Persyaratan',
        type: 'textarea',
        help: 'Kosongkan bila belum ada ketetapan resmi — jangan diisi perkiraan.',
      },
      { name: 'processSteps', label: 'Alur', type: 'textarea' },
      {
        name: 'feeInformation',
        label: 'Biaya / infak',
        type: 'textarea',
        help: 'Tulis apa adanya sesuai ketetapan unit. Biaya tidak boleh dikarang.',
      },
      { name: 'serviceChannel', label: 'Kanal layanan', type: 'text' },
      { name: 'ctaLabel', label: 'Label tombol', type: 'text', required: true },
      { name: 'ctaUrl', label: 'Tautan tombol', type: 'url' },
      {
        name: 'isExternal',
        label: 'Membuka sistem lain',
        type: 'boolean',
        help: 'Bila ya, halaman publik menandai bahwa pengguna akan keluar dari YTS Hub.',
      },
      { name: 'isPopular', label: 'Tampilkan di beranda', type: 'boolean' },
      { name: 'sortOrder', label: 'Urutan tampil', type: 'number' },
      visibilityField,
    ],
  },

  program: {
    key: 'program',
    slug: 'program',
    label: 'Program',
    labelPlural: 'Program',
    table: programs,
    ownerColumn: 'ownerUnitId',
    titleColumn: 'title',
    publicPath: (slug) => `/program/${slug}`,
    fields: [
      { name: 'title', label: 'Nama program', type: 'text', required: true },
      { name: 'category', label: 'Kategori', type: 'text', required: true },
      {
        name: 'programStatus',
        label: 'Status program',
        type: 'select',
        required: true,
        help: 'Berbeda dari status penerbitan. Ini keadaan programnya sendiri.',
        options: [
          { value: 'berjalan', label: 'Berjalan' },
          { value: 'akan-datang', label: 'Akan datang' },
          { value: 'selesai', label: 'Selesai' },
        ],
      },
      ...commonFields,
      { name: 'scheduleSummary', label: 'Ringkasan jadwal', type: 'textarea' },
      { name: 'locationSummary', label: 'Ringkasan lokasi', type: 'textarea' },
      { name: 'startDate', label: 'Mulai', type: 'datetime' },
      { name: 'endDate', label: 'Selesai', type: 'datetime' },
      { name: 'ctaLabel', label: 'Label tombol', type: 'text' },
      { name: 'ctaUrl', label: 'Tautan tombol', type: 'url' },
      { name: 'isFeatured', label: 'Tampilkan di beranda', type: 'boolean' },
      { name: 'sortOrder', label: 'Urutan tampil', type: 'number' },
      visibilityField,
    ],
  },

  event: {
    key: 'event',
    slug: 'event',
    label: 'Event',
    labelPlural: 'Event',
    table: events,
    ownerColumn: 'organizerUnitId',
    titleColumn: 'title',
    publicPath: (slug) => `/event/${slug}`,
    fields: [
      { name: 'title', label: 'Nama event', type: 'text', required: true },
      ...commonFields,
      { name: 'startAt', label: 'Mulai', type: 'datetime' },
      { name: 'endAt', label: 'Selesai', type: 'datetime' },
      {
        name: 'format',
        label: 'Format',
        type: 'select',
        required: true,
        options: [
          { value: 'onsite', label: 'Onsite' },
          { value: 'online', label: 'Online' },
          { value: 'hybrid', label: 'Hybrid' },
        ],
      },
      { name: 'location', label: 'Lokasi', type: 'text' },
      { name: 'mapUrl', label: 'Tautan peta', type: 'url' },
      { name: 'speakerSummary', label: 'Pemateri', type: 'textarea' },
      { name: 'registrationUrl', label: 'Tautan pendaftaran', type: 'url' },
      visibilityField,
    ],
  },

  faq: {
    key: 'faq',
    slug: 'faq',
    label: 'FAQ',
    labelPlural: 'FAQ',
    table: faqs,
    ownerColumn: 'ownerUnitId',
    titleColumn: 'question',
    publicPath: (slug) => `/faq/${slug}`,
    fields: [
      { name: 'question', label: 'Pertanyaan', type: 'text', required: true },
      { name: 'title', label: 'Judul internal', type: 'text', required: true },
      {
        name: 'answer',
        label: 'Jawaban',
        type: 'textarea',
        required: true,
        help: 'Pisahkan paragraf dengan satu baris kosong.',
      },
      ...commonFields,
      { name: 'isPopular', label: 'Tampilkan di beranda', type: 'boolean' },
      { name: 'sortOrder', label: 'Urutan tampil', type: 'number' },
      visibilityField,
    ],
  },

  application: {
    key: 'application',
    slug: 'aplikasi',
    label: 'Aplikasi / Website',
    labelPlural: 'Aplikasi & Website',
    table: applications,
    ownerColumn: 'ownerUnitId',
    titleColumn: 'name',
    // Registry tidak punya halaman detail sendiri — 02-IA §5.
    publicPath: (slug) => `/aplikasi#${slug}`,
    fields: [
      { name: 'name', label: 'Nama sistem', type: 'text', required: true },
      { name: 'title', label: 'Judul internal', type: 'text', required: true },
      {
        name: 'kind',
        label: 'Jenis',
        type: 'select',
        required: true,
        options: [
          { value: 'aplikasi', label: 'Aplikasi' },
          { value: 'website', label: 'Website' },
          { value: 'portal', label: 'Portal' },
        ],
      },
      ...commonFields,
      { name: 'url', label: 'URL', type: 'url' },
      { name: 'ctaLabel', label: 'Label tombol', type: 'text', required: true },
      { name: 'sortOrder', label: 'Urutan tampil', type: 'number' },
      visibilityField,
      /**
       * Field internal — 06-CONTENT-MODEL §8. Boleh disunting di admin, TIDAK
       * PERNAH ikut ke halaman publik maupun ke indeks pencarian. Tidak ada
       * field untuk credential di sini, dan tidak boleh ditambahkan: rahasia
       * hidup di secret manager (08-INTEGRATION §7).
       */
      { name: 'technicalOwner', label: 'Penanggung jawab teknis', type: 'text' },
      { name: 'repositoryReference', label: 'Repository', type: 'text' },
      { name: 'hostingProvider', label: 'Hosting', type: 'text' },
      { name: 'databaseProvider', label: 'Database', type: 'text' },
      { name: 'integrationNotes', label: 'Catatan integrasi', type: 'textarea' },
      { name: 'criticality', label: 'Tingkat kritis', type: 'text' },
    ],
  },
};

/** Daftar entity untuk navigasi admin, urut sesuai cara orang memikirkannya. */
export const ENTITY_ORDER: EntityKey[] = [
  'service',
  'program',
  'faq',
  'event',
  'unit',
  'application',
];

/** Mencari entity dari segmen URL admin. Null bila tidak dikenali. */
export function entityBySlug(slug: string): EntitySpec | null {
  return Object.values(ENTITIES).find((entity) => entity.slug === slug) ?? null;
}

/**
 * Field internal registry aplikasi. Dikumpulkan di satu tempat supaya
 * pemeriksaan "jangan sampai bocor" punya satu daftar untuk dirujuk — termasuk
 * oleh test yang membuktikannya.
 */
export const INTERNAL_APPLICATION_FIELDS = [
  'technicalOwner',
  'repositoryReference',
  'hostingProvider',
  'databaseProvider',
  'integrationNotes',
  'criticality',
] as const;

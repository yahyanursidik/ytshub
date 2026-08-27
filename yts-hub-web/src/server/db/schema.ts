/**
 * YTS Hub — core registry schema.
 * Implementasi 06-CONTENT-MODEL-AND-CMS.md.
 *
 * Aturan yang dipegang di sini (10-DEVELOPMENT-PLAN.md §5, 11-AI-CODING §Step 6):
 * - UUID sebagai primary key, `code` human-readable sebagai reference lintas sistem
 *   (08-INTEGRATION-AND-ROUTING.md §4);
 * - foreign key eksplisit, tidak ada relasi implisit lewat konvensi nama;
 * - index untuk slug, status, owner, dan field yang dipakai search;
 * - enum untuk lifecycle dan visibility agar status tidak bisa diisi sembarang string;
 * - timestamp konsisten (timestamptz, default now());
 * - registry aplikasi TIDAK menyimpan credential apa pun (06-CONTENT-MODEL §8).
 */
import { type SQL, relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------ full text search */

/**
 * Kolom `tsvector` — 07-SEARCH-AND-FAQ.md §5 ("mulai dengan PostgreSQL Full Text
 * Search", tanpa search service eksternal).
 *
 * Drizzle belum punya tipe tsvector bawaan, jadi didefinisikan di sini. Isinya
 * tidak pernah dibaca aplikasi — hanya dipakai operator `@@` di dalam query —
 * sehingga tipe TypeScript-nya sengaja `never`: kolom ini tidak boleh ikut
 * di-`select` maupun di-`insert`.
 */
const tsvector = customType<{ data: never; driverData: string }>({
  dataType: () => 'tsvector',
});

/**
 * Membangun search vector berbobot dari beberapa kolom teks.
 *
 * Bobot menentukan peringkat, bukan sekadar cocok/tidak (07-SEARCH §4):
 * - A — judul/pertanyaan: yang dicari orang saat mengetik nama sesuatu
 * - B — kategori & ringkasan: konteks yang mempersempit
 * - C — badan teks: cocok, tapi paling lemah
 *
 * `to_tsvector` dengan nama konfigurasi sebagai literal bersifat IMMUTABLE,
 * syarat wajib untuk generated column. Karena itu konfigurasinya ditulis
 * konstan `'indonesian'` dan bukan diambil dari `default_text_search_config`.
 *
 * `keywords` FAQ sengaja TIDAK ikut di sini. Kolomnya `text[]`, dan
 * `array_to_string` bukan IMMUTABLE sehingga tidak bisa dipakai generated column.
 * Lagi pula 07-SEARCH §4 memperlakukan "keyword/alias match" sebagai sinyal
 * peringkat tersendiri — jadi dicocokkan langsung sebagai array di query search.
 */
const searchVector = (weights: { a?: string[]; b?: string[]; c?: string[] }): SQL => {
  const part = (columns: string[] | undefined, weight: 'A' | 'B' | 'C') =>
    (columns ?? []).map(
      (column) =>
        sql`setweight(to_tsvector('indonesian', coalesce(${sql.raw(`"${column}"`)}, '')), ${sql.raw(`'${weight}'`)})`,
    );

  const parts = [...part(weights.a, 'A'), ...part(weights.b, 'B'), ...part(weights.c, 'C')];
  return sql.join(parts, sql` || `);
};

/* ------------------------------------------------------------------ enums */

/** Lifecycle konten — 06-CONTENT-MODEL-AND-CMS.md §9. */
export const contentStatus = pgEnum('content_status', [
  'draft',
  'in_review',
  'approved',
  'published',
  'needs_review',
  'archived',
]);

/** 06-CONTENT-MODEL-AND-CMS.md §13. Server-side authorization tetap sumber kebenaran. */
export const visibility = pgEnum('visibility', ['public', 'internal', 'restricted']);

export const unitKind = pgEnum('unit_kind', [
  'pendidikan',
  'dakwah',
  'sosial',
  'digital',
  'operasional',
]);

export const programStatus = pgEnum('program_status', ['berjalan', 'akan-datang', 'selesai']);

export const eventFormat = pgEnum('event_format', ['onsite', 'online', 'hybrid']);

export const applicationKind = pgEnum('application_kind', ['aplikasi', 'website', 'portal']);

/** 08-INTEGRATION-AND-ROUTING.md §6 — hasil health check URL publik. */
export const linkHealth = pgEnum('link_health', ['healthy', 'redirected', 'warning', 'broken']);

/* --------------------------------------------------- kolom bersama (mixin) */

/**
 * Field wajib setiap entity publik — 06-CONTENT-MODEL-AND-CMS.md §2.
 * Ditulis sebagai fungsi, bukan tabel abstrak, supaya tiap tabel tetap eksplisit
 * saat dibaca dan Drizzle tetap bisa menurunkan tipenya.
 */
const publicEntityColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  description: text('description'),
  status: contentStatus('status').notNull().default('draft'),
  visibility: visibility('visibility').notNull().default('public'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewDueAt: timestamp('review_due_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ units */

export const units = pgTable(
  'units',
  {
    ...publicEntityColumns(),
    shortName: text('short_name').notNull(),
    kind: unitKind('kind').notNull(),
    about: text('about'),
    websiteUrl: text('website_url'),
    /** Unit induk, bila unit ini adalah divisi (06-CONTENT-MODEL §1: Unit vs Division). */
    parentUnitId: uuid('parent_unit_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      searchVector({ a: ['title', 'short_name'], b: ['summary'], c: ['about'] }),
    ),
  },
  (table) => [
    uniqueIndex('units_slug_key').on(table.slug),
    uniqueIndex('units_code_key').on(table.code),
    index('units_status_idx').on(table.status, table.visibility),
    index('units_review_due_idx').on(table.reviewDueAt),
    index('units_parent_idx').on(table.parentUnitId),
    index('units_search_idx').using('gin', table.searchVector),
    // Self-reference perlu bentuk ini; .references() tidak bisa menunjuk tabel
    // yang sedang didefinisikan.
    foreignKey({
      columns: [table.parentUnitId],
      foreignColumns: [table.id],
      name: 'units_parent_unit_id_fk',
    }).onDelete('set null'),
  ],
);

/* --------------------------------------------------------------- audiences */

/** Audience dan tag dinormalisasi agar filter di 02-IA §9 bisa memakai index. */
export const audiences = pgTable(
  'audiences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
  },
  (table) => [uniqueIndex('audiences_slug_key').on(table.slug)],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
  },
  (table) => [uniqueIndex('tags_slug_key').on(table.slug)],
);

/* --------------------------------------------------------------- contacts */

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUnitId: uuid('owner_unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    label: text('label').notNull(),
    channel: text('channel').notNull(),
    /** Nilai kanal (nomor, email, tautan). Diisi unit pemilik, bukan dikarang. */
    value: text('value'),
    note: text('note'),
    isPublic: boolean('is_public').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('contacts_owner_idx').on(table.ownerUnitId, table.isPublic)],
);

/* --------------------------------------------------------------- services */

export const services = pgTable(
  'services',
  {
    ...publicEntityColumns(),
    ownerUnitId: uuid('owner_unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    category: text('category').notNull(),
    requirements: text('requirements'),
    processSteps: text('process_steps'),
    /** 06-CONTENT-MODEL §5. Teks bebas — biaya tidak boleh dikarang, isi apa adanya. */
    feeInformation: text('fee_information'),
    serviceChannel: text('service_channel'),
    ctaLabel: text('cta_label').notNull(),
    ctaUrl: text('cta_url'),
    /** true bila CTA membuka sistem lain — UI wajib memberi indikator (08-INTEGRATION §5). */
    isExternal: boolean('is_external').notNull().default(false),
    isPopular: boolean('is_popular').notNull().default(false),
    /**
     * Urutan tampil yang ditentukan pengelola. Dipakai sebagai kunci urut utama
     * supaya "paling sering dicari" mencerminkan keputusan redaksi, bukan abjad.
     * Fase 4 menggantinya dengan peringkat dari analytics (07-SEARCH §11).
     */
    sortOrder: integer('sort_order').notNull().default(0),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      searchVector({
        a: ['title'],
        b: ['category', 'summary'],
        c: ['description', 'requirements', 'service_channel'],
      }),
    ),
  },
  (table) => [
    uniqueIndex('services_slug_key').on(table.slug),
    uniqueIndex('services_code_key').on(table.code),
    index('services_owner_idx').on(table.ownerUnitId),
    index('services_status_idx').on(table.status, table.visibility),
    index('services_popular_idx').on(table.isPopular, table.status),
    index('services_search_idx').using('gin', table.searchVector),
  ],
);

export const servicesToAudiences = pgTable(
  'services_to_audiences',
  {
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    audienceId: uuid('audience_id')
      .notNull()
      .references(() => audiences.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.serviceId, table.audienceId] }),
    index('services_to_audiences_audience_idx').on(table.audienceId),
  ],
);

/* --------------------------------------------------------------- programs */

export const programs = pgTable(
  'programs',
  {
    ...publicEntityColumns(),
    ownerUnitId: uuid('owner_unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    category: text('category').notNull(),
    programStatus: programStatus('program_status').notNull().default('akan-datang'),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    scheduleSummary: text('schedule_summary'),
    locationSummary: text('location_summary'),
    ctaLabel: text('cta_label'),
    ctaUrl: text('cta_url'),
    isFeatured: boolean('is_featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      searchVector({
        a: ['title'],
        b: ['category', 'summary'],
        c: ['description', 'schedule_summary', 'location_summary'],
      }),
    ),
  },
  (table) => [
    uniqueIndex('programs_slug_key').on(table.slug),
    uniqueIndex('programs_code_key').on(table.code),
    index('programs_owner_idx').on(table.ownerUnitId),
    index('programs_status_idx').on(table.status, table.visibility),
    index('programs_program_status_idx').on(table.programStatus),
    index('programs_search_idx').using('gin', table.searchVector),
  ],
);

export const programsToAudiences = pgTable(
  'programs_to_audiences',
  {
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    audienceId: uuid('audience_id')
      .notNull()
      .references(() => audiences.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.programId, table.audienceId] }),
    index('programs_to_audiences_audience_idx').on(table.audienceId),
  ],
);

/** Relasi silang program ↔ layanan — 02-IA §7 "no dead ends". */
export const programsToServices = pgTable(
  'programs_to_services',
  {
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.programId, table.serviceId] })],
);

/* ----------------------------------------------------------------- events */

export const events = pgTable(
  'events',
  {
    ...publicEntityColumns(),
    organizerUnitId: uuid('organizer_unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    format: eventFormat('format').notNull().default('onsite'),
    location: text('location'),
    mapUrl: text('map_url'),
    speakerSummary: text('speaker_summary'),
    registrationUrl: text('registration_url'),
    relatedProgramId: uuid('related_program_id').references(() => programs.id, {
      onDelete: 'set null',
    }),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      searchVector({
        a: ['title'],
        b: ['summary'],
        c: ['description', 'location', 'speaker_summary'],
      }),
    ),
  },
  (table) => [
    uniqueIndex('events_slug_key').on(table.slug),
    uniqueIndex('events_code_key').on(table.code),
    index('events_organizer_idx').on(table.organizerUnitId),
    index('events_start_idx').on(table.startAt),
    index('events_status_idx').on(table.status, table.visibility),
    index('events_search_idx').using('gin', table.searchVector),
  ],
);

/* -------------------------------------------------------------------- faq */

export const faqCategories = pgTable(
  'faq_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    summary: text('summary'),
  },
  (table) => [uniqueIndex('faq_categories_slug_key').on(table.slug)],
);

export const faqs = pgTable(
  'faqs',
  {
    ...publicEntityColumns(),
    ownerUnitId: uuid('owner_unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => faqCategories.id, { onDelete: 'restrict' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    /** Alias/kata kunci untuk ranking search — 07-SEARCH-AND-FAQ.md §4. */
    keywords: text('keywords')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Penghitung feedback (07-SEARCH-AND-FAQ.md §10). Integer, bukan text:
    // pengurutan text membuat "10" berada sebelum "2".
    helpfulYes: integer('helpful_yes').notNull().default(0),
    helpfulNo: integer('helpful_no').notNull().default(0),
    isPopular: boolean('is_popular').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      searchVector({ a: ['question'], b: ['summary'], c: ['answer'] }),
    ),
  },
  (table) => [
    uniqueIndex('faqs_slug_key').on(table.slug),
    uniqueIndex('faqs_code_key').on(table.code),
    index('faqs_category_idx').on(table.categoryId),
    index('faqs_owner_idx').on(table.ownerUnitId),
    index('faqs_status_idx').on(table.status, table.visibility),
    index('faqs_popular_idx').on(table.isPopular, table.status),
    index('faqs_search_idx').using('gin', table.searchVector),
    // Pencocokan alias/kata kunci — sinyal peringkat kedua di 07-SEARCH §4.
    index('faqs_keywords_idx').using('gin', table.keywords),
  ],
);

export const faqsToServices = pgTable(
  'faqs_to_services',
  {
    faqId: uuid('faq_id')
      .notNull()
      .references(() => faqs.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.faqId, table.serviceId] })],
);

export const faqsToPrograms = pgTable(
  'faqs_to_programs',
  {
    faqId: uuid('faq_id')
      .notNull()
      .references(() => faqs.id, { onDelete: 'cascade' }),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.faqId, table.programId] })],
);

/* --------------------------------------------- application & website registry */

/**
 * 06-CONTENT-MODEL-AND-CMS.md §8.
 * Field internal (technical_owner, repository, hosting, integration notes) disimpan
 * di sini TAPI tidak pernah diserialkan ke halaman publik — query publik memilih
 * kolom secara eksplisit. Tidak ada kolom untuk credential/secret, dan tidak boleh
 * ditambahkan: rahasia hidup di secret manager (08-INTEGRATION-AND-ROUTING.md §7).
 */
export const applications = pgTable(
  'applications',
  {
    ...publicEntityColumns(),
    ownerUnitId: uuid('owner_unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    kind: applicationKind('kind').notNull(),
    url: text('url'),
    ctaLabel: text('cta_label').notNull().default('Buka'),
    technicalOwner: text('technical_owner'),
    repositoryReference: text('repository_reference'),
    hostingProvider: text('hosting_provider'),
    databaseProvider: text('database_provider'),
    integrationNotes: text('integration_notes'),
    criticality: text('criticality'),
    linkHealth: linkHealth('link_health'),
    linkCheckedAt: timestamp('link_checked_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    /**
     * Hanya kolom publik yang masuk index. `integration_notes`, `technical_owner`,
     * dan kerabatnya sengaja tidak ikut — bila ikut, isinya bisa ditebak dari luar
     * dengan menyusun query yang cocok, dan itu membocorkan field internal
     * (06-CONTENT-MODEL §8) lewat pintu belakang.
     */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      searchVector({ a: ['name', 'title'], b: ['summary'], c: ['description'] }),
    ),
  },
  (table) => [
    uniqueIndex('applications_slug_key').on(table.slug),
    uniqueIndex('applications_code_key').on(table.code),
    index('applications_owner_idx').on(table.ownerUnitId),
    index('applications_status_idx').on(table.status, table.visibility),
    index('applications_health_idx').on(table.linkHealth),
    index('applications_search_idx').using('gin', table.searchVector),
  ],
);

/* --------------------------------------------------- search & feedback log */

/** Jenis entity yang bisa muncul di hasil search — 07-SEARCH-AND-FAQ.md §2. */
export const searchEntity = pgEnum('search_entity', [
  'faq',
  'service',
  'program',
  'unit',
  'event',
  'application',
]);

/**
 * Log pencarian — 07-SEARCH-AND-FAQ.md §11.
 *
 * Yang disimpan hanya yang dibutuhkan untuk content gap analysis: teks query,
 * jumlah hasil, dan hasil mana yang diklik. TIDAK ADA kolom untuk IP, user agent,
 * session id, atau identitas apa pun — §11 meminta "track tanpa menyimpan data
 * sensitif yang tidak dibutuhkan", dan baris ini tidak boleh bisa dirangkai
 * kembali menjadi riwayat pencarian seseorang.
 *
 * `query_normalized` (huruf kecil, spasi rapat) yang dipakai untuk agregasi;
 * `query_raw` disimpan apa adanya karena beda ejaan justru sinyal yang berguna.
 */
export const searchQueries = pgTable(
  'search_queries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    queryRaw: text('query_raw').notNull(),
    queryNormalized: text('query_normalized').notNull(),
    resultCount: integer('result_count').notNull(),
    /** Diisi belakangan lewat endpoint klik; null berarti tidak ada hasil yang dibuka. */
    clickedEntity: searchEntity('clicked_entity'),
    clickedSlug: text('clicked_slug'),
    /** Peringkat hasil yang diklik (1 = teratas) — bahan evaluasi kualitas ranking. */
    clickedRank: integer('clicked_rank'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('search_queries_normalized_idx').on(table.queryNormalized),
    index('search_queries_created_idx').on(table.createdAt),
    // Query tanpa hasil adalah daftar kerja redaksi (§7), jadi perlu index sendiri.
    index('search_queries_zero_idx').on(table.resultCount, table.createdAt),
  ],
);

export const faqFeedbackReason = pgEnum('faq_feedback_reason', [
  'kurang-jelas',
  'kurang-lengkap',
  'sudah-tidak-berlaku',
  'bukan-jawaban-yang-dicari',
]);

/**
 * Feedback kebermanfaatan FAQ — 07-SEARCH-AND-FAQ.md §10.
 *
 * Baris di sini adalah catatan mentah; `faqs.helpful_yes` / `helpful_no` adalah
 * penghitung agregat yang dipakai ranking. Keduanya disimpan karena alasannya
 * ("kurang lengkap", "sudah tidak berlaku") tidak bisa direkonstruksi dari angka.
 *
 * Tidak ada identitas pengirim yang disimpan — sama alasannya dengan search_queries.
 */
export const faqFeedback = pgTable(
  'faq_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    faqId: uuid('faq_id')
      .notNull()
      .references(() => faqs.id, { onDelete: 'cascade' }),
    isHelpful: boolean('is_helpful').notNull(),
    /** Hanya relevan bila `is_helpful` false; opsional bahkan saat itu. */
    reason: faqFeedbackReason('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('faq_feedback_faq_idx').on(table.faqId, table.createdAt)],
);

/* -------------------------------------------------------------- relations */

export const unitsRelations = relations(units, ({ many, one }) => ({
  parentUnit: one(units, {
    fields: [units.parentUnitId],
    references: [units.id],
    relationName: 'unit_parent',
  }),
  childUnits: many(units, { relationName: 'unit_parent' }),
  services: many(services),
  programs: many(programs),
  events: many(events),
  faqs: many(faqs),
  applications: many(applications),
  contacts: many(contacts),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  ownerUnit: one(units, { fields: [services.ownerUnitId], references: [units.id] }),
  audiences: many(servicesToAudiences),
  programs: many(programsToServices),
  faqs: many(faqsToServices),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  ownerUnit: one(units, { fields: [programs.ownerUnitId], references: [units.id] }),
  audiences: many(programsToAudiences),
  services: many(programsToServices),
  faqs: many(faqsToPrograms),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  organizerUnit: one(units, { fields: [events.organizerUnitId], references: [units.id] }),
  relatedProgram: one(programs, { fields: [events.relatedProgramId], references: [programs.id] }),
}));

export const faqsRelations = relations(faqs, ({ one, many }) => ({
  ownerUnit: one(units, { fields: [faqs.ownerUnitId], references: [units.id] }),
  category: one(faqCategories, { fields: [faqs.categoryId], references: [faqCategories.id] }),
  services: many(faqsToServices),
  programs: many(faqsToPrograms),
  feedback: many(faqFeedback),
}));

export const faqFeedbackRelations = relations(faqFeedback, ({ one }) => ({
  faq: one(faqs, { fields: [faqFeedback.faqId], references: [faqs.id] }),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  ownerUnit: one(units, { fields: [applications.ownerUnitId], references: [units.id] }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  ownerUnit: one(units, { fields: [contacts.ownerUnitId], references: [units.id] }),
}));

export const servicesToAudiencesRelations = relations(servicesToAudiences, ({ one }) => ({
  service: one(services, { fields: [servicesToAudiences.serviceId], references: [services.id] }),
  audience: one(audiences, {
    fields: [servicesToAudiences.audienceId],
    references: [audiences.id],
  }),
}));

export const programsToAudiencesRelations = relations(programsToAudiences, ({ one }) => ({
  program: one(programs, { fields: [programsToAudiences.programId], references: [programs.id] }),
  audience: one(audiences, {
    fields: [programsToAudiences.audienceId],
    references: [audiences.id],
  }),
}));

export const programsToServicesRelations = relations(programsToServices, ({ one }) => ({
  program: one(programs, { fields: [programsToServices.programId], references: [programs.id] }),
  service: one(services, { fields: [programsToServices.serviceId], references: [services.id] }),
}));

export const faqsToServicesRelations = relations(faqsToServices, ({ one }) => ({
  faq: one(faqs, { fields: [faqsToServices.faqId], references: [faqs.id] }),
  service: one(services, { fields: [faqsToServices.serviceId], references: [services.id] }),
}));

export const faqsToProgramsRelations = relations(faqsToPrograms, ({ one }) => ({
  faq: one(faqs, { fields: [faqsToPrograms.faqId], references: [faqs.id] }),
  program: one(programs, { fields: [faqsToPrograms.programId], references: [programs.id] }),
}));

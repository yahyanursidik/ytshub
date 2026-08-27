/**
 * SEED DATA PENGEMBANGAN — BUKAN DATA RESMI YTS.
 *
 * Aturan 05-HALLMARK-ANTI-SLOP.md §7 berlaku penuh di sini. Dilarang menambahkan:
 * statistik, biaya, tanggal konkret, alamat, nomor kontak, testimonial, rating.
 * Field yang menunggu data resmi diisi string PLACEHOLDER yang terlihat jelas,
 * bukan ditebak.
 *
 * Nama entitas di bawah hanya yang sudah disebut dalam dokumen requirement
 * (yts-hub-md/03-LANDING-PAGE-UIUX.md dan 07-SEARCH-AND-FAQ.md).
 *
 * Setiap baris diberi kolom `code` berawalan agar mudah dibedakan dari data
 * produksi dan dihapus massal saat data asli masuk.
 */

export const PLACEHOLDER = 'PLACEHOLDER — menunggu data resmi unit';

/** Prefix penanda. Semua baris seed memakainya; `db:seed:clear` menghapus berdasarkan ini. */
export const SEED_CODE_PREFIX = 'DEV-';

export const seedAudiences = [
  { slug: 'orang-tua', label: 'Orang tua' },
  { slug: 'siswa', label: 'Siswa & peserta' },
  { slug: 'jamaah', label: 'Jamaah' },
  { slug: 'donatur', label: 'Donatur' },
  { slug: 'relawan', label: 'Relawan' },
  { slug: 'mitra', label: 'Mitra' },
  { slug: 'umum', label: 'Masyarakat umum' },
];

export const seedFaqCategories = [
  { slug: 'pendidikan', label: 'Pendidikan', summary: 'Pendaftaran, jenjang, dan kegiatan belajar.' },
  { slug: 'donasi', label: 'Donasi', summary: 'Kanal donasi resmi dan penyalurannya.' },
  { slug: 'dakwah', label: 'Dakwah', summary: 'Kajian, rekaman, dan materi.' },
  { slug: 'umum', label: 'Umum', summary: 'Pertanyaan lintas unit.' },
];

export const seedUnits = [
  {
    code: `${SEED_CODE_PREFIX}UNIT-TSLS`,
    slug: 'ts-lab-school',
    sortOrder: 1,
    title: 'TS Lab School',
    shortName: 'TS Lab School',
    kind: 'pendidikan' as const,
    summary: 'Unit pendidikan formal YTS beserta jenjang dan layanannya.',
    about: PLACEHOLDER,
  },
  {
    code: `${SEED_CODE_PREFIX}UNIT-TSLL`,
    slug: 'tsl-learning',
    sortOrder: 2,
    title: 'TSL Learning',
    shortName: 'TSL Learning',
    kind: 'digital' as const,
    summary: 'Platform belajar daring untuk kelas dan materi YTS.',
    about: PLACEHOLDER,
  },
  {
    code: `${SEED_CODE_PREFIX}UNIT-KS`,
    slug: 'kajian-sunnah',
    sortOrder: 3,
    title: 'Kajian Sunnah',
    shortName: 'Kajian Sunnah',
    kind: 'dakwah' as const,
    summary: 'Penyelenggaraan kajian rutin, rekaman, dan materi dakwah.',
    about: PLACEHOLDER,
  },
  {
    code: `${SEED_CODE_PREFIX}UNIT-SOS`,
    slug: 'program-sosial',
    sortOrder: 4,
    title: 'Program Sosial',
    shortName: 'Program Sosial',
    kind: 'sosial' as const,
    summary: 'Penyaluran donasi dan kegiatan sosial kelembagaan.',
    about: PLACEHOLDER,
  },
  {
    code: `${SEED_CODE_PREFIX}UNIT-HUB`,
    slug: 'yts-hub',
    sortOrder: 5,
    title: 'YTS Hub',
    shortName: 'YTS Hub',
    kind: 'digital' as const,
    summary: 'Pengelola pusat informasi dan direktori sistem digital YTS.',
    about: PLACEHOLDER,
  },
];

export const seedServices = [
  {
    code: `${SEED_CODE_PREFIX}SERVICE-SPMB-TSLS`,
    slug: 'ppdb-online',
    sortOrder: 1,
    title: 'PPDB Online',
    summary: 'Pendaftaran peserta didik baru untuk unit pendidikan YTS.',
    category: 'Pendidikan',
    ownerUnitSlug: 'ts-lab-school',
    audienceSlugs: ['orang-tua', 'siswa'],
    requirements: PLACEHOLDER,
    processSteps: PLACEHOLDER,
    feeInformation: PLACEHOLDER,
    ctaLabel: 'Buka layanan',
    ctaUrl: null,
    isExternal: true,
    isPopular: true,
  },
  {
    code: `${SEED_CODE_PREFIX}SERVICE-DONASI`,
    slug: 'donasi-online',
    sortOrder: 2,
    title: 'Donasi Online',
    summary: 'Kanal donasi resmi YTS beserta penjelasan peruntukannya.',
    category: 'Donasi',
    ownerUnitSlug: 'program-sosial',
    audienceSlugs: ['donatur', 'jamaah', 'umum'],
    requirements: PLACEHOLDER,
    processSteps: PLACEHOLDER,
    feeInformation: null,
    ctaLabel: 'Buka layanan',
    ctaUrl: null,
    isExternal: true,
    isPopular: true,
  },
  {
    code: `${SEED_CODE_PREFIX}SERVICE-KONSULTASI`,
    slug: 'konsultasi',
    sortOrder: 3,
    title: 'Konsultasi',
    summary: 'Ajukan pertanyaan ke unit yang berwenang melalui kanal resmi.',
    category: 'Layanan umat',
    ownerUnitSlug: 'kajian-sunnah',
    audienceSlugs: ['jamaah', 'umum'],
    requirements: PLACEHOLDER,
    processSteps: PLACEHOLDER,
    feeInformation: null,
    ctaLabel: 'Lihat cara mengajukan',
    ctaUrl: '/layanan/konsultasi',
    isExternal: false,
    isPopular: true,
  },
  {
    code: `${SEED_CODE_PREFIX}SERVICE-CEK-DONASI`,
    slug: 'cek-status-donasi',
    sortOrder: 4,
    title: 'Cek Status Donasi',
    summary: 'Periksa status penerimaan dan penyaluran donasi yang telah dikirim.',
    category: 'Donasi',
    ownerUnitSlug: 'program-sosial',
    audienceSlugs: ['donatur'],
    requirements: PLACEHOLDER,
    processSteps: PLACEHOLDER,
    feeInformation: null,
    ctaLabel: 'Buka layanan',
    ctaUrl: null,
    isExternal: true,
    isPopular: true,
  },
  {
    code: `${SEED_CODE_PREFIX}SERVICE-MATERI`,
    slug: 'unduh-materi',
    sortOrder: 5,
    title: 'Unduh Materi',
    summary: 'Materi kajian dan bahan belajar yang boleh diakses publik.',
    category: 'Dakwah',
    ownerUnitSlug: 'kajian-sunnah',
    audienceSlugs: ['jamaah', 'umum'],
    requirements: PLACEHOLDER,
    processSteps: PLACEHOLDER,
    feeInformation: null,
    ctaLabel: 'Lihat materi',
    ctaUrl: '/layanan/unduh-materi',
    isExternal: false,
    isPopular: true,
  },
];

export const seedPrograms = [
  {
    code: `${SEED_CODE_PREFIX}PROGRAM-BID`,
    slug: 'belajar-islam-dasar',
    sortOrder: 1,
    title: 'Belajar Islam Dasar',
    summary: 'Kelas pengantar untuk peserta yang baru mulai belajar, disusun bertahap per materi.',
    category: 'Belajar Islam',
    ownerUnitSlug: 'tsl-learning',
    audienceSlugs: ['umum', 'jamaah'],
    programStatus: 'berjalan' as const,
    scheduleSummary: `Jadwal: ${PLACEHOLDER}`,
    locationSummary: null,
    relatedServiceSlugs: ['unduh-materi'],
    isFeatured: true,
  },
  {
    code: `${SEED_CODE_PREFIX}PROGRAM-KR`,
    slug: 'kajian-rutin',
    sortOrder: 2,
    title: 'Kajian Rutin',
    summary: 'Kajian berkala terbuka untuk umum beserta rekaman materinya.',
    category: 'Kajian',
    ownerUnitSlug: 'kajian-sunnah',
    audienceSlugs: ['jamaah', 'umum'],
    programStatus: 'berjalan' as const,
    scheduleSummary: `Jadwal: ${PLACEHOLDER}`,
    locationSummary: null,
    relatedServiceSlugs: ['unduh-materi', 'konsultasi'],
    isFeatured: true,
  },
  {
    code: `${SEED_CODE_PREFIX}PROGRAM-PRE`,
    slug: 'ts-lab-school-preschool',
    sortOrder: 3,
    title: 'TS Lab School Preschool',
    summary: 'Jenjang preschool beserta alur pendaftaran dan persyaratannya.',
    category: 'Pendidikan',
    ownerUnitSlug: 'ts-lab-school',
    audienceSlugs: ['orang-tua'],
    programStatus: 'akan-datang' as const,
    scheduleSummary: `Periode pendaftaran: ${PLACEHOLDER}`,
    locationSummary: null,
    relatedServiceSlugs: ['ppdb-online'],
    isFeatured: true,
  },
];

export const seedFaqs = [
  {
    code: `${SEED_CODE_PREFIX}FAQ-DAFTAR-SEKOLAH`,
    slug: 'cara-mendaftar-sekolah-yts',
    sortOrder: 1,
    question: 'Bagaimana cara mendaftar sekolah YTS?',
    summary: 'Melalui layanan PPDB Online milik unit pendidikan terkait.',
    answer:
      'Pendaftaran dilakukan melalui layanan PPDB Online milik unit pendidikan terkait. Buka halaman layanan PPDB untuk melihat persyaratan, alur, dan tautan resmi ke sistem pendaftaran. Detail persyaratan mengikuti pengumuman resmi unit.',
    categorySlug: 'pendidikan',
    ownerUnitSlug: 'ts-lab-school',
    keywords: ['ppdb', 'pendaftaran', 'sekolah', 'preschool', 'spmb'],
    relatedServiceSlugs: ['ppdb-online'],
    relatedProgramSlugs: ['ts-lab-school-preschool'],
    isPopular: true,
  },
  {
    code: `${SEED_CODE_PREFIX}FAQ-DONASI`,
    slug: 'cara-berdonasi',
    sortOrder: 2,
    question: 'Bagaimana cara berdonasi?',
    summary: 'Melalui kanal donasi resmi pada halaman layanan Donasi Online.',
    answer:
      'Gunakan kanal donasi resmi yang tercantum pada halaman layanan Donasi Online. Halaman tersebut menjelaskan peruntukan donasi dan cara memeriksa statusnya. Hindari mengirim donasi melalui kanal yang tidak tercantum di YTS Hub.',
    categorySlug: 'donasi',
    ownerUnitSlug: 'program-sosial',
    keywords: ['donasi', 'infak', 'sedekah', 'transfer'],
    relatedServiceSlugs: ['donasi-online', 'cek-status-donasi'],
    relatedProgramSlugs: [],
    isPopular: true,
  },
  {
    code: `${SEED_CODE_PREFIX}FAQ-REKAMAN`,
    slug: 'akses-rekaman-kajian',
    sortOrder: 3,
    question: 'Bagaimana mengakses rekaman kajian?',
    summary: 'Melalui halaman program Kajian Rutin dan layanan Unduh Materi.',
    answer:
      'Rekaman kajian yang boleh diakses publik tersedia melalui halaman program Kajian Rutin dan layanan Unduh Materi. Sebagian materi mungkin dibatasi sesuai kebijakan unit pemiliknya.',
    categorySlug: 'dakwah',
    ownerUnitSlug: 'kajian-sunnah',
    keywords: ['rekaman', 'kajian', 'materi', 'audio', 'video'],
    relatedServiceSlugs: ['unduh-materi'],
    relatedProgramSlugs: ['kajian-rutin'],
    isPopular: true,
  },
  {
    code: `${SEED_CODE_PREFIX}FAQ-KONTAK`,
    slug: 'menghubungi-admin-layanan',
    sortOrder: 4,
    question: 'Bagaimana menghubungi admin layanan?',
    summary: 'Melalui kanal kontak resmi pada halaman layanan terkait.',
    answer:
      'Setiap layanan memiliki unit pemilik. Buka halaman layanan yang dimaksud, lalu gunakan kanal kontak resmi yang tercantum di sana agar pertanyaan langsung sampai ke unit yang berwenang.',
    categorySlug: 'umum',
    ownerUnitSlug: 'yts-hub',
    keywords: ['kontak', 'admin', 'bantuan', 'hubungi'],
    relatedServiceSlugs: ['konsultasi'],
    relatedProgramSlugs: [],
    isPopular: true,
  },
];

export const seedApplications = [
  {
    code: `${SEED_CODE_PREFIX}APP-TSL-LEARNING`,
    slug: 'tsl-learning',
    sortOrder: 1,
    title: 'TSL Learning',
    name: 'TSL Learning',
    summary: 'Platform kelas daring: materi, kelas, dan progres belajar peserta.',
    kind: 'aplikasi' as const,
    ownerUnitSlug: 'tsl-learning',
    url: null,
    ctaLabel: 'Buka',
  },
  {
    code: `${SEED_CODE_PREFIX}APP-PORTAL-SPMB`,
    slug: 'portal-spmb',
    sortOrder: 2,
    title: 'Portal SPMB',
    name: 'Portal SPMB',
    summary: 'Sistem pendaftaran peserta didik baru untuk unit pendidikan.',
    kind: 'portal' as const,
    ownerUnitSlug: 'ts-lab-school',
    url: null,
    ctaLabel: 'Buka',
  },
  {
    code: `${SEED_CODE_PREFIX}WEB-KAJIAN`,
    slug: 'kajian-sunnah-web',
    sortOrder: 3,
    title: 'Kajian Sunnah',
    name: 'Kajian Sunnah',
    summary: 'Website publikasi jadwal dan rekaman kajian.',
    kind: 'website' as const,
    ownerUnitSlug: 'kajian-sunnah',
    url: null,
    ctaLabel: 'Buka',
  },
];

/** Query populer di bawah search hero — 03-LANDING-PAGE-UIUX.md §4. */
export const seedPopularQueries = [
  'cara mendaftar sekolah',
  'jadwal kajian',
  'donasi',
  'rekaman kajian',
];

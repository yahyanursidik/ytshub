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
  {
    slug: 'pendidikan',
    label: 'Pendidikan',
    summary: 'Pendaftaran, jenjang, dan kegiatan belajar.',
  },
  { slug: 'donasi', label: 'Donasi', summary: 'Kanal donasi resmi dan penyalurannya.' },
  { slug: 'dakwah', label: 'Dakwah', summary: 'Kajian, rekaman, dan materi.' },
  { slug: 'umum', label: 'Umum', summary: 'Pertanyaan lintas unit.' },
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


/**
 * Event.
 *
 * Tanggal event adalah salah satu hal yang dilarang dikarang (05-HALLMARK §7),
 * jadi `startAt`/`endAt` dibiarkan null dan halaman menampilkan status apa adanya.
 * Struktur tanggalnya sudah siap di database; yang belum ada hanya isinya.
 */
export const seedEvents = [
  {
    code: `${SEED_CODE_PREFIX}EVENT-KAJIAN-PEKANAN`,
    slug: 'kajian-pekanan',
    sortOrder: 1,
    title: 'Kajian Pekanan',
    summary: 'Kajian rutin terbuka untuk umum yang diselenggarakan unit dakwah.',
    organizerUnitSlug: 'kajian-sunnah',
    format: 'onsite' as const,
    location: PLACEHOLDER,
    speakerSummary: PLACEHOLDER,
    relatedProgramSlug: 'kajian-rutin',
  },
  {
    code: `${SEED_CODE_PREFIX}EVENT-KELAS-PERDANA`,
    slug: 'kelas-perdana-belajar-islam-dasar',
    sortOrder: 2,
    title: 'Kelas Perdana Belajar Islam Dasar',
    summary: 'Pertemuan pembuka program Belajar Islam Dasar untuk peserta baru.',
    organizerUnitSlug: 'tsl-learning',
    format: 'online' as const,
    location: null,
    speakerSummary: PLACEHOLDER,
    relatedProgramSlug: 'belajar-islam-dasar',
  },
  {
    code: `${SEED_CODE_PREFIX}EVENT-SOSIALISASI-PPDB`,
    slug: 'sosialisasi-ppdb',
    sortOrder: 3,
    title: 'Sosialisasi PPDB',
    summary: 'Penjelasan alur dan persyaratan pendaftaran untuk orang tua calon peserta didik.',
    organizerUnitSlug: 'ts-lab-school',
    format: 'hybrid' as const,
    location: PLACEHOLDER,
    speakerSummary: null,
    relatedProgramSlug: 'ts-lab-school-preschool',
  },
];

/**
 * Kontak.
 *
 * Nilai kanal (`value`) sengaja null: nomor, email, dan alamat termasuk yang
 * dilarang dikarang. Yang di-seed hanya STRUKTUR kanalnya, supaya halaman detail
 * unit bisa dibangun dan diuji, lalu unit pemilik tinggal mengisi nilainya.
 */
export const seedContacts = [
  {
    code: `${SEED_CODE_PREFIX}CONTACT-01`,
    ownerUnitSlug: 'ts-lab-school',
    label: 'Admin PPDB',
    channel: 'WhatsApp',
    value: null,
    note: PLACEHOLDER,
  },
  {
    code: `${SEED_CODE_PREFIX}CONTACT-02`,
    ownerUnitSlug: 'program-sosial',
    label: 'Admin Donasi',
    channel: 'WhatsApp',
    value: null,
    note: PLACEHOLDER,
  },
  {
    code: `${SEED_CODE_PREFIX}CONTACT-03`,
    ownerUnitSlug: 'kajian-sunnah',
    label: 'Informasi Kajian',
    channel: 'WhatsApp',
    value: null,
    note: PLACEHOLDER,
  },
  {
    code: `${SEED_CODE_PREFIX}CONTACT-04`,
    ownerUnitSlug: 'tsl-learning',
    label: 'Bantuan Kelas Daring',
    channel: 'Email',
    value: null,
    note: PLACEHOLDER,
  },
  {
    code: `${SEED_CODE_PREFIX}CONTACT-05`,
    ownerUnitSlug: 'yts-hub',
    label: 'Kontak Umum YTS Hub',
    channel: 'Email',
    value: null,
    note: PLACEHOLDER,
  },
];

/** Query populer di bawah search hero — 03-LANDING-PAGE-UIUX.md §4. */
export const seedPopularQueries = [
  'cara mendaftar sekolah',
  'jadwal kajian',
  'donasi',
  'rekaman kajian',
];

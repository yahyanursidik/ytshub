/**
 * DATA RESMI YAYASAN TARBIYAH SUNNAH.
 *
 * Berbeda dari seed-data.ts, isi berkas ini BUKAN contoh: nama unit dan alamat
 * sistem di sini diberikan langsung oleh pengurus yayasan. Karena itu ia:
 *
 * - memakai prefix kode `YTS-`, bukan `DEV-`;
 * - TIDAK ikut terhapus oleh `npm run db:seed:clear`;
 * - dimuat dengan upsert berdasarkan `code`, sehingga menjalankannya berulang
 *   memperbarui baris yang ada alih-alih menggandakannya.
 *
 * ## Yang tetap tidak boleh dikarang
 *
 * Aturan 05-HALLMARK-ANTI-SLOP.md §7 tetap berlaku penuh. Yang kita ketahui
 * hanyalah nama dan alamat sistem; persyaratan, biaya, jadwal, alamat kantor,
 * dan nomor kontak TIDAK ada di sini dan tidak boleh ditambahkan sampai unit
 * pemiliknya mengisinya lewat admin. Ringkasan tiap baris ditulis dari fungsi
 * sistemnya sebagaimana disebutkan pengurus — bukan dari isi situsnya.
 *
 * ## Catatan alamat
 *
 * `abuhaidarassundawy.id` disebutkan sebagai `http://`. Alamat itu sudah
 * mengalihkan ke `https://`, jadi yang disimpan versi HTTPS-nya — supaya
 * pengunjung tidak melewati satu lompatan yang mengirim permintaan pertamanya
 * tanpa enkripsi.
 */

/** Prefix kode data resmi. `db:seed:clear` sengaja tidak menyentuh baris ini. */
export const OFFICIAL_CODE_PREFIX = 'YTS-';

/**
 * Kategori registry untuk sistem tempat orang BELAJAR.
 *
 * Dijadikan konstanta, bukan string yang diketik ulang di beberapa tempat:
 * halaman /belajar, section beranda, dan seed semuanya bergantung pada nilai
 * yang sama persis. Satu salah ketik akan membuat halaman itu kosong tanpa
 * error apa pun — kegagalan yang paling sulit disadari.
 *
 * Yang masuk kategori ini hanya sistem tempat jamaah benar-benar belajar:
 * membuka materi, mengikuti kelas, menyimak rekaman. Portal pendaftaran dan
 * situs informasi TIDAK termasuk meski dimiliki unit pendidikan — di sana orang
 * mendaftar dan membaca, bukan belajar.
 */
export const LEARNING_CATEGORY = 'pembelajaran';

export interface OfficialUnit {
  code: string;
  slug: string;
  sortOrder: number;
  title: string;
  shortName: string;
  kind: 'pendidikan' | 'dakwah' | 'sosial' | 'digital' | 'operasional';
  summary: string;
  about: string | null;
  /**
   * Ditulis eksplisit sebagai `string | null`, bukan dibiarkan disimpulkan.
   * Saat ini seluruhnya null (alamat unit ada di registry), dan tanpa anotasi
   * TypeScript akan menyimpulkan tipenya `null` — sehingga mengisi satu alamat
   * di kemudian hari gagal di-typecheck tanpa alasan yang jelas.
   */
  websiteUrl: string | null;
}

/**
 * Unit yayasan.
 *
 * `websiteUrl` sengaja null di SELURUH unit. Situs milik unit tetap tercatat —
 * tetapi di registry aplikasi & website di bawah, bukan di dua tempat sekaligus.
 * Halaman unit tidak kehilangan apa pun karenanya: `getUnitDetail()` sudah
 * menampilkan registry milik unit tersebut.
 *
 * Alasannya bukan kerapian belaka. URL yang tercatat dua kali akan diperiksa
 * dua kali oleh pemantau tautan Fase 6, menghasilkan dua baris yang bisa
 * berbeda statusnya, dan admin melihat alamat yang sama dua kali dengan dua
 * kesimpulan. Ada test yang menjaga agar itu tidak terjadi.
 */
export const officialUnits: OfficialUnit[] = [
  {
    code: `${OFFICIAL_CODE_PREFIX}UNIT-YTS`,
    slug: 'yayasan-tarbiyah-sunnah',
    sortOrder: 0,
    title: 'Yayasan Tarbiyah Sunnah',
    shortName: 'Yayasan',
    kind: 'operasional' as const,
    summary: 'Lembaga induk yang menaungi seluruh unit pendidikan, dakwah, dan sosial YTS.',
    about: null,
    websiteUrl: null,
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}UNIT-MTQ`,
    slug: 'mahad-tahfidzul-quran',
    sortOrder: 1,
    title: "Ma'had Tahfidzul Qur'an Tarbiyah Sunnah",
    shortName: "Ma'had Tahfidzul Qur'an",
    kind: 'pendidikan' as const,
    summary: "Unit pendidikan tahfidzul Qur'an Yayasan Tarbiyah Sunnah.",
    about: null,
    websiteUrl: null,
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}UNIT-TSLS`,
    slug: 'ts-lab-school',
    sortOrder: 2,
    title: 'TS Lab School',
    shortName: 'TS Lab School',
    kind: 'pendidikan' as const,
    summary:
      'Unit pendidikan formal YTS: Preschool tatap muka, Preschool HBL/daring, dan Elementary.',
    about: null,
    websiteUrl: null,
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}UNIT-TSLL`,
    slug: 'tsl-learning',
    sortOrder: 3,
    title: 'Tarbiyah Sunnah Learning',
    shortName: 'TSL',
    kind: 'digital' as const,
    summary: 'Unit penyelenggara program pembelajaran daring YTS.',
    about: null,
    websiteUrl: null,
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}UNIT-KS`,
    slug: 'kajian-sunnah',
    sortOrder: 4,
    title: 'Kajian Sunnah',
    shortName: 'Kajian Sunnah',
    kind: 'dakwah' as const,
    summary: 'Penyelenggaraan kajian rutin, rekaman, dan materi dakwah.',
    about: null,
    websiteUrl: null,
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}UNIT-SOS`,
    slug: 'program-sosial',
    sortOrder: 5,
    title: 'Program Sosial',
    shortName: 'Program Sosial',
    kind: 'sosial' as const,
    summary: 'Penyaluran donasi dan kegiatan sosial kelembagaan.',
    about: null,
    websiteUrl: null,
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}UNIT-HUB`,
    slug: 'yts-hub',
    sortOrder: 6,
    title: 'YTS Hub',
    shortName: 'YTS Hub',
    kind: 'digital' as const,
    summary: 'Pengelola pusat informasi dan direktori sistem digital YTS.',
    about: null,
    websiteUrl: null,
  },
];

/**
 * Pengumuman resmi yang sedang berlaku.
 *
 * ## Kenapa dimuat sekali lalu tidak pernah ditimpa
 *
 * Berbeda dari unit dan registry yang di-upsert setiap `db:seed`, pengumuman
 * dimuat dengan `onConflictDoNothing`. Alasannya: unit dan alamat sistem adalah
 * fakta kanonik yang memang harus dipulihkan seed, sedangkan pengumuman adalah
 * konten redaksional dengan masa berlaku — pengurus akan menyuntingnya,
 * menambah tanggal tutup, dan mencabutnya. Menimpanya setiap seed berarti
 * mengembalikan teks lama dan menghidupkan kembali pengumuman yang sudah
 * sengaja diakhiri.
 *
 * ## Yang TIDAK diisi
 *
 * `endAt` dibiarkan null. Pengurus menyampaikan bahwa SPMB sedang dibuka, bukan
 * kapan ditutup — dan menebak tanggal tutup pendaftaran sekolah adalah persis
 * jenis karangan yang dilarang 05-HALLMARK-ANTI-SLOP.md §7. Selama kosong,
 * laporan kesehatan konten menandainya sebagai pengumuman tanpa tanggal
 * berakhir, sehingga ia tidak bisa terlupakan diam-diam.
 */
export const officialAnnouncements = [
  {
    code: `${OFFICIAL_CODE_PREFIX}ANN-SPMB`,
    slug: 'spmb',
    sortOrder: 1,
    title: 'SPMB Yayasan Tarbiyah Sunnah sedang dibuka',
    summary:
      'Pendaftaran murid baru dibuka serentak di unit pendidikan YTS. Setiap unit memakai portal pendaftarannya sendiri.',
    description:
      'Seleksi Penerimaan Murid Baru (SPMB) dibuka serentak di unit pendidikan Yayasan Tarbiyah Sunnah.\n\n' +
      'Setiap unit menerima pendaftaran lewat portalnya masing-masing. Pilih portal sesuai jenjang yang dituju — pendaftaran di satu portal tidak berlaku untuk unit lain.\n\n' +
      'Persyaratan, jadwal, dan ketentuan biaya diumumkan oleh unit penyelenggara melalui portal dan situs resminya.',
    bannerText: 'SPMB sedang dibuka di unit pendidikan YTS.',
    ctaLabel: 'Lihat portal pendaftaran',
    /** Unit yayasan: pengumuman ini lintas unit, bukan milik satu sekolah. */
    ownerUnitSlug: 'yayasan-tarbiyah-sunnah',
    isHighlighted: true,
    /**
     * Dimundurkan ke awal hari agar pengumuman langsung berlaku begitu seed
     * dijalankan, di zona waktu mana pun server berada.
     */
    startAt: new Date('2026-01-01T00:00:00.000Z'),
    endAt: null,
    /** Portal yang dituju, berurutan. Alamatnya ada di registry, bukan di sini. */
    applicationSlugs: ['spmb-mahad-tahfidzul-quran', 'spmb-ts-lab-school'],
  },
];

/**
 * Registry aplikasi, portal, dan situs — 06-CONTENT-MODEL-AND-CMS.md §8.
 *
 * SELURUH alamat resmi YTS ada di sini, termasuk situs utama tiap unit. Satu
 * daftar, satu tempat memeriksanya, dan tidak ada URL yang tercatat dua kali.
 *
 * Urutannya mengikuti cara orang mencari: situs informasi lebih dulu, lalu
 * portal pendaftaran, lalu sistem pembelajaran. Bukan abjad — abjad tidak
 * memberi tahu apa pun tentang mana yang lebih sering dibutuhkan.
 *
 * Tidak ada satu pun field credential di sini, dan tidak boleh ditambahkan —
 * 08-INTEGRATION-AND-ROUTING.md §7.
 */
export const officialApplications = [
  {
    code: `${OFFICIAL_CODE_PREFIX}WEB-YTS`,
    slug: 'situs-yayasan',
    sortOrder: 1,
    name: 'Situs Yayasan Tarbiyah Sunnah',
    title: 'Situs Yayasan Tarbiyah Sunnah',
    summary: 'Situs informasi utama Yayasan Tarbiyah Sunnah.',
    kind: 'website' as const,
    ownerUnitSlug: 'yayasan-tarbiyah-sunnah',
    url: 'https://tarbiyahsunnah.com/',
    ctaLabel: 'Buka situs',
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}WEB-MTQ`,
    slug: 'situs-mahad-tahfidzul-quran',
    sortOrder: 2,
    name: "Situs Ma'had Tahfidzul Qur'an",
    title: "Situs Ma'had Tahfidzul Qur'an Tarbiyah Sunnah",
    summary: "Situs informasi utama Ma'had Tahfidzul Qur'an Tarbiyah Sunnah.",
    kind: 'website' as const,
    ownerUnitSlug: 'mahad-tahfidzul-quran',
    url: 'https://mahadtarbiyahsunnah.com/',
    ctaLabel: 'Buka situs',
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}WEB-TSLS`,
    slug: 'situs-ts-lab-school',
    sortOrder: 3,
    name: 'Situs TS Lab School',
    title: 'Situs TS Lab School',
    summary:
      'Situs informasi utama TS Lab School: Preschool tatap muka, Preschool HBL/daring, dan Elementary.',
    kind: 'website' as const,
    ownerUnitSlug: 'ts-lab-school',
    url: 'https://tslabschool.sch.id/',
    ctaLabel: 'Buka situs',
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}WEB-TSLL`,
    slug: 'situs-tarbiyah-sunnah-learning',
    sortOrder: 4,
    name: 'Situs Tarbiyah Sunnah Learning',
    title: 'Situs Tarbiyah Sunnah Learning',
    summary: 'Situs informasi utama program-program Tarbiyah Sunnah Learning (TSL).',
    kind: 'website' as const,
    ownerUnitSlug: 'tsl-learning',
    url: 'https://tarbiyahsunnahlearning.or.id/',
    ctaLabel: 'Buka situs',
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}PORTAL-SPMB-MTQ`,
    slug: 'spmb-mahad-tahfidzul-quran',
    sortOrder: 6,
    name: "Portal SPMB Ma'had Tahfidzul Qur'an",
    title: "Portal SPMB Ma'had Tahfidzul Qur'an",
    summary:
      "Portal pendaftaran murid baru Ma'had Tahfidzul Qur'an Tarbiyah Sunnah.",
    kind: 'portal' as const,
    ownerUnitSlug: 'mahad-tahfidzul-quran',
    url: 'https://hub.mahadtarbiyahsunnah.com/login/spmb',
    ctaLabel: 'Buka portal SPMB',
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}PORTAL-SPMB-TSLS`,
    slug: 'spmb-ts-lab-school',
    sortOrder: 7,
    name: 'Portal SPMB TS Lab School',
    title: 'Portal SPMB TS Lab School',
    summary:
      'Portal pendaftaran murid baru TS Lab School: Preschool, Preschool HBL, dan Elementary.',
    kind: 'portal' as const,
    ownerUnitSlug: 'ts-lab-school',
    url: 'https://hub.tslabschool.sch.id/spmb',
    ctaLabel: 'Buka portal SPMB',
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}WEB-BID`,
    slug: 'situs-belajar-islam-dasar',
    sortOrder: 5,
    name: 'Situs Belajar Islam Dasar',
    title: 'Situs Belajar Islam Dasar TSL',
    summary: 'Situs informasi program pembelajaran Belajar Islam Dasar (BID) TSL.',
    kind: 'website' as const,
    ownerUnitSlug: 'tsl-learning',
    url: 'https://tslbelajarislam.id/',
    ctaLabel: 'Buka situs',
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}APP-BID`,
    slug: 'portal-belajar-islam-dasar',
    sortOrder: 8,
    name: 'Portal Belajar Islam Dasar',
    title: 'Portal Pembelajaran Belajar Islam Dasar TSL',
    summary:
      'Ruang belajar peserta program Belajar Islam Dasar (BID) TSL: mengikuti kelas, membuka materi, dan melanjutkan progres belajar.',
    kind: 'portal' as const,
    category: LEARNING_CATEGORY,
    ownerUnitSlug: 'tsl-learning',
    url: 'https://my.tarbiyahsunnahlearning.or.id/',
    ctaLabel: 'Masuk portal',
  },
  {
    code: `${OFFICIAL_CODE_PREFIX}APP-LMS-AHAS`,
    slug: 'lms-abu-haidar-as-sundawy',
    sortOrder: 9,
    name: 'Sistem Pembelajaran Abu Haidar As Sundawy',
    title: 'Sistem Pembelajaran Kajian Abu Haidar As Sundawy',
    summary:
      'Ruang belajar jamaah kajian Ustadz Abu Haidar As Sundawy: mengulang materi, serta menyimak dan menonton kajian tatap muka yang terlewat.',
    kind: 'aplikasi' as const,
    category: LEARNING_CATEGORY,
    ownerUnitSlug: 'kajian-sunnah',
    // Disebutkan sebagai http://; alamat itu mengalihkan ke https:// dan versi
    // aman itulah yang disimpan.
    url: 'https://abuhaidarassundawy.id/',
    ctaLabel: 'Buka sistem',
  },
];

/**
 * Navigasi dan task shortcut.
 *
 * Ini BUKAN konten yang dikelola redaksi — ini struktur navigasi produk
 * (02-INFORMATION-ARCHITECTURE.md §2-4). Karena itu tinggal di kode, bukan di
 * database: mengubahnya adalah keputusan produk, bukan pekerjaan editor.
 *
 * Bandingkan dengan unit/layanan/program/FAQ yang seluruhnya berasal dari
 * core registry lewat src/server/content/public-queries.ts.
 */
import type { IconName } from '@/types/content';

export interface TaskShortcut {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: IconName;
}

/** 03-LANDING-PAGE-UIUX.md §6 — enam task entry point. */
export const taskShortcuts: TaskShortcut[] = [
  {
    id: 'sekolah',
    label: 'Sekolah',
    description: 'Pendaftaran dan informasi sekolah.',
    href: '/layanan?kategori=pendidikan',
    icon: 'school',
  },
  {
    id: 'kajian',
    label: 'Kajian',
    description: 'Jadwal dan rekaman kajian rutin.',
    href: '/program?kategori=kajian',
    icon: 'lecture',
  },
  {
    id: 'belajar-islam',
    label: 'Belajar Islam',
    description: 'Kelas dan materi belajar daring.',
    // Diarahkan ke /belajar, bukan filter program: pintasan ini dibaca sebagai
    // 'saya mau belajar', dan tujuan itu mencakup sistem pembelajarannya —
    // bukan hanya daftar program yang bisa diikuti.
    href: '/belajar',
    icon: 'learn',
  },
  {
    id: 'donasi',
    label: 'Donasi',
    description: 'Kanal donasi resmi dan statusnya.',
    href: '/layanan?kategori=donasi',
    icon: 'donate',
  },
  {
    id: 'event',
    label: 'Event',
    description: 'Agenda kegiatan terbuka untuk umum.',
    href: '/event',
    icon: 'calendar',
  },
  {
    id: 'bantuan',
    label: 'Bantuan',
    description: 'FAQ dan kanal resmi ke admin.',
    href: '/faq',
    icon: 'help',
  },
];

/**
 * Contoh query di bawah search hero — 03-LANDING-PAGE-UIUX.md §4.
 *
 * Sejak Fase 4 daftar ini adalah CADANGAN, bukan sumber utama: beranda memakai
 * query yang benar-benar sering diketik pengunjung (07-SEARCH-AND-FAQ.md §11) dan
 * hanya jatuh ke sini selama riwayat pencarian belum cukup — mis. tepat setelah
 * situs terbit. Isinya karena itu contoh yang jelas-jelas ada jawabannya,
 * bukan tebakan tentang apa yang populer.
 */
export const popularQueries: string[] = [
  'cara mendaftar sekolah',
  'jadwal kajian',
  'donasi',
  'rekaman kajian',
];

/**
 * Navigasi utama — dipakai header dan menu mobile.
 *
 * ## Dua penyimpangan dari 02-INFORMATION-ARCHITECTURE.md §2, keduanya disengaja
 *
 * 1. **"Beranda" dilepas.** Logo di kiri sudah menjadi tautan beranda dengan
 *    nama tersembunyi untuk pembaca layar, dan itu konvensi yang dikenali hampir
 *    semua pengunjung. Satu slot yang hemat lebih berharga daripada mengulang
 *    tautan yang sudah ada tepat di sebelahnya.
 *
 * 2. **"Aplikasi & Website" ditambahkan.** Dokumen yang sama mencantumkannya
 *    sebagai cabang tingkat atas di sitemap §5, tetapi tidak memasukkannya ke
 *    navigasi §2 — dan itu ketidakcocokan di dalam dokumennya sendiri.
 *    Menghubungkan sistem-sistem YTS yang tersebar adalah alasan utama Hub ini
 *    ada; membiarkannya hanya bisa ditemukan lewat beranda berarti menyembunyikan
 *    hal yang paling membedakannya.
 *
 * Jumlahnya tetap tujuh. Menambah tanpa mengurangi akan membuat bilah header
 * berdesakan dengan tombol "Dukung YTS" di layar 1280px.
 *
 * "Belajar" sengaja TIDAK masuk: ia sudah menjadi salah satu enam pintasan tugas
 * tepat di bawah hero, dan mengulangnya di navigasi hanya menambah panjang
 * tanpa menambah jalan masuk.
 */
export const primaryNav = [
  { label: 'Unit', href: '/unit' },
  { label: 'Program', href: '/program' },
  { label: 'Layanan', href: '/layanan' },
  { label: 'Event', href: '/event' },
  { label: 'Aplikasi', href: '/aplikasi' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Hubungi Kami', href: '/hubungi-kami' },
];

# Information Architecture & Navigation — YTS Hub

## 1. Prinsip IA
- Jangan membuat pengguna memahami struktur internal YTS untuk menemukan layanan.
- Gunakan kategori publik yang dikenal pengguna.
- Bedakan `Unit`, `Program`, `Layanan`, dan `Event` secara konseptual.
- Gunakan hubungan silang antar entitas agar tidak ada halaman buntu.

## 2. Primary Navigation
Desktop:

```text
YTS Hub
├── Beranda
├── Unit
├── Program
├── Layanan
├── Event
├── FAQ
└── Hubungi Kami
```

CTA opsional kanan: `Dukung YTS`.

## 3. Mobile Navigation
Header:
- Logo YTS Hub
- Search icon bila diperlukan
- Menu button

Menu sheet/drawer:
- Beranda
- Unit
- Program
- Layanan
- Event
- FAQ
- Hubungi Kami
- Dukung YTS

Hindari bottom navigation publik bila item menjadi terlalu banyak. Bottom nav hanya dipakai bila riset UX menunjukkan 4–5 task utama yang stabil.

## 4. Homepage Task Shortcuts
Quick access:
- Sekolah
- Kajian
- Belajar Islam
- Donasi
- Event
- Bantuan

Shortcut bukan pengganti primary navigation. Ia berfungsi sebagai task entry point.

## 5. Sitemap Publik
```text
Beranda
│
├── Unit
│   └── Detail Unit
│       ├── Tentang
│       ├── Program
│       ├── Layanan
│       ├── Event
│       ├── FAQ
│       ├── Website/Aplikasi
│       └── Kontak
│
├── Program
│   └── Detail Program
│       ├── Ringkasan
│       ├── Untuk siapa
│       ├── Jadwal/status
│       ├── Cara mengikuti
│       ├── FAQ terkait
│       └── CTA layanan
│
├── Layanan
│   └── Detail Layanan
│       ├── Untuk siapa
│       ├── Persyaratan
│       ├── Alur
│       ├── Biaya/infak bila relevan
│       ├── FAQ
│       └── Buka layanan
│
├── Event
│   └── Detail Event
│
├── FAQ
│   ├── Kategori
│   └── Detail FAQ
│
├── Aplikasi & Website
│   └── Detail/redirect context
│
└── Hubungi Kami
```

## 6. Breadcrumb
Gunakan pada halaman level ≥2.

Contoh:
```text
Beranda / Layanan / SPMB
```

Jangan tampilkan breadcrumb di hero landing page.

## 7. Related Content
Setiap detail page minimal mempunyai 2 dari 4 blok berikut:
- FAQ terkait
- Layanan terkait
- Program terkait
- Kontak/next action

## 8. URL Convention
Gunakan URL manusiawi dan stabil:
```text
/unit/ts-lab-school
/program/belajar-islam-dasar
/layanan/spmb
/event/nama-event
/faq/cara-daftar-preschool
/aplikasi/tsl-learning
```

## 9. Filter
Gunakan filter hanya bila daftar sudah membutuhkan penyempitan.

Program:
- Unit
- Topik
- Audience
- Status

Layanan:
- Kategori
- Audience
- Unit

Event:
- Status/waktu
- Format
- Unit

FAQ:
- Kategori
- Unit
- Audience

## 10. Anti-pattern IA
Jangan:
- membuat mega-menu penuh seluruh struktur yayasan;
- menggandakan konten yang sama di banyak hierarchy;
- menggunakan jargon internal sebagai label utama;
- memaksa login untuk informasi publik;
- menyembunyikan kontak resmi terlalu dalam;
- menjadikan setiap kartu sebagai kartu visual besar tanpa prioritas.

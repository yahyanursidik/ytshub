# Landing Page UI/UX Specification — YTS Hub

## 1. Tujuan Landing Page
Landing page adalah **digital front door**. Tugas utama bukan menjelaskan seluruh yayasan, melainkan membantu pengguna menemukan informasi atau layanan secepat mungkin.

## 2. Page Narrative
Urutan informasi:
1. Identitas + navigation
2. Search-first hero
3. Quick task shortcuts
4. Layanan populer
5. Jelajahi YTS
6. Program aktif
7. FAQ terbaru/populer
8. Aplikasi & website
9. Help CTA
10. Footer

Urutan dapat sedikit berubah berdasarkan analytics, tetapi search dan quick tasks selalu berada di atas fold.

## 3. Header
Desktop:
- max-width konsisten dengan content grid;
- logo kiri;
- nav tengah/kanan;
- CTA `Dukung YTS` paling kanan;
- sticky hanya bila tidak mengganggu viewport.

Behavior:
- saat scroll, header boleh berubah menjadi surface lebih solid;
- active nav ditandai secara tenang, bukan pill besar untuk setiap item;
- fokus keyboard jelas.

## 4. Hero
Headline:
> Informasi & Layanan untuk Kebaikan Bersama.

Supporting copy:
> Temukan program, layanan, unit, dan aplikasi YTS dengan cepat dan mudah.

### Search
Input besar sebagai focal point:
- placeholder: `Cari program, layanan, FAQ, atau aplikasi YTS`
- icon search di awal
- tombol `Cari`
- `Enter` harus submit
- autocomplete hanya bila data mendukung

Di bawah search, boleh tampil 3–5 query populer secara tekstual, bukan sebagai puluhan chip.

## 5. Hero Visual
Gunakan:
- off-white / paper surface;
- subtle line texture atau soft wave;
- very low contrast;
- tidak boleh mengalahkan search.

Hindari:
- gradient ungu-biru generik;
- glassmorphism berlebihan;
- blob dekoratif;
- arch/mihrab;
- masjid, bulan-bintang, tasbih, lentera, kitab dekoratif;
- ilustrasi manusia generik.

## 6. Quick Access
6 task shortcut:
- Sekolah
- Kajian
- Belajar Islam
- Donasi
- Event
- Bantuan

Card rules:
- icon 20–24 px;
- title jelas;
- description maksimal 1–2 baris desktop;
- seluruh card clickable;
- hover sederhana: border/translate max 1–2px;
- jangan semua card punya warna background berbeda.

## 7. Layanan Populer
Desktop: 4–5 cards per row sesuai viewport.
Mobile: horizontal snap atau stack 1 kolom/2 kolom berdasarkan isi.

Contoh:
- SPMB
- Donasi Online
- Konsultasi
- Cek Status Donasi
- Unduh Materi

Service card terdiri dari:
- icon
- title
- 1-line/2-line description
- optional category
- arrow/CTA affordance

## 8. Jelajahi YTS
Bukan logo-wall.
Gunakan daftar/card compact untuk unit atau domain yang paling relevan.

Contoh:
- TS Lab School
- TSL Learning
- Kajian Sunnah
- Program sosial

## 9. Program Aktif
Tampilkan maksimal 3–4 highlight di landing page.
Metadata penting:
- kategori/unit
- tanggal jika relevan
- status `Berjalan`, `Akan Datang`, atau `Selesai`

Jangan menampilkan metadata yang tidak membantu pengguna.

## 10. FAQ
Gunakan compact list/accordion.
Prioritaskan pertanyaan paling sering dicari, bukan sekadar paling baru.

Contoh:
- Bagaimana cara mendaftar sekolah YTS?
- Bagaimana cara berdonasi?
- Bagaimana mengakses rekaman kajian?
- Bagaimana menghubungi admin layanan?

CTA: `Lihat semua FAQ`.

## 11. Aplikasi & Website
Tujuan: memperjelas pintu menuju sistem yang sudah ada.

Card:
- nama aplikasi
- fungsi singkat
- owner/unit opsional
- CTA `Buka`
- external-link indicator bila keluar domain

Jangan menampilkan informasi teknis internal di publik.

## 12. Help CTA
Headline:
> Masih butuh bantuan?

Copy:
> Temukan jawaban di FAQ atau hubungi kanal resmi YTS.

CTA:
- `Hubungi Kami`
- `Lihat FAQ`

## 13. Footer
Kelompok:
- Brand description
- Navigasi
- Informasi
- Kontak
- Kebijakan/privasi bila tersedia

Hindari footer dengan 40+ link.

## 14. Responsive Rules
### ≥1280
- max content width 1180–1280px
- generous whitespace
- 12-column grid

### 768–1279
- 8-column grid
- nav bisa collapse sesuai ruang

### <768
- 4-column grid
- hero copy lebih ringkas
- search tetap prominent
- section cards lebih padat
- tidak ada hover-dependent UX

## 15. Interaction States
Setiap interactive component wajib mempunyai:
- default
- hover
- focus-visible
- active/pressed
- disabled bila relevan
- loading bila data async
- empty
- error

## 16. Microcopy
Gunakan Bahasa Indonesia natural dan informatif.
Hindari:
- “Discover amazing experiences”
- “Unlock possibilities”
- “Empowering your journey”
- jargon marketing generik.

Gunakan:
- `Cari informasi`
- `Buka layanan`
- `Lihat program`
- `Hubungi admin`
- `Tidak menemukan jawaban?`

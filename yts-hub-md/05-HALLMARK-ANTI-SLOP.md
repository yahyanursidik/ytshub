# Hallmark & Anti-AI-Slop Rules — YTS Hub

## 1. Tujuan
Hallmark digunakan sebagai quality gate agar UI YTS Hub terasa **dirancang**, bukan hasil rata-rata template AI.

Hallmark menyediakan pola build, audit, redesign, dan study. Untuk proyek ini, jadikan `DESIGN.md`/dokumen design system sebagai input wajib sebelum AI mengubah UI.

## 2. Instalasi
```bash
npx skills add nutlope/hallmark
```

Untuk Codex project-scoped, skill dapat ditempatkan di `.codex/skills/hallmark/` sesuai mekanisme Hallmark.

## 3. Workflow
### Build baru
1. Baca `01-PRODUCT-BRIEF.md`.
2. Baca `02-INFORMATION-ARCHITECTURE.md`.
3. Baca `03-LANDING-PAGE-UIUX.md`.
4. Baca `04-DESIGN-SYSTEM.md`.
5. Jalankan Hallmark/default build discipline.
6. Implementasikan hanya satu section/flow per iterasi.
7. Screenshot desktop + mobile.
8. Audit visual dan accessibility.

### Audit
Gunakan pola:
```text
hallmark audit <target>
```
Audit dahulu, jangan langsung redesign.

### Redesign
Gunakan hanya bila struktur memang salah:
```text
hallmark redesign <target>
```
Pertahankan copy, IA, brand, dan functional requirements; ubah fingerprint visual/structure dengan sengaja.

## 4. Anti-Slop Hard Rules
Jangan menghasilkan:
- hero generic gradient + centered heading + 3 cards tanpa alasan;
- purple/blue neon gradient;
- glassmorphism massal;
- excessive rounded pills;
- floating blobs;
- random decorative sparkles;
- giant icon tiles hanya untuk mengisi ruang;
- dashboard-style cards pada setiap bagian landing page;
- bento grid karena tren, bukan kebutuhan;
- faux testimonials/statistics yang tidak punya data;
- fake logos;
- duplicated CTA;
- copy marketing generik;
- hover animation berlebihan;
- scroll reveal untuk setiap block;
- uneven icon families;
- excessive badge/status pills;
- meaningless gradients pada teks headline.

## 5. YTS-Specific Visual Restrictions
Hindari ornamen klise/tidak relevan:
- arch/mihrab dekoratif;
- masjid siluet;
- bulan-bintang;
- lentera;
- tasbih;
- kitab/buku dekoratif;
- kaligrafi ornamental;
- ilustrasi manusia generik.

Nilai keislaman ditunjukkan melalui **ketertiban, kejelasan, adab visual, kejujuran informasi, dan ketenangan**, bukan simbol dekoratif.

## 6. Composition Rules
- Tentukan focal point hanya 1 per viewport.
- Hero focal point = search.
- Gunakan asymmetry ringan bila membantu karakter.
- Sections boleh memiliki komposisi berbeda; jangan copy-paste grid identik 6 kali.
- Dense list lebih tepat daripada card bila kontennya list.
- Jangan mengubah semua link menjadi button.

## 7. Content Authenticity
Dilarang mengarang:
- jumlah jamaah;
- statistik yayasan;
- status legal;
- nama program;
- biaya;
- alamat;
- nomor WhatsApp;
- rating/testimonial;
- tanggal event.

Gunakan placeholder eksplisit dalam development data.

## 8. Pre-Ship Visual Critique
Sebelum dianggap selesai, tanyakan:
- Apakah halaman ini bisa tertukar dengan landing page SaaS generik?
- Apakah ada elemen yang hanya dekorasi tanpa fungsi?
- Apakah terlalu banyak cards?
- Apakah terlalu banyak rounded rectangle?
- Apakah heading hierarchy terlihat alami?
- Apakah search benar-benar paling menonjol?
- Apakah mobile terlihat dirancang ulang, bukan dikecilkan?
- Apakah copy natural Bahasa Indonesia?

Jika jawaban buruk, revisi sebelum lanjut.

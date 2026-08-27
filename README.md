# YTS Hub

Pusat informasi, katalog layanan, program, event, FAQ, dan direktori sistem digital
Yayasan Tarbiyah Sunnah.

> One Organization → One Registry → One Knowledge Source → Many Services.

## Isi repository

| Folder          | Isi                                                                 |
| --------------- | ------------------------------------------------------------------- |
| `yts-hub-md/`   | Dokumen requirement — brief, IA, UI/UX, design system, content model |
| `yts-hub-web/`  | Implementasi web publik (Astro)                                     |
| `netlify.toml`  | Konfigurasi deploy — harus di root, lihat komentar di dalamnya       |

Mulai dari [`yts-hub-md/README.md`](yts-hub-md/README.md) untuk indeks dokumen, dan
[`yts-hub-web/README.md`](yts-hub-web/README.md) untuk cara menjalankan aplikasinya.

## Status fase

Mengikuti `yts-hub-md/10-DEVELOPMENT-PLAN.md`:

| Fase | Isi                                             | Status  |
| ---- | ----------------------------------------------- | ------- |
| 0    | Repo, tooling, design tokens, base layout       | Selesai |
| 1    | Landing page + shell, typed mock data           | Selesai |
| 2    | Core registry & database                        | Selesai |
| 3    | Public directory routes + detail pages          | Selesai |
| 4    | FAQ center & unified search                     | Selesai |
| 5    | Admin & governance                              | Selesai |
| 6    | Integrasi & broken-link monitoring              | Selesai |
| 7    | Observability & quality                         | Selesai |

## Untuk AI coding assistant

Baca `yts-hub-md/11-AI-CODING-INSTRUCTIONS.md` sebelum mulai. Untuk setiap perubahan UI,
`yts-hub-web/DESIGN.md` dan `yts-hub-md/05-HALLMARK-ANTI-SLOP.md` wajib dibaca lebih dulu.

Aturan yang paling sering dilanggar dan paling penting di proyek ini: **jangan mengarang
data YTS** — statistik, biaya, tanggal, alamat, nomor kontak, testimonial. Gunakan
placeholder eksplisit. Ada test yang menjaga aturan ini di
`yts-hub-web/src/server/db/seed-data.test.ts`.

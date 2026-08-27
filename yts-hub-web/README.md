# YTS Hub — Public Web

Implementasi web publik YTS Hub mengikuti dokumen requirement di `yts-hub-md/`.

**Status: Fase 0, 1, dan 2 selesai.** Fase 3 (directory routes) dan seterusnya belum dikerjakan.

## Menjalankan

Sejak Fase 2 aplikasi membutuhkan PostgreSQL. Build akan berhenti dengan pesan jelas
bila `DATABASE_URL` kosong — itu disengaja, lebih baik gagal cepat daripada
menghasilkan halaman kosong diam-diam.

```bash
npm install
cp .env.example .env        # lalu isi DATABASE_URL
npm run db:migrate          # membuat tabel
npm run db:seed             # mengisi data pengembangan (bertanda DEV-)
npm run dev                 # http://localhost:4321
```

PostgreSQL lokal cukup untuk pengembangan; Neon dipakai untuk staging/production.
Driver dipilih otomatis dari isi `DATABASE_URL` — tidak ada flag terpisah yang bisa
bertentangan.

Perintah lain:

| Perintah                | Fungsi                                                         |
| ----------------------- | -------------------------------------------------------------- |
| `npm run build`         | Production build ke `dist/`                                    |
| `npm run preview`       | Menyajikan hasil build                                         |
| `npm run typecheck`     | `astro check`                                                  |
| `npm run lint`          | ESLint                                                         |
| `npm run test`          | Vitest (termasuk guardrail keaslian konten)                    |
| `npm run verify`        | typecheck + lint + test + build                                |
| `npm run shot`          | Screenshot desktop/tablet/mobile ke `screenshots/`             |
| `npm run audit:a11y`    | Audit accessibility & layout otomatis                          |
| `npm run db:generate`   | Membuat file migrasi SQL dari perubahan skema                  |
| `npm run db:migrate`    | Menjalankan migrasi ke `DATABASE_URL`                          |
| `npm run db:seed`       | Memuat data pengembangan (menghapus & memuat ulang baris DEV-) |
| `npm run db:seed:clear` | Menghapus data pengembangan tanpa menyentuh data asli          |
| `npm run db:status`     | Menghitung baris seed yang ada                                 |
| `npm run db:studio`     | Drizzle Studio untuk melihat isi database                      |

`shot` dan `audit:a11y` memerlukan server yang sedang berjalan (`npm run dev` atau
`npm run preview`) dan Chromium Playwright:

```bash
npx playwright install chromium   # sekali saja
npm run dev                       # terminal 1
npm run audit:a11y                # terminal 2
```

## Stack

Sesuai `10-DEVELOPMENT-PLAN.md` §1, dengan versi dikunci setelah verifikasi rilis:

- **Astro 7.2.8** — HTML-first untuk konten publik
- **React 19 + @astrojs/react** — terpasang untuk island interaktif pada fase berikutnya
- **TypeScript 6** strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`)
- **ESLint 10 + Prettier 3** — flat config
- **Vitest 4**
- **Drizzle ORM 0.45** + drizzle-kit — migrasi di-generate dan di-commit
- **PostgreSQL** — Neon (`@neondatabase/serverless`) untuk serverless,
  postgres.js untuk lokal dan test
- Font self-hosted via Fontsource (tidak ada request ke CDN pihak ketiga)

Catatan: `typescript` dipin ke `6.0.3` karena `@astrojs/check@0.9.10` belum mendukung
TypeScript 7. Naikkan bersama-sama saat `@astrojs/check` sudah kompatibel.

## Struktur

```text
src/
├── components/
│   ├── landing/        # section landing page, satu file per section
│   ├── ui/             # primitive lintas halaman (Icon, placeholder, notice)
│   ├── SiteHeader.astro
│   └── SiteFooter.astro
├── config/navigation.ts  # navigasi & task shortcut (struktur produk, bukan konten)
├── layouts/BaseLayout.astro
├── pages/              # route publik sesuai 02-INFORMATION-ARCHITECTURE.md §8
├── server/             # KODE SERVER — jangan diimpor dari komponen klien
│   ├── db/
│   │   ├── schema.ts   # core registry (06-CONTENT-MODEL-AND-CMS.md)
│   │   ├── client.ts   # pemilihan driver Neon vs postgres.js
│   │   ├── migrate.ts
│   │   ├── seed.ts     # loader seed, idempoten
│   │   └── seed-data.ts # DATA PENGEMBANGAN — bukan data resmi YTS
│   ├── content/public-queries.ts  # satu-satunya jalan konten publik keluar
│   └── env.ts          # validasi environment
├── styles/
│   ├── tokens.css      # design tokens — sumber tunggal warna/tipografi/spacing
│   └── base.css        # reset ringan, layout primitive, button, input, focus
└── types/content.ts    # kontrak konten dari 06-CONTENT-MODEL-AND-CMS.md
drizzle/                # migrasi SQL — di-commit, jangan diedit tangan
scripts/db.ts           # CLI database
tools/                  # script screenshot & audit a11y
```

## Keputusan implementasi yang perlu diketahui

**Landing page tidak memuat framework JS.** Halaman beranda hanya mengirim ±2,5 KB
JavaScript (toggle menu + accordion FAQ) — bukan runtime React ±184 KB. Accordion FAQ
ditulis sebagai komponen Astro dengan `<button aria-expanded>` sesuai
`09-ACCESSIBILITY-PERFORMANCE-SEO.md` §2, dan tetap terbaca penuh bila JS gagal.
React tetap terpasang untuk modul yang benar-benar butuh state pada Fase 4-5
(search autocomplete, admin).

**Komposisi tiap section sengaja berbeda** (`05-HALLMARK-ANTI-SLOP.md` §6):
card grid hanya dipakai di Layanan Populer; Jelajahi YTS memakai daftar padat;
Program Aktif memakai komposisi asimetris; Aplikasi & Website memakai baris lebar.

**Styling komponen anak butuh `:global()`.** Scoped style Astro tidak menjangkau
elemen yang dirender komponen lain — SVG dari `Icon.astro` termasuk. Setiap tempat
yang melakukannya sudah diberi komentar.

**Warna `--c-ink-muted` diturunkan** dari `#687068` ke `#5e665e` supaya rasio kontras
tetap ≥4.5:1 di atas `--surface-muted` dan `--brand-soft`, bukan hanya di atas `--paper`.

**Konten publik hanya boleh keluar lewat `src/server/content/public-queries.ts`.**
Di sanalah gate `status = 'published' AND visibility = 'public'` didefinisikan satu kali,
sehingga tidak ada query yang bisa lupa menyaringnya. Kolom juga dipilih eksplisit:
field internal registry aplikasi (technical owner, repository, hosting, integration notes)
tidak pernah ikut terkirim karena memang tidak pernah di-`select` — bukan karena
komponen kebetulan tidak memakainya. Ada test yang mengisi field itu dengan penanda
lalu memastikan penanda tersebut tidak muncul di hasil publik.

**Seed di `src/server/db/seed-data.ts` adalah data pengembangan, bukan data resmi YTS.**
Setiap baris berkode `DEV-` sehingga `db:seed:clear` bisa menghapusnya tanpa menyentuh
data asli. Ada test yang gagal bila seseorang menyisipkan statistik, biaya, tanggal,
alamat, atau nomor kontak karangan. URL sistem eksternal dibiarkan `null` sampai unit
pemilik mengisinya — tidak ditebak.

**`sortOrder` menentukan urutan tampil, bukan abjad.** "Layanan yang paling sering dicari"
diurutkan lewat kolom yang diisi pengelola. Kolom ini `integer`, bukan `text`, karena
pengurutan teks menempatkan "10" sebelum "2" — alasan yang sama membuat penghitung
`helpful_yes`/`helpful_no` juga integer. Fase 4 menggantinya dengan peringkat dari
analytics pencarian.

**Route yang isinya belum dikerjakan tetap dibuat** dan memakai `PhasePlaceholder`
yang menyatakan fasenya secara jujur, supaya tidak ada dead link dan tidak ada konten
palsu. Semua halaman ini `noindex`.

## Yang belum dikerjakan

| Fase | Isi                                             | Status  |
| ---- | ----------------------------------------------- | ------- |
| 0    | Repo, tooling, design tokens, base layout       | Selesai |
| 1    | Landing page + shell, mock data typed           | Selesai |
| 2    | Core registry & database (Neon + Drizzle)       | Selesai |
| 3    | Public directory routes + detail pages          | Belum   |
| 4    | FAQ center & unified search                     | Belum   |
| 5    | Admin & governance (RBAC, lifecycle, audit log) | Belum   |
| 6    | Integrasi & broken-link monitoring              | Belum   |
| 7    | Observability & quality                         | Belum   |

## Catatan untuk Fase 3 dan seterusnya

**Transaksi.** Driver Neon HTTP tidak mendukung transaksi interaktif. Fase 5
(approve/publish lifecycle) kemungkinan membutuhkannya — pakai driver WebSocket Neon
untuk jalur itu, jangan berasumsi transaksi jalan hanya karena lolos di Postgres lokal.
Catatan ini juga ada di `src/server/db/client.ts`.

**Search (Fase 4).** Skema sudah menyiapkan `faqs.keywords` (array) untuk sinyal
ranking alias di 07-SEARCH §4. Kolom `tsvector` dan index GIN ditambahkan pada Fase 4
saat query search-nya benar-benar ditulis, bukan sekarang.

Hal yang masih perlu diputuskan:

- domain resmi (`site` di `astro.config.mjs` masih `hub.example.org`);
- canonical URL untuk tiap layanan/aplikasi (seed masih `null` — sengaja tidak ditebak);
- solusi autentikasi untuk Fase 5 (`10-DEVELOPMENT-PLAN.md` §1 belum menetapkan).

# YTS Hub — Public Web

Implementasi web publik YTS Hub mengikuti dokumen requirement di `yts-hub-md/`.

**Status: Fase 0 dan Fase 1 selesai.** Fase 2 (database) dan seterusnya belum dikerjakan.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:4321
```

Perintah lain:

| Perintah             | Fungsi                                                       |
| -------------------- | ------------------------------------------------------------ |
| `npm run build`      | Production build ke `dist/`                                  |
| `npm run preview`    | Menyajikan hasil build                                       |
| `npm run typecheck`  | `astro check`                                                |
| `npm run lint`       | ESLint                                                       |
| `npm run test`       | Vitest (termasuk guardrail keaslian konten)                  |
| `npm run verify`     | typecheck + lint + test + build                              |
| `npm run shot`       | Screenshot desktop/tablet/mobile ke `screenshots/`           |
| `npm run audit:a11y` | Audit accessibility & layout otomatis                        |

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
├── data/               # FIXTURE PENGEMBANGAN — lihat src/data/README.md
├── layouts/BaseLayout.astro
├── pages/              # route publik sesuai 02-INFORMATION-ARCHITECTURE.md §8
├── styles/
│   ├── tokens.css      # design tokens — sumber tunggal warna/tipografi/spacing
│   └── base.css        # reset ringan, layout primitive, button, input, focus
└── types/content.ts    # kontrak konten dari 06-CONTENT-MODEL-AND-CMS.md
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

**Semua data di `src/data/` adalah fixture, bukan data resmi YTS.** Banner penanda
tampil otomatis di mode dev. Ada test yang gagal bila seseorang menyisipkan statistik,
biaya, tanggal, atau nomor kontak karangan ke fixture.

**Route yang isinya belum dikerjakan tetap dibuat** dan memakai `PhasePlaceholder`
yang menyatakan fasenya secara jujur, supaya tidak ada dead link dan tidak ada konten
palsu. Semua halaman ini `noindex`.

## Yang belum dikerjakan

| Fase | Isi                                              | Status        |
| ---- | ------------------------------------------------ | ------------- |
| 0    | Repo, tooling, design tokens, base layout        | Selesai       |
| 1    | Landing page + shell, mock data typed            | Selesai       |
| 2    | Core registry & database (Neon + Drizzle)        | Belum         |
| 3    | Public directory routes + detail pages           | Belum         |
| 4    | FAQ center & unified search                      | Belum         |
| 5    | Admin & governance (RBAC, lifecycle, audit log)  | Belum         |
| 6    | Integrasi & broken-link monitoring               | Belum         |
| 7    | Observability & quality                          | Belum         |

Hal yang perlu diputuskan sebelum Fase 2:

- domain resmi (`site` di `astro.config.mjs` masih `hub.example.org`);
- canonical URL untuk tiap layanan/aplikasi (fixture masih `#`);
- solusi autentikasi untuk Fase 5 (`10-DEVELOPMENT-PLAN.md` §1 belum menetapkan).

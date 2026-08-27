# YTS Hub — Public Web

Implementasi web publik YTS Hub mengikuti dokumen requirement di `yts-hub-md/`.

**Status: Fase 0–6 selesai.** Fase 7 (observability & quality) belum dikerjakan.

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
bertentangan. Jalankan `npm run db:check` lebih dulu untuk memastikan koneksinya
hidup; perintah itu menampilkan driver yang dipakai dan versi server, dengan
password disamarkan.

### Catatan koneksi Neon

Neon menyediakan dua jalur, dan keduanya sering diblokir jaringan kantor/CI:

| Jalur             | Port | Dipakai oleh                         |
| ----------------- | ---- | ------------------------------------ |
| Protokol Postgres | 5432 | `psql`, Drizzle Studio, GUI database |
| HTTP serverless   | 443  | driver `neon-http` (aplikasi ini)    |

Driver `neon-http` menghubungi `api.<region>.aws.neon.tech` lewat HTTPS. Bila
jaringan Anda memakai allowlist egress, kedua host itu perlu diizinkan:
`ep-*.<region>.aws.neon.tech` dan `api.<region>.aws.neon.tech`.
`npm run db:check` akan menyebutkan host mana yang diblokir bila itu terjadi.

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
| `npm run admin:user`    | Membuat akun admin, menetapkan peran, menyetel ulang kata sandi |
| `npm run links:check`   | Memeriksa kesehatan seluruh tautan eksternal (memanggil jaringan) |
| `npm run links:report`  | Menampilkan hasil pemeriksaan terakhir tanpa memanggil jaringan  |

### Akun admin pertama

Admin ada di `/admin` dan tidak punya pendaftaran mandiri. Buat akun pertama dari
terminal, lalu masuk lewat peramban:

```bash
npx tsx scripts/admin.ts create "Nama Lengkap" nama@yts.or.id admin
```

Kata sandi acak ditampilkan sekali. Perintah lain: `role` (menetapkan peran pada unit),
`password` (menyetel ulang), `disable`/`enable`, dan `list`.

Jalankan lewat `npx tsx` dan bukan `npm run admin:user --` bila nama mengandung spasi:
sebagian shell membuang tanda kutipnya, sehingga nama bergeser menjadi email. Perintahnya
menolak alamat email yang tidak sah, jadi kekeliruan itu gagal dengan jelas — bukan
membuat akun bernama aneh.

Setelah ada satu admin, penugasan peran berikutnya bisa dilakukan dari `/admin/pengguna`
tanpa akses terminal.

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
│   ├── admin/          # penanda status, antrean kerja
│   ├── landing/        # section landing page, satu file per section
│   ├── search/         # kolom pencarian, baris hasil, feedback FAQ
│   ├── ui/             # primitive lintas halaman (Icon, placeholder, notice)
│   ├── SiteHeader.astro
│   └── SiteFooter.astro
├── config/navigation.ts  # navigasi & task shortcut (struktur produk, bukan konten)
├── layouts/
│   ├── BaseLayout.astro   # situs publik
│   └── AdminLayout.astro  # admin — navigasi & kepadatan berbeda, token sama
├── middleware.ts       # PENJAGA seluruh route /admin (06-CONTENT-MODEL §13)
├── pages/              # route publik sesuai 02-INFORMATION-ARCHITECTURE.md §8
│   ├── admin/          # dirender saat request, dijaga middleware
│   ├── cari.astro      # dirender saat request (prerender = false)
│   └── api/            # saran pencarian, klik hasil, feedback FAQ, better-auth
├── server/             # KODE SERVER — jangan diimpor dari komponen klien
│   ├── admin/
│   │   ├── entities.ts    # peta 6 entity → kolom & field; satu sumber untuk admin
│   │   ├── governance.ts  # SATU-SATUNYA jalan konten berubah dari admin
│   │   ├── dashboard.ts   # antrean kerja
│   │   └── users.ts       # pengelolaan pengguna & peran
│   ├── auth/
│   │   ├── auth.ts     # konfigurasi better-auth (sesi, kata sandi, cookie)
│   │   ├── roles.ts    # ATURAN IZIN & lifecycle — fungsi murni, teruji unit
│   │   └── session.ts  # sesi → Actor; satu-satunya pembaca cookie
│   ├── db/
│   │   ├── schema.ts   # core registry (06-CONTENT-MODEL-AND-CMS.md)
│   │   ├── client.ts   # pemilihan driver Neon vs postgres.js
│   │   ├── migrate.ts
│   │   ├── seed.ts     # loader seed, idempoten
│   │   └── seed-data.ts # DATA PENGEMBANGAN — bukan data resmi YTS
│   ├── content/
│   │   ├── public-queries.ts     # satu-satunya jalan konten publik keluar
│   │   ├── directory-queries.ts  # listing & detail (Fase 3-4)
│   │   ├── search-queries.ts     # pencarian terpadu & peringkatnya
│   │   ├── search-terms.ts       # olah teks query — tanpa database, teruji unit
│   │   └── search-analytics.ts   # log pencarian & feedback FAQ
│   ├── integrations/
│   │   ├── link-status.ts   # PENILAIAN status tautan — tanpa jaringan, teruji unit
│   │   ├── link-monitor.ts  # mengumpulkan URL, menghubungi, menyimpan hasilnya
│   │   └── registry.ts      # read API canonical untuk sistem lain
│   └── env.ts          # validasi environment
├── styles/
│   ├── tokens.css      # design tokens — sumber tunggal warna/tipografi/spacing
│   ├── base.css        # reset ringan, layout primitive, button, input, focus
│   └── admin.css       # kepadatan khusus admin, memakai token yang sama
└── types/content.ts    # kontrak konten dari 06-CONTENT-MODEL-AND-CMS.md
drizzle/                # migrasi SQL — di-commit, jangan diedit tangan kecuali
                        # statement yang drizzle-kit tidak bisa hasilkan
                        # (CREATE EXTENSION, index atas ekspresi); beri komentar
scripts/db.ts           # CLI database
scripts/admin.ts        # CLI akun admin & peran
scripts/links.ts        # CLI pemeriksaan tautan eksternal (dijalankan terjadwal)
tools/                  # script screenshot & audit a11y
```

## Menjadwalkan pemeriksaan tautan

`npm run links:check` dirancang untuk dijalankan berkala, bukan dari build. Ia keluar
dengan kode 1 **hanya bila ada tautan yang baru rusak**, sehingga penjadwal bisa
mengubahnya menjadi pemberitahuan tanpa membaca keluarannya — dan tidak mengirim
pemberitahuan yang sama setiap hari untuk tautan yang sudah diketahui rusak.

Contoh dengan GitHub Actions (harian, 02.00 WIB):

```yaml
on:
  schedule:
    - cron: '0 19 * * *' # 19.00 UTC = 02.00 WIB
jobs:
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: yts-hub-web/package-lock.json }
      - run: npm ci
        working-directory: yts-hub-web
      - run: npm run links:check
        working-directory: yts-hub-web
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
```

Hasilnya selalu bisa dibaca di `/admin/tautan`, dan tautan rusak ikut muncul di dasbor
admin. Selama pemeriksaan belum pernah dijalankan, halaman itu mengatakannya
apa adanya — bukan menampilkan "semua sehat".

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

**Hampir seluruh halaman statis, kecuali pencarian.** Tiga puluh halaman direktori
dan FAQ tetap di-prerender saat build seperti Fase 1–3. Yang berjalan saat request
hanya `/cari` dan endpoint di `src/pages/api/` — ditandai `export const prerender = false`,
dan itulah satu-satunya sumber kebenaran soal route mana yang menjadi function
(`tools/check-links.mjs` membaca penanda itu, bukan daftar terpisah).

Alasannya ada tiga, semuanya dari `07-SEARCH-AND-FAQ.md`: halaman hasil bergantung
pada `?q=` yang baru ada saat pengunjung mengetik; §5 meminta pencarian dijalankan
PostgreSQL, bukan disalin ke indeks JSON di klien; dan §10–§11 (feedback FAQ,
pencatatan query) adalah operasi tulis yang tidak punya tempat di HTML statis.
Konsekuensinya: `DATABASE_URL` kini dibutuhkan saat build **dan** saat runtime.

**Pencarian memakai PostgreSQL Full Text Search dengan konfigurasi `indonesian`.**
Kolom `search_vector` di enam tabel adalah generated column berbobot (A judul,
B kategori/ringkasan, C badan teks); peringkatnya disusun di
`src/server/content/search-queries.ts` mengikuti urutan sinyal `07-SEARCH §4`.
Angka bobotnya dipilih agar sinyal yang lebih tinggi tidak bisa dikalahkan
akumulasi sinyal di bawahnya — kecocokan judul persis selalu menang.

Pencocokan dijalankan dua tahap: semua kata wajib ada dulu, dan hanya bila itu
kosong barulah dilonggarkan menjadi "cukup satu kata". Halaman hasil mengatakannya
kepada pengguna, bukan diam-diam menampilkan hasil yang lebih longgar.

**Kolom internal registry aplikasi tidak ikut di-index.** Kalau `integration_notes`
dan kerabatnya masuk `search_vector`, isinya bisa ditebak dari luar dengan menyusun
query yang cocok. Ada test yang mengisi kolom itu dengan penanda lalu memastikan
penanda tersebut tidak bisa ditemukan lewat pencarian.

**Autocomplete ditulis tanpa React, berbeda dari rencana Fase 2.** Combobox-nya
butuh ±2 KB JavaScript; memuat runtime React untuk itu berarti mengirim ±184 KB ke
setiap halaman yang punya kolom pencarian — termasuk beranda, yang seluruh
halamannya hari ini lebih ringan daripada itu. Tidak ada state di sana yang menuntut
framework. React tetap terpasang untuk admin Fase 5, tempat state-nya nyata.

**Analytics pencarian tidak menyimpan identitas.** `search_queries` berisi teks
query, jumlah hasil, dan hasil mana yang diklik — tidak ada kolom untuk IP, user
agent, atau session id, dan itu bukan kolom yang dikosongkan melainkan kolom yang
tidak pernah dibuat (`07-SEARCH §11`). Laporan bisa menjawab "kata apa yang dicari
dan mana yang tidak menemukan apa pun", tidak bisa menjawab "siapa yang mencarinya".

**Endpoint feedback FAQ belum punya pembatasan laju.** Satu orang bisa menekan
"Ya" berkali-kali. Untuk MVP itu diterima: yang terpengaruh hanya urutan FAQ, bukan
isi jawabannya, dan `faq_feedback` menyimpan tiap kejadian sehingga angka yang
menyimpang bisa ditelusuri lalu direkonsiliasi.

**Otorisasi dilingkupi unit, dan itu sebabnya ia tidak diserahkan ke pustaka auth.**
better-auth mengurus bagian yang paling mudah salah dan paling sempit: hashing kata
sandi, token sesi, dan cookie. Siapa boleh melakukan apa diputuskan
`src/server/auth/roles.ts` — seluruhnya fungsi murni, sehingga aturan yang paling
mahal bila keliru bisa diuji tanpa database (26 test). Izin di sini bergantung pada
unit MANA yang memiliki konten: editor TS Lab School tidak bisa menyentuh milik
Program Sosial, dan itu diperiksa di SQL, bukan setelah baris terbaca.

**Ada dua lapisan penjagaan, bukan satu.** `src/middleware.ts` menjawab "sudah masuk
dan punya peran?" untuk seluruh `/admin`, sehingga halaman admin baru tidak bisa lupa
memeriksanya. `src/server/admin/governance.ts` menjawab "boleh menyentuh konten INI?"
— pertanyaan yang baru bisa dijawab setelah kontennya diketahui.

**Status tidak bisa diubah lewat form penyuntingan.** `status`, `published_at`,
`reviewed_at`, dan `review_due_at` dibuang dari input sebelum apa pun ditulis;
perpindahan status hanya lewat `transition()`. Kalau keduanya digabung, sebuah
`<input name="status">` sudah cukup untuk melewati seluruh pemeriksaan lifecycle.
Ada test yang membuktikan jalur itu tertutup.

**Setiap perubahan status menulis audit dalam transaksi yang sama.** Karena itulah
driver Neon dipindah dari HTTP ke WebSocket pada fase ini — `neon-http` tidak
mendukung transaksi interaktif. Tanpa transaksi hanya ada dua pilihan dan keduanya
merusak governance: mencatat lebih dulu bisa meninggalkan audit atas perubahan yang
gagal, mengubah lebih dulu bisa kehilangan catatannya.

**`needs_review` dihitung, tidak disimpan.** Jatuh tempo tinjauan ditentukan dengan
membandingkan `review_due_at` terhadap waktu sekarang. Kalau statusnya ditulis oleh
proses terjadwal, daftar "jatuh tempo" hanya seakurat proses itu — dan diamnya proses
terlihat persis sama dengan "tidak ada yang jatuh tempo".

**Akun dibuat lewat CLI, bukan halaman web.** Pendaftaran mandiri dimatikan; penjagaan
itu berlaku juga untuk pemanggilan dari server. Kata sandi dihasilkan `npm run admin:user`
dan ditampilkan sekali. Yang belum ada dan disebut terus terang: reset kata sandi lewat
email (belum ada infrastruktur surat), verifikasi email, MFA, dan pembatasan laju pada
percobaan masuk.

**Empat mata belum diwajibkan.** Approver bisa menyetujui konten yang ia kirim sendiri.
Mewajibkan dua orang berbeda membutuhkan minimal dua approver di setiap unit, dan YTS
belum tentu punya. Audit log mencatat kedua peristiwa beserta pelakunya, sehingga
persetujuan-sendiri terlihat jelas saat riwayatnya dibaca.

**Pemantauan tautan berjalan terjadwal, tidak pernah saat halaman dibuka.**
`npm run links:check` mengumpulkan setiap URL publik dari kelima entity yang bisa
memilikinya, menghubunginya satu per satu, lalu menyimpan hasilnya. Halaman
`/admin/tautan` hanya membaca hasil itu. Menghubungi puluhan sistem luar setiap kali
seseorang membuka admin akan mengubah kunjungan biasa menjadi lonjakan trafik di mata
sistem yang diperiksa.

**Rusak butuh tiga kali gagal berturut-turut, kecuali 404.** Server yang sedang
di-deploy, jaringan yang tersendat, dan pembatasan laju semuanya menghasilkan
kegagalan sesaat; menandainya rusak seketika membuat admin dibanjiri peringatan palsu
lalu berhenti mempercayainya. 404 dan 410 dikecualikan karena itu jawaban pasti.
Naik-turun `https`, `www.`, dan garis miring di akhir TIDAK dianggap pengalihan —
kalau dianggap, seluruh registry akan tertandai sekaligus tanpa satu pun yang perlu
ditindaklanjuti.

**Halaman publik berkata jujur soal tautan yang rusak.** CTA layanan dan baris
registry yang tautannya diketahui mati tidak dirender sebagai tombol; sebagai
gantinya halaman menyatakan sistemnya sedang tidak bisa dibuka dan mengarahkan ke
kanal kontak. Mengirim pengunjung ke halaman mati membuatnya mengira dirinya yang
salah, lalu mencoba berulang kali sebelum menyerah.

**Read API registry hanya membaca, dan bentuk jawabannya tetap.**
`/api/registry/<resource>.json` memberi `id` (UUID canonical) dan `code` agar sistem
lain menyimpan referensi, bukan menggandakan definisi unit dan layanan
(08-INTEGRATION §3-§4). Tidak ada parameter yang bisa memperluas kolom yang
dikembalikan, dan field internal registry aplikasi tidak pernah ikut — ada test yang
mengisinya dengan penanda lalu membuktikan penanda itu tidak muncul di jawaban.

Pertahanan utama terhadap penyalahgunaan adalah cache CDN (`s-maxage=300`), bukan
pembatas laju di dalam function: hitungan pembatas itu ada di memori satu instance,
sehingga instance lain punya hitungan sendiri. Itu disebut apa adanya di kodenya. Bila
penyalahgunaan yang disengaja benar-benar terjadi, tempat memperbaikinya adalah
pembatasan laju di tingkat Netlify.

## Yang belum dikerjakan

| Fase | Isi                                             | Status  |
| ---- | ----------------------------------------------- | ------- |
| 0    | Repo, tooling, design tokens, base layout       | Selesai |
| 1    | Landing page + shell, mock data typed           | Selesai |
| 2    | Core registry & database (Neon + Drizzle)       | Selesai |
| 3    | Public directory routes + detail pages          | Selesai |
| 4    | FAQ center & unified search                     | Selesai |
| 5    | Admin & governance (RBAC, lifecycle, audit log) | Selesai |
| 6    | Integrasi & broken-link monitoring              | Selesai |
| 7    | Observability & quality                         | Belum   |

## Deployment (Netlify)

`netlify.toml` ada **di root repositori**, bukan di dalam `yts-hub-web/`: base
`yts-hub-web`, publish `dist`, Node 22. Letak itu bukan selera — `base` dihitung
relatif terhadap posisi berkasnya, jadi saat berkas itu berada di dalam
`yts-hub-web/` jalurnya terbaca ganda menjadi `yts-hub-web/yts-hub-web`.

Yang perlu diisi manual di **Site settings → Environment variables**:

| Variabel              | Nilai                                                  |
| --------------------- | ------------------------------------------------------ |
| `DATABASE_URL`        | Connection string Neon                                 |
| `BETTER_AUTH_SECRET`  | 32+ karakter acak — menandatangani cookie sesi admin    |
| `PUBLIC_SITE_URL`     | Origin sungguhan situs, mis. `https://hub.yts.or.id`   |

`DATABASE_URL` dibaca saat build **dan** saat request, karena `/cari`, `/api/*`, dan
seluruh `/admin` berjalan sebagai function. `BETTER_AUTH_SECRET` dihasilkan sekali:

```bash
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

Menggantinya membuat seluruh sesi admin yang sedang berjalan tidak berlaku.
`PUBLIC_SITE_URL` wajib domain sungguhan di production — cookie sesi terikat
padanya, dan nilai localhost membuat admin tidak bisa dipakai sama sekali.

Jangan pernah menulis connection string atau secret ke `netlify.toml` — file itu
ikut ter-commit.

Halaman selain pencarian tetap statis, jadi **konten baru terbit setelah rebuild**,
bukan seketika setelah editor menekan publish. Pada Fase 5 ini perlu disambungkan:
build hook Netlify yang dipanggil saat konten dipublikasikan.

### `npm run dev` dijalankan dari root repositori

Script `dev` sengaja berisi `cd .. && astro dev --root yts-hub-web`. Emulator
Netlify yang ikut aktif bersama adapter membaca `netlify.toml` dan menghitung
`base` relatif terhadap direktori kerja; kalau `astro dev` dijalankan dari dalam
`yts-hub-web`, jalurnya menjadi `yts-hub-web/yts-hub-web`, direktori itu tidak ada,
dan dev server mati sebelum siap **tanpa pesan apa pun di terminal** — jejaknya
hanya tertinggal di `.astro/dev.log`. Kalau suatu saat dev server berhenti diam-diam,
periksa berkas itu lebih dulu.

## Catatan untuk Fase 3 dan seterusnya

**Transaksi.** Driver Neon HTTP tidak mendukung transaksi interaktif. Fase 5
(approve/publish lifecycle) kemungkinan membutuhkannya — pakai driver WebSocket Neon
untuk jalur itu, jangan berasumsi transaksi jalan hanya karena lolos di Postgres lokal.
Catatan ini juga ada di `src/server/db/client.ts`.

**Test integrasi butuh database terpisah.** `DATABASE_URL_TEST` sengaja bukan
`DATABASE_URL`: isi database test DIHAPUS setiap kali test berjalan. Untuk Neon,
buat _branch_ khusus test dan pakai connection string branch itu — jangan pernah
mengarahkannya ke database utama. Bila kosong, test integrasi di-skip dan test
lain tetap jalan.

**Search (Fase 4).** Skema sudah menyiapkan `faqs.keywords` (array) untuk sinyal
ranking alias di 07-SEARCH §4. Kolom `tsvector` dan index GIN ditambahkan pada Fase 4
saat query search-nya benar-benar ditulis, bukan sekarang.

Hal yang masih perlu diputuskan:

- domain resmi (`site` di `astro.config.mjs` masih `hub.example.org`);
- canonical URL untuk tiap layanan/aplikasi (seed masih `null` — sengaja tidak ditebak);
- solusi autentikasi untuk Fase 5 (`10-DEVELOPMENT-PLAN.md` §1 belum menetapkan).

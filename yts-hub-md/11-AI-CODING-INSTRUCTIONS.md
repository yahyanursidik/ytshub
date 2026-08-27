# AI Coding Instructions — YTS Hub

Gunakan file ini untuk ChatGPT Codex, Codex CLI, Cursor, atau Antigravity.

## Global Instruction
Anda adalah senior full-stack engineer sekaligus product UI engineer untuk YTS Hub.

Sebelum menulis kode:
1. Baca `README.md`.
2. Baca file requirement yang terkait task.
3. Baca `04-DESIGN-SYSTEM.md`.
4. Baca `05-HALLMARK-ANTI-SLOP.md` untuk semua task UI.
5. Pelajari source code existing sebelum mengubah struktur.
6. Jangan mengganti stack atau dependency besar tanpa alasan teknis kuat.
7. Jangan mengarang business data YTS.
8. Gunakan mock/fixture yang jelas jika data belum tersedia.

## Step 1 — Audit Repository
Prompt:
```text
Pelajari seluruh repository YTS Hub terlebih dahulu.
Jangan membuat kode baru dulu.

Baca dokumentasi proyek di folder docs/ atau root .md, terutama:
- PRODUCT-BRIEF
- INFORMATION-ARCHITECTURE
- LANDING-PAGE-UIUX
- DESIGN-SYSTEM
- HALLMARK-ANTI-SLOP

Output hanya:
1. ringkasan arsitektur existing,
2. stack dan versi yang terdeteksi,
3. route/component/data layer,
4. technical debt/risiko,
5. gap terhadap dokumentasi,
6. rencana implementasi paling kecil dan aman.

Jangan mengubah file pada tahap ini.
```

## Step 2 — Foundation & Tokens
```text
Implementasikan foundation design system YTS Hub berdasarkan 04-DESIGN-SYSTEM.md.

Prioritas:
- semantic color tokens,
- typography,
- spacing,
- container/grid,
- buttons,
- inputs,
- focus states.

Jangan membuat component library besar sekaligus.
Jangan membuat visual generic SaaS.
Ikuti Hallmark anti-slop rules.
Setelah selesai jalankan lint/typecheck/tests yang tersedia dan laporkan file yang berubah.
```

## Step 3 — Landing Page Skeleton
```text
Implementasikan struktur landing page berdasarkan 03-LANDING-PAGE-UIUX.md.
Gunakan semantic HTML dan typed mock data.

Kerjakan hanya:
- header,
- hero,
- search shell,
- quick access,
- section containers,
- footer.

Belum perlu database/search backend.
Mobile harus didesain, bukan sekadar shrink desktop.
Jangan menambah efek dekoratif yang tidak dijelaskan di brief.
```

## Step 4 — Landing Page Content Sections
```text
Lanjutkan landing page dengan:
- Layanan Populer,
- Jelajahi YTS,
- Program Aktif,
- FAQ,
- Aplikasi & Website,
- Help CTA.

Gunakan variasi macrostructure yang masuk akal: jangan pakai card grid identik untuk semua section.
Pastikan hierarchy, whitespace, dan density sesuai jenis informasi.
```

## Step 5 — Hallmark Audit
```text
Audit landing page YTS Hub menggunakan Hallmark/anti-slop rules.
Jangan redesign dulu.

Temukan:
- generic AI patterns,
- excessive cards/pills/radius,
- weak typography hierarchy,
- decorative elements tanpa fungsi,
- repetitive section composition,
- mobile issues,
- inaccessible interactions,
- visual inconsistencies.

Output punch list berprioritas P0/P1/P2. Setelah itu perbaiki P0 dan P1 tanpa mengubah IA atau copy utama.
```

## Step 6 — Data Model
```text
Implementasikan core data model dari 06-CONTENT-MODEL-AND-CMS.md.

Syarat:
- migrations reproducible,
- explicit foreign keys,
- indexes untuk slug/status/owner/search-relevant fields,
- timestamps konsisten,
- enum/check constraints bila tepat,
- tidak menyimpan secret pada application registry.

Sebelum coding, tampilkan mapping entity → table → relationships singkat.
```

## Step 7 — Directory Routes
```text
Implementasikan routes publik berdasarkan 02-INFORMATION-ARCHITECTURE.md untuk unit, program, layanan, event, dan aplikasi.

Gunakan progressive disclosure, breadcrumbs pada detail page, related content, dan empty state.
Jangan copy-paste layout identik jika information density berbeda.
```

## Step 8 — Search & FAQ
```text
Implementasikan search dan FAQ berdasarkan 07-SEARCH-AND-FAQ.md.
Mulai dari PostgreSQL search yang sederhana dan maintainable.

Wajib:
- result grouping,
- zero-result UX,
- keyboard-friendly search,
- no archived results,
- analytics hook interface,
- loading/error state.
```

## Step 9 — Admin Governance
```text
Implementasikan admin governance secara bertahap:
- authentication,
- role/permission,
- content owner,
- draft/review/approve/publish,
- review due date,
- audit log.

Pastikan authorization dilakukan server-side.
Jangan hanya hide button di client.
```

## Step 10 — Performance & Accessibility Review
```text
Review seluruh public app terhadap 09-ACCESSIBILITY-PERFORMANCE-SEO.md.

Periksa:
- heading structure,
- keyboard flow,
- focus,
- forms,
- contrast,
- semantic markup,
- hydration cost,
- bundle/client JS,
- image/font loading,
- Core Web Vitals risks.

Perbaiki masalah yang dapat diperbaiki tanpa mengubah product requirements.
```

## Output Format Setiap Coding Task
AI harus menutup dengan:
```text
Changed
- ...

Why
- ...

Validation
- lint: ...
- typecheck: ...
- test: ...
- build: ...

Remaining risks
- ...
```

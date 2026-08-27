# YTS Hub — Documentation Index

## Project
**YTS Hub** adalah pusat informasi, katalog layanan, program, event, FAQ, dan direktori sistem digital Yayasan Tarbiyah Sunnah (YTS).

Visi produk:
> One Organization → One Registry → One Knowledge Source → Many Services.

YTS Hub berfungsi sebagai **digital front door** dan **single source of truth** untuk informasi resmi YTS. Sistem ini tidak menggantikan aplikasi unit yang sudah ada, tetapi menghubungkan dan menjelaskan bagaimana pengguna menemukan serta menggunakan layanan tersebut.

## Dokumen
1. `01-PRODUCT-BRIEF.md` — konteks, tujuan, pengguna, scope, prinsip produk.
2. `02-INFORMATION-ARCHITECTURE.md` — IA, sitemap, navigasi, hierarchy.
3. `03-LANDING-PAGE-UIUX.md` — spesifikasi lengkap landing page desktop/mobile.
4. `04-DESIGN-SYSTEM.md` — tokens, typography, spacing, components, interaction.
5. `05-HALLMARK-ANTI-SLOP.md` — aturan implementasi Hallmark & anti-AI-slop.
6. `06-CONTENT-MODEL-AND-CMS.md` — struktur data konten, metadata, workflow.
7. `07-SEARCH-AND-FAQ.md` — unified search, FAQ center, zero-result, analytics.
8. `08-INTEGRATION-AND-ROUTING.md` — hubungan dengan aplikasi/website YTS.
9. `09-ACCESSIBILITY-PERFORMANCE-SEO.md` — WCAG, Core Web Vitals, SEO.
10. `10-DEVELOPMENT-PLAN.md` — tahapan implementasi teknis.
11. `11-AI-CODING-INSTRUCTIONS.md` — instruksi bertahap untuk Codex/ChatGPT/Antigravity.
12. `12-ACCEPTANCE-CHECKLIST.md` — checklist QA desain, UX, konten, teknis.

## Prinsip inti
- Search-first, task-first, bukan organization-chart-first.
- Informasi resmi harus punya owner, status, dan review date.
- UI tenang, fresh, editorial-modern, tidak generik seperti template SaaS AI.
- Hindari dekorasi islami klise yang tidak berfungsi.
- Progressive disclosure: tampilkan yang paling dibutuhkan terlebih dahulu.
- Aplikasi eksternal dibuka dengan konteks jelas; jangan membuat pengguna menebak.
- Mobile harus menjadi pengalaman utama, bukan hasil mengecilkan desktop.

## Scope MVP
- Landing page publik.
- Unit directory.
- Program directory.
- Service catalog.
- Event directory.
- FAQ center.
- Application & website directory.
- Unified search.
- Contact/help entry points.
- Content ownership, review, publish, archive.

## Referensi Hallmark
Project menggunakan prinsip **Nutlope/Hallmark** sebagai design-quality gate. Hallmark adalah skill anti-AI-slop untuk AI coding assistants; pola kerjanya mencakup build, audit, redesign, dan study. Instalasi dapat dilakukan dengan:

```bash
npx skills add nutlope/hallmark
```

Pastikan `DESIGN.md` proyek dibaca sebelum AI membuat atau mengubah UI.

---

## Catatan istilah — Agustus 2026

**PPDB tidak lagi dipakai; istilah resminya SPMB.** Perubahan ini datang dari
pengurus YTS, dan seluruh dokumen di folder ini beserta implementasinya sudah
disesuaikan.

Yang ikut berubah di kode: slug layanan `ppdb-online` menjadi `spmb`, judul
"PPDB Online" menjadi "SPMB", dan event "Sosialisasi PPDB" menjadi
"Sosialisasi SPMB". Kode entity `SERVICE-SPMB-TSLS` sudah memakai SPMB sejak
awal sehingga tidak berubah.

Bila menemukan "PPDB" di tempat lain — pada konten yang dimasukkan lewat admin,
misalnya — itu perlu diperbaiki, bukan dibiarkan sebagai variasi penulisan.

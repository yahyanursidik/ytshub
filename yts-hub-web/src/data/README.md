# Development fixtures — BUKAN DATA RESMI YTS

Seluruh isi folder ini adalah **data contoh untuk pengembangan**.

Aturan dari `05-HALLMARK-ANTI-SLOP.md` §7 — dilarang mengarang:
jumlah jamaah, statistik yayasan, status legal, nama program yang tidak ada,
biaya, alamat, nomor WhatsApp, rating/testimonial, dan tanggal event.

Karena itu fixture di sini:

- hanya memakai nama entitas yang sudah disebut dalam dokumen requirement
  (TS Lab School, TSL Learning, Kajian Sunnah, PPDB Online, Donasi Online, dst.);
- **tidak** memuat angka statistik, biaya, tanggal, alamat, atau nomor kontak;
- memakai `PLACEHOLDER` eksplisit untuk field yang menunggu data resmi;
- setiap URL eksternal memakai `#` sampai canonical URL resmi diberikan
  (lihat `08-INTEGRATION-AND-ROUTING.md` §3).

Saat Fase 2, seluruh file di folder ini diganti oleh query database dan folder ini
dihapus. Tipe di `src/types/content.ts` sengaja dipakai bersama supaya penggantian
itu tidak mengubah component.

Banner "data contoh" ditampilkan otomatis di mode `dev` melalui
`src/components/ui/DevDataNotice.astro`.

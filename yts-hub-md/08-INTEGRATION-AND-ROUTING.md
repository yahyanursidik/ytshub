# Integration & Routing — YTS Hub

## 1. Principle
YTS Hub tidak mengambil alih transaksi aplikasi yang sudah ada.

Pola:
```text
Discover in YTS Hub
→ Understand context
→ Open owning system
→ Complete transaction there
```

## 2. Integration Levels
### Level 1 — Curated Link
Hub menyimpan canonical URL dan metadata.

### Level 2 — Read API
Hub membaca data publik seperti program/event aktif.

### Level 3 — Shared Registry/API
Sistem lain memakai canonical `unit_id`, `program_id`, atau `service_id`.

### Level 4 — Event/Webhook
Digunakan nanti jika status perlu sinkronisasi dekat real-time.

## 3. Master Registry
YTS Hub/Core Registry menjadi sumber canonical untuk:
- Unit
- Division
- Program
- Service
- Website
- Application

Sistem transaksional tidak perlu menggandakan definisi jika bisa memakai foreign reference/canonical ID.

## 4. ID Strategy
Gunakan UUID sebagai primary key dan human-readable code sebagai reference.

Contoh:
```text
id: UUID
code: SERVICE-SPMB-TSLS
slug: ppdb-online
```

## 5. External Link UX
Sebelum redirect, card harus menjelaskan:
- nama sistem;
- fungsi;
- tujuan link.

Gunakan indicator external link bila pindah domain.

## 6. Broken Link Monitoring
Health check berkala untuk URL publik.
Status:
```text
healthy
redirected
warning
broken
```

Alert ke admin jika broken.

## 7. Security
- Jangan expose endpoint internal lewat public registry.
- Jangan simpan secrets.
- API keys di environment secret manager.
- Server-side validation untuk webhook/API.
- Rate limiting pada public API/search bila diperlukan.

## 8. Recommended Initial Architecture
```text
Public Web
   ↓
YTS Hub Server/API
   ↓
Neon PostgreSQL
   ↘
    Search index (Postgres MVP)

External systems
← curated link / read API →
YTS Hub Integration Layer
```

Gunakan modular monolith pada fase awal.

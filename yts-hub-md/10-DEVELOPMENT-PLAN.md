# Development Plan — YTS Hub

## 1. Recommended Baseline Stack
Proposed:
- Astro 7.x untuk public web
- React islands untuk interactive modules
- React + Refine Core untuk admin bila diperlukan
- Neon PostgreSQL
- Drizzle ORM (preferred) atau Prisma bila tim sudah standardisasi Prisma
- Authentication: pilih satu solusi yang mendukung RBAC dengan baik
- Netlify deployment

Versi package harus dikunci saat implementasi setelah verifikasi release terbaru.

## 2. Architecture Principle
Mulai sebagai modular monolith.

Modules:
```text
core-registry
knowledge
services
programs
events
applications
search
governance
analytics
integrations
auth
```

## 3. Phase 0 — Repository & Foundations
- project setup
- lint/typecheck/test
- environment validation
- design tokens
- Hallmark skill/install
- base layout
- route conventions

Exit criteria:
- local + preview deploy working
- no placeholder architecture hacks

## 4. Phase 1 — Landing Page Static Shell
Implement:
- header
- hero
- search shell
- task shortcuts
- sections
- footer
- responsive design

Gunakan typed mock data sementara.

Exit criteria:
- desktop/mobile match design intent
- accessibility baseline
- Hallmark audit passed/addressed

## 5. Phase 2 — Core Registry & Database
Tables/entities:
- units
- programs
- services
- events
- applications
- websites
- contacts
- tags/audiences

Add seed development data clearly marked as non-production.

## 6. Phase 3 — Public Directory Routes
- `/unit`
- `/program`
- `/layanan`
- `/event`
- `/aplikasi`

Add detail routes, breadcrumbs, related content.

## 7. Phase 4 — FAQ & Search
- FAQs
- categories
- unified search
- autocomplete
- zero-result UX
- query analytics

## 8. Phase 5 — Admin & Governance
- login
- RBAC
- draft/review/approve/publish
- ownership
- review due date
- audit log

## 9. Phase 6 — Integrations
- canonical links
- broken link checks
- selected read APIs
- external system registry

## 10. Phase 7 — Observability & Quality
- error tracking
- analytics
- performance monitoring
- content health
- backup/restore validation

## 11. Testing
### Unit
- domain rules
- search ranking helpers
- validators

### Integration
- DB access
- auth/RBAC
- lifecycle transitions

### E2E
- search → result → service
- navigation
- FAQ
- admin publish flow

### Visual
- screenshot regression for landing page key breakpoints

## 12. Definition of Done
Feature selesai bila:
- functional requirement terpenuhi;
- responsive;
- keyboard accessible;
- loading/error/empty state tersedia;
- typecheck/lint/test pass;
- no fake data exposed as real;
- Hallmark/anti-slop audit dilakukan untuk UI significant.

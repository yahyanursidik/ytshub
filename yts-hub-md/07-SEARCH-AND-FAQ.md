# Unified Search & FAQ — YTS Hub

## 1. Search Goal
Search harus membantu pengguna menemukan **jawaban atau tindakan**, bukan sekadar mencocokkan string.

## 2. Searchable Entities
- FAQ
- Service
- Program
- Unit
- Event
- Application/Website

## 3. Result Grouping
Contoh:
```text
Paling relevan
- Service: PPDB Online

FAQ
- Bagaimana cara mendaftar Preschool?

Program
- TS Lab School Preschool

Website
- Portal SPMB
```

## 4. Ranking Signals
Urutan awal:
1. Exact title/question match
2. Keyword/alias match
3. Summary/body match
4. Popularity/helpfulness
5. Active/current content boost
6. Unit/context relevance

Archived/expired content harus turun atau dikeluarkan dari public result.

## 5. MVP Search
Mulai dengan PostgreSQL Full Text Search + trigram/fuzzy support bila perlu.
Jangan menambah search service eksternal sebelum kebutuhan dan volume membenarkannya.

## 6. Search Suggestions
Autocomplete dapat menyarankan:
- query populer;
- service;
- FAQ;
- unit.

Batasi 6–8 suggestion.

## 7. Zero Result UX
Jangan tampilkan kosong.

Tampilkan:
> Kami belum menemukan informasi yang sesuai.

Lalu:
- koreksi kata kunci;
- suggested categories;
- FAQ populer;
- `Hubungi Kami`.

Catat query zero-result untuk content gap analytics.

## 8. FAQ Center
FAQ adalah knowledge entity, bukan hardcoded accordion di landing page.

FAQ listing:
- search
- category filter
- unit filter opsional
- compact question list

## 9. FAQ Detail
Tampilkan:
- pertanyaan
- jawaban
- updated/reviewed date bila relevan
- related service/program
- helpfulness feedback

## 10. Feedback
Prompt sederhana:
> Apakah informasi ini membantu?

Options:
- Ya
- Belum

Jika `Belum`, alasan opsional:
- kurang jelas
- kurang lengkap
- sudah tidak berlaku
- bukan jawaban yang dicari

## 11. Search Analytics
Track tanpa menyimpan data sensitif yang tidak dibutuhkan:
- query count
- top query
- zero-result query
- click-through result
- search-to-service conversion
- FAQ helpfulness

## 12. Future AI/RAG
AI tidak masuk MVP.
Jika diaktifkan kelak:
- hanya approved/public knowledge;
- selalu cite sumber internal;
- confidence threshold;
- abstain bila evidence tidak cukup;
- jangan menjawab dari model memory untuk data YTS spesifik.

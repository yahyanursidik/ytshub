# Accessibility, Performance & SEO — YTS Hub

## 1. Accessibility Target
Target minimal WCAG 2.2 AA untuk area publik.

## 2. Required Accessibility
- Semantic HTML
- Logical heading order
- Keyboard navigation
- Visible `:focus-visible`
- Skip-to-content link
- Minimum target 44×44px untuk control utama di mobile
- Text contrast AA
- Icon-only buttons memiliki accessible name
- Form errors dibaca screen reader
- Search memiliki `<label>` yang benar walau visual label tersembunyi
- Accordion memakai button + aria-expanded
- Respect `prefers-reduced-motion`

## 3. Color
Jangan mengandalkan warna sebagai satu-satunya status indicator.
Status harus punya teks/icon bila diperlukan.

## 4. Performance Goals
Landing page harus cepat di koneksi seluler Indonesia.

Target engineering:
- LCP ≤ 2.5s p75
- INP ≤ 200ms p75
- CLS ≤ 0.1 p75

## 5. Performance Strategy
- HTML-first untuk konten publik.
- Gunakan island hydration hanya untuk bagian interaktif.
- Search suggestions hydrate on demand bila memungkinkan.
- Hindari library animation besar.
- SVG/icon sprite atau icon components tree-shakeable.
- Optimize fonts dan preload hanya yang kritikal.
- Image dimensions wajib eksplisit.
- Jangan load hero bitmap besar bila CSS/SVG cukup.

## 6. SEO
Setiap entity public punya:
- unique title
- meta description
- canonical URL
- Open Graph basic metadata
- structured data bila sesuai

Potential schema.org:
- Organization
- Event
- FAQPage (gunakan hanya bila sesuai guideline search engine saat implementasi)
- WebSite + SearchAction jika relevan

## 7. Search Engine Indexing
Index:
- unit
- program aktif
- service
- event publik
- FAQ publik

Noindex:
- admin
- internal knowledge
- preview/draft
- duplicated filtered states bila menyebabkan crawl noise

## 8. Analytics Privacy
Collect only what is useful:
- route views
- search terms
- result click
- service outbound click
- FAQ feedback

Jangan merekam sensitive form contents ke analytics.

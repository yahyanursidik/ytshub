<!-- Salinan kerja dari yts-hub-md/04-DESIGN-SYSTEM.md.
     Wajib dibaca AI coding assistant sebelum membuat/mengubah UI
     (README yts-hub-md + 05-HALLMARK-ANTI-SLOP.md §1). -->

# Design System — YTS Hub

Locked direction untuk YTS Hub. Perubahan visual harus disengaja dan tidak dilakukan sekadar untuk membuat halaman “lebih ramai”.

## 1. Character
- Fresh
- Calm
- Trustworthy
- Institutional without looking bureaucratic
- Editorial-modern
- Warm but restrained

## 2. Visual Genre
`editorial-modern / service-directory / calm institutional`

## 3. Color Direction
Gunakan semantic tokens, bukan warna hardcoded per component.

```css
--paper: #F7F5EF;
--surface: #FFFEFA;
--surface-muted: #F0EEE6;
--ink: #1F2721;
--ink-muted: #687068;
--line: #DDDCD4;
--brand: #405A43;
--brand-strong: #304733;
--brand-soft: #E5EDE4;
--accent-warm: #B58C45;
--danger: #A4483E;
--success: #4E7655;
```

Catatan: konversi ke OKLCH saat implementasi final bila stack CSS mendukungnya.

### Rules
- Satu anchor color utama: green/olive.
- Accent warm hanya untuk penanda kecil.
- Jangan membuat setiap kategori punya full-surface color sendiri.
- Accent kuat <10% total viewport.

## 4. Typography
Direkomendasikan:
- Display/headline: serif editorial yang mudah dibaca.
- UI/body: sans-serif netral dan matang.

Contoh pairing implementable:
- `Source Serif 4` + `Inter`
- `Newsreader` + `Inter`

Gunakan font open-source/web-safe sesuai lisensi proyek.

### Scale
```text
Display XL  56–68 / 1.0–1.08
H1          44–56 / 1.08
H2          30–38 / 1.15
H3          22–28 / 1.2
Body L      18 / 1.55
Body        16 / 1.55
Small       14 / 1.45
Meta        12–13 / 1.4
```

Mobile gunakan clamp(), bukan breakpoint font size yang terlalu banyak.

## 5. Spacing
Gunakan 4px base scale:
```text
4, 8, 12, 16, 24, 32, 48, 64, 80, 96
```

Section spacing desktop umumnya 72–96px.
Mobile 48–64px.

## 6. Radius
- Input/button: 10–12px
- Card compact: 12–14px
- Section container: 16–20px bila perlu
- Hindari radius 28–40px di semua elemen.

## 7. Borders & Shadow
Default card sebaiknya bergantung pada border halus, bukan shadow besar.

```text
Border: 1px solid var(--line)
Shadow: hanya untuk elevation nyata (header popover, modal, search suggestions)
```

## 8. Buttons
Primary:
- dark brand surface
- white text
- min height 44px

Secondary:
- transparent/surface
- subtle border

Text action:
- no pseudo-button pill jika hanya link sederhana

## 9. Icons
- satu icon set konsisten;
- stroke/visual weight seragam;
- gunakan icon hanya bila menambah comprehension;
- ukuran default 18–22px.

Jangan membuat icon 3D, glossy, emoji-like, atau ilustrasi AI.

## 10. Cards
Card harus punya fungsi, bukan sekadar container visual.

Tipe:
- service card
- unit row/card
- program card
- FAQ row
- external app card

Hindari card-inside-card-inside-card.

## 11. Motion
- 150–240ms untuk microinteraction
- easing natural
- translate maksimal 1–2px pada hover
- respect `prefers-reduced-motion`
- hindari parallax dan scroll reveal massal.

## 12. Texture
Hero boleh menggunakan abstraksi garis lembut yang:
- tidak memiliki makna religius palsu;
- opacity sangat rendah;
- tidak mengganggu contrast;
- tidak dibuat sebagai image besar bila CSS/SVG sederhana cukup.

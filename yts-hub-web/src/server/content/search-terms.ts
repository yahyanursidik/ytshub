/**
 * Pengolahan teks query — bagian search yang tidak menyentuh database.
 *
 * Dipisah dari search-queries.ts supaya aturan yang paling mudah salah
 * (tokenisasi, escaping, panjang maksimum) bisa diuji tanpa PostgreSQL.
 *
 * Seluruh input di sini berasal dari pengunjung. Aturannya satu: yang dikirim ke
 * PostgreSQL sebagai `tsquery` HANYA huruf dan angka hasil filter di bawah, tidak
 * pernah karakter mentah. `to_tsquery` punya sintaks sendiri (`&`, `|`, `!`, `:*`,
 * tanda kurung) dan akan melempar error pada input yang tidak valid — pengunjung
 * yang mengetik "a & (b" tidak boleh membuat halaman search gagal.
 */

/** Batas panjang query yang diproses. Di atas ini dipotong, bukan ditolak. */
const MAX_QUERY_LENGTH = 120;

/** Batas jumlah token. Query 40 kata bukan pencarian, itu beban percuma. */
const MAX_TOKENS = 8;

/**
 * Bentuk baku untuk perbandingan dan agregasi analytics:
 * huruf kecil, spasi rapat, tanpa spasi di ujung.
 */
export function normalizeQuery(raw: string): string {
  return raw.slice(0, MAX_QUERY_LENGTH).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Memecah query menjadi token yang aman dipakai di `tsquery`.
 *
 * Tanda hubung dipertahankan sebagai pemisah kata ("ts-lab" → "ts", "lab")
 * karena slug dan nama unit YTS memakainya, dan pengguna mengetiknya dua-duanya.
 */
export function tokenize(raw: string): string[] {
  return normalizeQuery(raw)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
    .slice(0, MAX_TOKENS);
}

export interface TsQueryPair {
  /** Semua token wajib ada. Presisi tinggi, bisa nol hasil. */
  all: string;
  /** Cukup satu token. Dipakai sebagai percobaan kedua bila `all` kosong. */
  any: string;
}

/**
 * Menyusun dua bentuk `tsquery` dari satu query pengguna.
 *
 * Token terakhir diberi akhiran `:*` supaya kata yang belum selesai diketik tetap
 * cocok — "donas" menemukan "Donasi". Hanya token terakhir: memberi `:*` pada
 * semua token membuat "kaji" cocok dengan "kajian", "kajian rutin", dan apa pun
 * yang berawalan sama, sehingga peringkatnya jadi tidak berarti.
 *
 * Mengembalikan string kosong bila tidak ada token yang tersisa; pemanggil harus
 * memperlakukan itu sebagai "tidak ada yang dicari", bukan mengirimnya ke database.
 */
export function buildTsQuery(raw: string): TsQueryPair {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return { all: '', any: '' };

  const withPrefix = tokens.map((token, index) =>
    index === tokens.length - 1 ? `${token}:*` : token,
  );

  return { all: withPrefix.join(' & '), any: withPrefix.join(' | ') };
}

/**
 * Memotong teks di sekitar kata yang dicari, untuk cuplikan hasil.
 *
 * Highlight-nya sendiri dikerjakan di komponen — fungsi ini hanya memilih bagian
 * mana dari teks panjang yang layak ditampilkan, supaya cuplikan tidak selalu
 * dimulai dari kalimat pertama yang belum tentu mengandung jawabannya.
 */
export function excerpt(text: string, raw: string, length = 180): string {
  if (text.length <= length) return text;

  const tokens = tokenize(raw);
  const lower = text.toLowerCase();
  const firstHit = tokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstHit === undefined || firstHit < length * 0.6) {
    return `${text.slice(0, length).trimEnd()}…`;
  }

  // Mundur ke batas kata terdekat supaya cuplikan tidak memotong kata di tengah.
  const start = text.lastIndexOf(' ', Math.max(0, firstHit - Math.floor(length * 0.3))) + 1;
  return `…${text.slice(start, start + length).trimEnd()}…`;
}

/**
 * Memecah teks menjadi potongan cocok/tidak cocok untuk ditandai di UI.
 *
 * Dikembalikan sebagai data, bukan HTML: komponen yang merendernya memakai
 * elemen `<mark>` biasa, jadi tidak ada string HTML yang perlu dipercaya.
 */
export function highlightParts(text: string, raw: string): { text: string; match: boolean }[] {
  const tokens = [...new Set(tokenize(raw))].filter((token) => token.length >= 2);
  if (tokens.length === 0) return [{ text, match: false }];

  const lower = text.toLowerCase();
  const ranges: { start: number; end: number }[] = [];

  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const index = lower.indexOf(token, from);
      if (index < 0) break;
      ranges.push({ start: index, end: index + token.length });
      from = index + token.length;
    }
  }

  if (ranges.length === 0) return [{ text, match: false }];

  ranges.sort((a, b) => a.start - b.start);

  // Gabungkan rentang yang bertumpuk — dua token bisa menandai huruf yang sama
  // ("kajian" dan "kaji"), dan potongan tidak boleh saling menimpa.
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), match: false });
    parts.push({ text: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });

  return parts;
}

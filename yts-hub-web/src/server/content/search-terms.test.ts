/**
 * Test pengolahan teks query — bagian search yang tidak butuh database.
 *
 * Yang diuji di sini adalah hal-hal yang kalau salah tidak kelihatan sebagai bug
 * melainkan sebagai "search-nya kurang pintar": escaping yang bocor, token yang
 * hilang, dan potongan highlight yang saling menimpa.
 */
import { describe, expect, it } from 'vitest';

import { buildTsQuery, excerpt, highlightParts, normalizeQuery, tokenize } from './search-terms';

describe('normalizeQuery', () => {
  it('merapikan huruf besar, spasi ganda, dan spasi di ujung', () => {
    expect(normalizeQuery('  Cara   MENDAFTAR Sekolah  ')).toBe('cara mendaftar sekolah');
  });

  it('memotong query yang sangat panjang, bukan menolaknya', () => {
    expect(normalizeQuery('a'.repeat(500))).toHaveLength(120);
  });
});

describe('tokenize', () => {
  it('memecah pada karakter selain huruf dan angka', () => {
    expect(tokenize('ts-lab school (preschool)')).toEqual(['ts', 'lab', 'school', 'preschool']);
  });

  it('membatasi jumlah token', () => {
    expect(tokenize('a b c d e f g h i j k l')).toHaveLength(8);
  });

  it('mengembalikan daftar kosong untuk input tanpa huruf atau angka', () => {
    expect(tokenize('!!! ??? ###')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('buildTsQuery', () => {
  it('hanya token terakhir yang mendapat awalan, supaya peringkat tetap berarti', () => {
    expect(buildTsQuery('kajian rutin')).toEqual({
      all: 'kajian & rutin:*',
      any: 'kajian | rutin:*',
    });
  });

  it('mengembalikan string kosong bila tidak ada yang bisa dicari', () => {
    expect(buildTsQuery('   ')).toEqual({ all: '', any: '' });
  });

  /**
   * Ini alasan utama file search-terms.ts ada. `to_tsquery` punya sintaksnya
   * sendiri dan MELEMPAR ERROR pada input yang tidak valid — pengunjung yang
   * mengetik tanda kurung atau operator tidak boleh bisa membuat halaman
   * pencarian gagal, apalagi menyelipkan operator ke dalam query.
   */
  it('membuang seluruh karakter yang punya arti khusus di tsquery', () => {
    for (const jahat of ["a & (b | !c):*", "'; drop table faqs; --", 'a<->b', '((((']) {
      const { all, any } = buildTsQuery(jahat);
      for (const hasil of [all, any]) {
        // Yang tersisa hanya huruf/angka, pemisah ` & `/` | `, dan akhiran `:*`.
        expect(hasil).toMatch(/^([a-z0-9]+(:\*)?)?([ ][&|][ ][a-z0-9]+(:\*)?)*$/);
      }
    }
  });
});

describe('excerpt', () => {
  const teks =
    'Pendaftaran dilakukan melalui layanan PPDB Online milik unit pendidikan terkait. ' +
    'Buka halaman layanan PPDB untuk melihat persyaratan, alur, dan tautan resmi ke sistem. ' +
    'Detail persyaratan mengikuti pengumuman resmi unit yang bersangkutan sepenuhnya.';

  it('mengembalikan teks apa adanya bila sudah cukup pendek', () => {
    expect(excerpt('Jawaban singkat.', 'apa saja')).toBe('Jawaban singkat.');
  });

  it('bergeser ke bagian yang memuat kata yang dicari', () => {
    const hasil = excerpt(teks, 'pengumuman');
    expect(hasil).toContain('pengumuman');
    expect(hasil.startsWith('…')).toBe(true);
  });

  it('tetap mulai dari awal bila kata yang dicari memang ada di depan', () => {
    expect(excerpt(teks, 'pendaftaran').startsWith('Pendaftaran')).toBe(true);
  });
});

describe('highlightParts', () => {
  const gabung = (parts: { text: string }[]) => parts.map((part) => part.text).join('');

  it('tidak pernah kehilangan atau menggandakan satu huruf pun', () => {
    const teks = 'Bagaimana cara mendaftar sekolah YTS?';
    for (const query of ['sekolah', 'cara sekolah', 'yts', 'tidak ada']) {
      expect(gabung(highlightParts(teks, query))).toBe(teks);
    }
  });

  it('menandai potongan yang cocok tanpa memandang huruf besar-kecil', () => {
    const parts = highlightParts('Donasi Online', 'donasi');
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(['Donasi']);
  });

  /** Dua token yang bertumpuk ("kaji" dan "kajian") tidak boleh saling menimpa. */
  it('menggabungkan rentang yang bertumpuk', () => {
    const teks = 'Kajian rutin';
    const parts = highlightParts(teks, 'kaji kajian');
    expect(gabung(parts)).toBe(teks);
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(['Kajian']);
  });

  it('mengabaikan token satu huruf agar tidak menandai hampir seluruh kalimat', () => {
    const parts = highlightParts('Data Anda aman', 'a');
    expect(parts).toEqual([{ text: 'Data Anda aman', match: false }]);
  });
});

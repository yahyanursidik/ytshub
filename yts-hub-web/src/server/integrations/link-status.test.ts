/**
 * Test klasifikasi status tautan.
 *
 * Dua kegagalan yang dijaga di sini, dan keduanya merusak kepercayaan pada
 * sistem pemantauan:
 * 1. peringatan palsu — normalisasi URL biasa dilaporkan sebagai pengalihan,
 *    atau gangguan sesaat langsung dinyatakan rusak;
 * 2. tautan mati yang lolos — 404 dianggap perlu menunggu konfirmasi.
 */
import { describe, expect, it } from 'vitest';

import { classify, FAILURES_BEFORE_BROKEN, isMeaningfulRedirect } from './link-status';

const probe = (
  httpStatus: number | null,
  finalUrl: string | null = null,
  error: string | null = null,
) => ({ httpStatus, finalUrl, error });

describe('isMeaningfulRedirect', () => {
  it('mengabaikan normalisasi yang dilakukan hampir setiap server', () => {
    const cases: [string, string][] = [
      ['https://a.example/x', 'https://a.example/x/'],
      ['http://a.example/x', 'https://a.example/x'],
      ['https://www.a.example/x', 'https://a.example/x'],
      ['https://a.example/x', 'https://www.a.example/x/'],
    ];
    for (const [from, to] of cases) expect(isMeaningfulRedirect(from, to)).toBe(false);
  });

  it('menandai perpindahan yang sungguhan', () => {
    expect(isMeaningfulRedirect('https://a.example/x', 'https://b.example/x')).toBe(true);
    expect(isMeaningfulRedirect('https://a.example/x', 'https://a.example/y')).toBe(true);
    expect(isMeaningfulRedirect('https://a.example/x', 'https://a.example/x?p=1')).toBe(true);
  });

  it('tidak melempar pada URL yang tidak bisa diurai', () => {
    expect(isMeaningfulRedirect('bukan url', 'bukan url')).toBe(false);
    expect(isMeaningfulRedirect('bukan url', 'https://a.example')).toBe(true);
  });
});

describe('classify', () => {
  const url = 'https://portal.example/spmb';

  it('2xx tanpa pengalihan berarti sehat', () => {
    const hasil = classify(url, probe(200, url), 0);
    expect(hasil).toMatchObject({ status: 'healthy', isFailure: false });
  });

  it('2xx setelah pindah alamat ditandai redirected, bukan rusak', () => {
    const hasil = classify(url, probe(200, 'https://spmb.example/daftar'), 0);
    expect(hasil.status).toBe('redirected');
    expect(hasil.isFailure).toBe(false);
    expect(hasil.note).toContain('spmb.example');
  });

  /** 404 adalah jawaban pasti — menunggu tiga kali hanya menunda perbaikan. */
  it('404 dan 410 langsung rusak tanpa menunggu percobaan berikutnya', () => {
    expect(classify(url, probe(404), 0).status).toBe('broken');
    expect(classify(url, probe(410), 0).status).toBe('broken');
  });

  it('akses terbatas dan pembatasan laju bukan kegagalan', () => {
    for (const code of [401, 403, 429]) {
      const hasil = classify(url, probe(code), 0);
      expect(hasil.status).toBe('warning');
      // Tidak dihitung sebagai kegagalan berturut-turut: server tujuan sehat.
      expect(hasil.isFailure).toBe(false);
    }
  });

  it('5xx menjadi peringatan dulu, rusak setelah cukup kali berturut-turut', () => {
    expect(classify(url, probe(503), 0).status).toBe('warning');
    expect(classify(url, probe(503), FAILURES_BEFORE_BROKEN - 2).status).toBe('warning');
    expect(classify(url, probe(503), FAILURES_BEFORE_BROKEN - 1).status).toBe('broken');
  });

  it('kegagalan jaringan diperlakukan sama dengan 5xx', () => {
    const timeout = probe(null, null, 'Waktu habis setelah 10 detik.');
    expect(classify(url, timeout, 0).status).toBe('warning');
    expect(classify(url, timeout, 0).note).toContain('Waktu habis');
    expect(classify(url, timeout, FAILURES_BEFORE_BROKEN - 1).status).toBe('broken');
  });

  it('kegagalan jaringan tanpa pesan tetap punya penjelasan', () => {
    expect(classify(url, probe(null), 0).note).toBeTruthy();
  });

  it('4xx lain dilaporkan sebagai peringatan, bukan diabaikan', () => {
    const hasil = classify(url, probe(418), 0);
    expect(hasil.status).toBe('warning');
    expect(hasil.note).toContain('418');
  });
});

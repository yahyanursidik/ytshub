/**
 * Guardrail test untuk 05-HALLMARK-ANTI-SLOP.md §7 (content authenticity).
 * Test ini gagal bila ada yang menyisipkan data YTS karangan ke fixture:
 * statistik, biaya, tanggal konkret, alamat, atau nomor kontak.
 */
import { describe, expect, it } from 'vitest';
import {
  activePrograms,
  appRegistry,
  popularFaqs,
  popularServices,
  featuredUnits,
  taskShortcuts,
} from './fixtures';

const allText = JSON.stringify({
  activePrograms,
  appRegistry,
  popularFaqs,
  popularServices,
  featuredUnits,
});

describe('fixtures: content authenticity', () => {
  it('tidak memuat nomor telepon/WhatsApp', () => {
    expect(allText).not.toMatch(/(\+?62|08)\d{7,}/);
  });

  it('tidak memuat nominal rupiah', () => {
    expect(allText).not.toMatch(/rp\s?\d/i);
  });

  it('tidak memuat tanggal konkret di teks yang tampil ke pengguna', () => {
    const visible = JSON.stringify({ activePrograms, appRegistry, popularFaqs, popularServices });
    expect(visible).not.toMatch(
      /\b\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i,
    );
  });

  it('tidak memuat klaim statistik jamaah/peserta', () => {
    expect(allText).not.toMatch(/\b\d[\d.,]*\+?\s*(jamaah|peserta|santri|siswa|donatur|alumni)\b/i);
  });

  it('tidak memuat testimonial atau rating', () => {
    expect(allText).not.toMatch(/\b(testimoni|rating|bintang\s*\d|ulasan)\b/i);
  });
});

describe('fixtures: integritas struktur', () => {
  it('setiap entity publik punya owner unit dan status published', () => {
    const entities = [...popularServices, ...activePrograms, ...popularFaqs, ...appRegistry];
    for (const entity of entities) {
      expect(entity.ownerUnitId, `${entity.code} tanpa owner`).toBeTruthy();
      expect(entity.status, `${entity.code} bukan published`).toBe('published');
      expect(entity.visibility, `${entity.code} bukan public`).toBe('public');
    }
  });

  it('slug unik antar entity sejenis', () => {
    const slugs = popularServices.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('landing page memakai tepat 6 task shortcut (03-LANDING §6)', () => {
    expect(taskShortcuts).toHaveLength(6);
  });

  it('program aktif di landing page maksimal 4 (03-LANDING §9)', () => {
    expect(activePrograms.length).toBeLessThanOrEqual(4);
  });

  it('layanan eksternal ditandai isExternal agar UI bisa memberi indikator', () => {
    for (const service of popularServices) {
      const looksExternal = /^https?:\/\//.test(service.ctaUrl) || service.ctaUrl === '#';
      if (service.isExternal) expect(looksExternal).toBe(true);
      if (service.ctaUrl.startsWith('/')) expect(service.isExternal).toBe(false);
    }
  });
});

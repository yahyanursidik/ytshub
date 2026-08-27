/**
 * Guardrail keaslian konten untuk seed pengembangan.
 * Menggantikan test yang sebelumnya menjaga src/data/fixtures.ts pada Fase 1.
 *
 * Aturan 05-HALLMARK-ANTI-SLOP.md §7 — dilarang mengarang data YTS. Test ini gagal
 * bila ada yang menyisipkan statistik, biaya, tanggal, alamat, atau nomor kontak
 * ke dalam seed. Tidak berjalan terhadap database, jadi selalu ikut `npm run test`.
 */
import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER,
  SEED_CODE_PREFIX,
  seedApplications,
  seedAudiences,
  seedFaqCategories,
  seedFaqs,
  seedPopularQueries,
  seedPrograms,
  seedServices,
  seedUnits,
} from './seed-data';

/** Teks yang benar-benar sampai ke mata pengguna. */
const visibleText = JSON.stringify({
  seedUnits,
  seedServices,
  seedPrograms,
  seedFaqs,
  seedApplications,
  seedAudiences,
  seedFaqCategories,
});

describe('seed: keaslian konten', () => {
  it('tidak memuat nomor telepon atau WhatsApp', () => {
    expect(visibleText).not.toMatch(/(\+?62|08)\d{7,}/);
  });

  it('tidak memuat nominal rupiah', () => {
    expect(visibleText).not.toMatch(/rp\s?\d/i);
  });

  it('tidak memuat tanggal konkret', () => {
    expect(visibleText).not.toMatch(
      /\b\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i,
    );
    expect(visibleText).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
  });

  it('tidak memuat klaim statistik jamaah/peserta', () => {
    expect(visibleText).not.toMatch(
      /\b\d[\d.,]*\+?\s*(jamaah|peserta|santri|siswa|donatur|alumni|cabang)\b/i,
    );
  });

  it('tidak memuat testimonial atau rating', () => {
    expect(visibleText).not.toMatch(/\b(testimoni|rating|bintang\s*\d|ulasan)\b/i);
  });

  it('tidak memuat alamat jalan', () => {
    expect(visibleText).not.toMatch(/\b(jl\.|jalan)\s+[a-z]/i);
  });

  it('field yang menunggu data resmi memakai PLACEHOLDER eksplisit, bukan tebakan', () => {
    for (const service of seedServices) {
      // Persyaratan dan alur tidak boleh dikarang; boleh kosong atau PLACEHOLDER.
      for (const field of [service.requirements, service.processSteps, service.feeInformation]) {
        if (field !== null) expect(field).toBe(PLACEHOLDER);
      }
    }
    for (const program of seedPrograms) {
      if (program.scheduleSummary) expect(program.scheduleSummary).toContain(PLACEHOLDER);
    }
  });

  it('URL eksternal tidak ditebak — dibiarkan null sampai unit pemilik mengisinya', () => {
    for (const app of seedApplications) {
      expect(app.url).toBeNull();
    }
    for (const service of seedServices) {
      // URL internal (diawali /) boleh; URL eksternal harus null sampai diisi.
      if (service.ctaUrl !== null) expect(service.ctaUrl.startsWith('/')).toBe(true);
    }
  });
});

describe('seed: integritas struktur', () => {
  const unitSlugs = new Set(seedUnits.map((unit) => unit.slug));
  const serviceSlugs = new Set(seedServices.map((service) => service.slug));
  const programSlugs = new Set(seedPrograms.map((program) => program.slug));
  const audienceSlugs = new Set(seedAudiences.map((audience) => audience.slug));
  const categorySlugs = new Set(seedFaqCategories.map((category) => category.slug));

  it('setiap baris seed diberi prefix DEV- agar bisa dihapus massal', () => {
    for (const row of [
      ...seedUnits,
      ...seedServices,
      ...seedPrograms,
      ...seedFaqs,
      ...seedApplications,
    ]) {
      expect(row.code.startsWith(SEED_CODE_PREFIX)).toBe(true);
    }
  });

  it('setiap referensi unit menunjuk unit yang ada', () => {
    for (const service of seedServices) expect(unitSlugs.has(service.ownerUnitSlug)).toBe(true);
    for (const program of seedPrograms) expect(unitSlugs.has(program.ownerUnitSlug)).toBe(true);
    for (const faq of seedFaqs) expect(unitSlugs.has(faq.ownerUnitSlug)).toBe(true);
    for (const app of seedApplications) expect(unitSlugs.has(app.ownerUnitSlug)).toBe(true);
  });

  it('setiap referensi audience dan kategori menunjuk baris yang ada', () => {
    for (const service of seedServices) {
      for (const slug of service.audienceSlugs) expect(audienceSlugs.has(slug)).toBe(true);
    }
    for (const program of seedPrograms) {
      for (const slug of program.audienceSlugs) expect(audienceSlugs.has(slug)).toBe(true);
    }
    for (const faq of seedFaqs) expect(categorySlugs.has(faq.categorySlug)).toBe(true);
  });

  it('setiap relasi silang menunjuk entity yang ada (02-IA §7 no dead ends)', () => {
    for (const program of seedPrograms) {
      for (const slug of program.relatedServiceSlugs) expect(serviceSlugs.has(slug)).toBe(true);
    }
    for (const faq of seedFaqs) {
      for (const slug of faq.relatedServiceSlugs) expect(serviceSlugs.has(slug)).toBe(true);
      for (const slug of faq.relatedProgramSlugs) expect(programSlugs.has(slug)).toBe(true);
    }
  });

  it('slug unik di dalam tiap jenis entity', () => {
    const check = (slugs: string[]) => expect(new Set(slugs).size).toBe(slugs.length);
    check(seedUnits.map((row) => row.slug));
    check(seedServices.map((row) => row.slug));
    check(seedPrograms.map((row) => row.slug));
    check(seedFaqs.map((row) => row.slug));
    check(seedApplications.map((row) => row.slug));
  });

  it('code unik lintas seluruh seed', () => {
    const codes = [
      ...seedUnits,
      ...seedServices,
      ...seedPrograms,
      ...seedFaqs,
      ...seedApplications,
    ].map((row) => row.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('landing page memakai maksimal 4 program highlight (03-LANDING §9)', () => {
    expect(seedPrograms.filter((program) => program.isFeatured).length).toBeLessThanOrEqual(4);
  });

  it('query populer di hero berjumlah 3-5 (03-LANDING §4)', () => {
    expect(seedPopularQueries.length).toBeGreaterThanOrEqual(3);
    expect(seedPopularQueries.length).toBeLessThanOrEqual(5);
  });
});

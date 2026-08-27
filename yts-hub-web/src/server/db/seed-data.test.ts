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
  OFFICIAL_CODE_PREFIX,
  officialApplications,
  officialUnits,
} from './official-data';
import {
  PLACEHOLDER,
  SEED_CODE_PREFIX,
  seedAudiences,
  seedContacts,
  seedFaqCategories,
  seedFaqs,
  seedPopularQueries,
  seedPrograms,
  seedServices,
} from './seed-data';

/**
 * Teks yang benar-benar sampai ke mata pengguna dari SEED PENGEMBANGAN.
 *
 * Data resmi (official-data.ts) tidak ikut di sini dan diuji terpisah di bawah:
 * aturannya berbeda. Seed dilarang memuat URL karena URL-nya belum diketahui;
 * data resmi justru berisi URL yang diberikan pengurus, dan melarangnya di sana
 * akan melarang satu-satunya data sungguhan yang kita punya.
 */
const visibleText = JSON.stringify({
  seedServices,
  seedPrograms,
  seedFaqs,
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
    for (const service of seedServices) {
      // URL internal (diawali /) boleh; URL eksternal harus null sampai diisi.
      if (service.ctaUrl !== null) expect(service.ctaUrl.startsWith('/')).toBe(true);
    }
  });
});

describe('seed: integritas struktur', () => {
  const unitSlugs = new Set(officialUnits.map((unit) => unit.slug));
  const serviceSlugs = new Set(seedServices.map((service) => service.slug));
  const programSlugs = new Set(seedPrograms.map((program) => program.slug));
  const audienceSlugs = new Set(seedAudiences.map((audience) => audience.slug));
  const categorySlugs = new Set(seedFaqCategories.map((category) => category.slug));

  it('setiap baris seed diberi prefix DEV- agar bisa dihapus massal', () => {
    for (const row of [...seedServices, ...seedPrograms, ...seedFaqs, ...seedContacts]) {
      expect(row.code.startsWith(SEED_CODE_PREFIX)).toBe(true);
    }
  });

  it('setiap referensi unit menunjuk unit resmi yang ada', () => {
    for (const service of seedServices) expect(unitSlugs.has(service.ownerUnitSlug)).toBe(true);
    for (const program of seedPrograms) expect(unitSlugs.has(program.ownerUnitSlug)).toBe(true);
    for (const faq of seedFaqs) expect(unitSlugs.has(faq.ownerUnitSlug)).toBe(true);
    for (const contact of seedContacts) expect(unitSlugs.has(contact.ownerUnitSlug)).toBe(true);
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
    check(seedServices.map((row) => row.slug));
    check(seedPrograms.map((row) => row.slug));
    check(seedFaqs.map((row) => row.slug));
  });

  it('code unik lintas seluruh data, resmi maupun pengembangan', () => {
    // Diperiksa bersama, bukan per berkas: keduanya masuk ke tabel yang sama,
    // dan `code` adalah referensi canonical lintas sistem (08-INTEGRATION §4).
    const codes = [
      ...officialUnits,
      ...officialApplications,
      ...seedServices,
      ...seedPrograms,
      ...seedFaqs,
      ...seedContacts,
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

/**
 * Data resmi punya aturan sendiri.
 *
 * Yang boleh ada di sini dan dilarang di seed: URL sungguhan. Yang tetap
 * dilarang di keduanya: apa pun yang harus datang dari unit pemilik — biaya,
 * jadwal, alamat, nomor kontak, dan klaim jumlah.
 */
describe('data resmi', () => {
  const officialText = JSON.stringify({ officialUnits, officialApplications });

  it('seluruh baris berkode YTS- agar tidak ikut terhapus db:seed:clear', () => {
    for (const row of [...officialUnits, ...officialApplications]) {
      expect(row.code.startsWith(OFFICIAL_CODE_PREFIX)).toBe(true);
    }
  });

  it('setiap sistem di registry menunjuk unit pemilik yang ada', () => {
    const slugs = new Set(officialUnits.map((unit) => unit.slug));
    for (const app of officialApplications) expect(slugs.has(app.ownerUnitSlug)).toBe(true);
  });

  /**
   * Alamat yang masih `http://` mengirim permintaan pertama tanpa enkripsi —
   * termasuk halaman masuk, bila ada. Untuk sistem yang menerima kata sandi
   * jamaah, itu bukan detail kecil.
   */
  it('seluruh URL memakai https', () => {
    for (const app of officialApplications) {
      expect(app.url, `${app.name}`).toMatch(/^https:\/\//);
    }
    for (const unit of officialUnits) {
      if (unit.websiteUrl) expect(unit.websiteUrl, `${unit.title}`).toMatch(/^https:\/\//);
    }
  });

  it('tidak ada URL yang tercatat dua kali', () => {
    const urls = [
      ...officialApplications.map((app) => app.url),
      ...officialUnits.map((unit) => unit.websiteUrl).filter((url): url is string => url !== null),
    ];
    expect(new Set(urls).size, 'URL ganda akan diperiksa dua kali oleh link checker').toBe(
      urls.length,
    );
  });

  it('tidak memuat data yang harus datang dari unit pemilik', () => {
    expect(officialText).not.toMatch(/(\+?62|08)\d{7,}/); // nomor telepon
    expect(officialText).not.toMatch(/rp\s?\d/i); // nominal
    expect(officialText).not.toMatch(/\b(jl\.|jalan)\s+[a-z]/i); // alamat
    expect(officialText).not.toMatch(
      /\b\d[\d.,]*\+?\s*(jamaah|peserta|santri|siswa|donatur|alumni)\b/i,
    );
  });

  it('tidak menyimpan field credential apa pun (08-INTEGRATION §7)', () => {
    for (const app of officialApplications) {
      for (const key of Object.keys(app)) {
        expect(key).not.toMatch(/password|secret|token|apikey|api_key|credential/i);
      }
    }
  });
});

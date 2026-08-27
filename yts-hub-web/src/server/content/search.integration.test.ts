/**
 * Test integrasi pencarian (Fase 4) terhadap PostgreSQL sungguhan.
 *
 * Yang diuji bukan "apakah query berjalan" melainkan tiga hal yang bisa rusak
 * tanpa ada yang gagal secara teknis:
 *
 * 1. konten non-publik ikut muncul di hasil pencarian — pintu belakang menuju
 *    draft dan konten internal (07-SEARCH §4, 06-CONTENT-MODEL §13);
 * 2. urutan sinyal peringkat di §4 tidak lagi berlaku setelah ekspresi skor
 *    disentuh, dan tidak ada yang menyadarinya karena hasilnya tetap keluar;
 * 3. feedback FAQ tercatat di satu tempat saja.
 *
 * Di-skip otomatis bila DATABASE_URL_TEST kosong.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, createDatabase, schema } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { runSeed } from '@/server/db/seed';
import { search, suggest, suggestCorrection } from '@/server/content/search-queries';
import {
  attachFaqFeedbackReason,
  getTopQueries,
  getZeroResultQueries,
  recordFaqFeedback,
  recordResultClick,
  recordSearch,
} from '@/server/content/search-analytics';

const testUrl = process.env.DATABASE_URL_TEST;
const describeDb = testUrl ? describe : describe.skip;

describeDb('pencarian terpadu', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    await runMigrations();
    db = createDatabase();
    await runSeed(db);
    await db.delete(schema.searchQueries);
  }, 60_000);
  // Menutup pool koneksi setelah berkas ini selesai. Tiap berkas test membuka
  // pool sendiri; membiarkannya terbuka membuat koneksi menumpuk sampai ada
  // test yang gagal karena kehabisan koneksi, bukan karena kodenya salah.
  afterAll(async () => {
    await closeDatabase(db);
  });


  it('menemukan layanan dari nama persisnya', async () => {
    const hasil = await search('ppdb online');
    expect(hasil.total).toBeGreaterThan(0);
    expect(hasil.top?.type).toBe('service');
    expect(hasil.top?.slug).toBe('ppdb-online');
  });

  it('menemukan FAQ dari alias yang tidak muncul di pertanyaannya', async () => {
    // "spmb" ada di kolom keywords FAQ pendaftaran, bukan di teks pertanyaannya.
    const hasil = await search('spmb');
    expect(hasil.hits.some((hit) => hit.type === 'faq')).toBe(true);
  });

  it('mengelompokkan hasil per jenis entity', async () => {
    const hasil = await search('kajian');
    const jenis = new Set([hasil.top!.type, ...hasil.groups.map((group) => group.type)]);
    expect(jenis.size).toBeGreaterThan(1);
    // Satu hasil tidak boleh muncul di dua tempat sekaligus.
    const semua = [hasil.top!, ...hasil.groups.flatMap((group) => group.items)];
    expect(new Set(semua.map((hit) => `${hit.type}:${hit.slug}`)).size).toBe(semua.length);
  });

  it('melonggarkan pencocokan hanya setelah pencocokan ketat kosong', async () => {
    const ketat = await search('donasi');
    expect(ketat.mode).toBe('all');

    // Dua kata yang tidak pernah muncul bersama dalam satu konten.
    const longgar = await search('donasi preschool');
    expect(longgar.mode).toBe('any');
    expect(longgar.total).toBeGreaterThan(0);
  });

  it('kecocokan judul persis mengalahkan kecocokan isi', async () => {
    const hasil = await search('donasi online');
    expect(hasil.top?.slug).toBe('donasi-online');

    const lain = hasil.groups.flatMap((group) => group.items);
    for (const hit of lain) expect(hit.score).toBeLessThan(hasil.top!.score);
  });

  it('input yang berisi sintaks tsquery tidak membuat pencarian gagal', async () => {
    for (const jahat of ["a & (b | !c)", "'; drop table faqs; --", '<->', '((((']) {
      await expect(search(jahat)).resolves.toBeDefined();
    }
    // Tabelnya masih ada — bukan hanya "tidak melempar error".
    expect((await db.select().from(schema.faqs)).length).toBeGreaterThan(0);
  });

  it('query kosong tidak menyentuh database', async () => {
    const hasil = await search('   ');
    expect(hasil.total).toBe(0);
    expect(hasil.top).toBeNull();
  });

  describe('gate publik', () => {
    it('konten draft, internal, dan archived tidak pernah muncul di hasil', async () => {
      const penanda = 'zulfaqarpenandauji';

      for (const [status, visibility] of [
        ['draft', 'public'],
        ['published', 'internal'],
        ['archived', 'public'],
      ] as const) {
        await db
          .update(schema.services)
          .set({ status, visibility, title: `${penanda} ${status} ${visibility}` })
          .where(eq(schema.services.slug, 'konsultasi'));

        const hasil = await search(penanda);
        expect(hasil.hits.some((hit) => hit.slug === 'konsultasi')).toBe(false);
      }

      await db
        .update(schema.services)
        .set({ status: 'published', visibility: 'public', title: 'Konsultasi' })
        .where(eq(schema.services.slug, 'konsultasi'));

      expect((await search('konsultasi')).hits.some((hit) => hit.slug === 'konsultasi')).toBe(true);
    });

    it('field internal registry aplikasi tidak bisa ditemukan lewat search', async () => {
      // Kalau kolom internal ikut masuk search_vector, isinya bisa ditebak dari
      // luar dengan menyusun query yang cocok — kebocoran lewat pintu belakang.
      const rahasia = 'rahasiainternalyangtidakbolehterindeks';
      await db
        .update(schema.applications)
        .set({ integrationNotes: rahasia, technicalOwner: rahasia, hostingProvider: rahasia })
        .where(eq(schema.applications.slug, 'portal-spmb'));

      expect((await search(rahasia)).total).toBe(0);
    });
  });

  describe('saran dan koreksi', () => {
    it('autocomplete tidak menyarankan lebih dari batas §6', async () => {
      const saran = await suggest('ka');
      expect(saran.length).toBeLessThanOrEqual(8);
      for (const item of saran) expect(item.href.startsWith('/')).toBe(true);
    });

    it('autocomplete diam untuk input yang terlalu pendek', async () => {
      expect(await suggest('k')).toEqual([]);
    });

    it('mengoreksi satu huruf yang hilang', async () => {
      expect(await suggestCorrection('sekolh')).toContain('sekolah');
    });

    it('tidak mengarang koreksi untuk kata yang jauh berbeda', async () => {
      expect(await suggestCorrection('zzzqqqwww')).toBeNull();
    });
  });

  describe('analytics', () => {
    it('mencatat query beserta jumlah hasilnya', async () => {
      const hasil = await search('donasi');
      const id = await recordSearch('donasi', hasil.total);
      expect(id).not.toBeNull();

      const [baris] = await db
        .select()
        .from(schema.searchQueries)
        .where(eq(schema.searchQueries.id, id!));
      expect(baris?.queryNormalized).toBe('donasi');
      expect(baris?.resultCount).toBe(hasil.total);
    });

    it('tidak menyimpan kolom identitas apa pun', async () => {
      // Bukan sekadar "tidak diisi" — kolomnya memang tidak boleh ada (§11).
      const kolom = Object.keys(schema.searchQueries).map((key) => key.toLowerCase());
      for (const terlarang of ['ip', 'ipaddress', 'useragent', 'sessionid', 'userid']) {
        expect(kolom).not.toContain(terlarang);
      }
    });

    it('mencatat hasil yang diklik beserta peringkatnya', async () => {
      const id = await recordSearch('ppdb', 3);
      await recordResultClick(id!, 'service', 'ppdb-online', 1);

      const [baris] = await db
        .select()
        .from(schema.searchQueries)
        .where(eq(schema.searchQueries.id, id!));
      expect(baris?.clickedSlug).toBe('ppdb-online');
      expect(baris?.clickedRank).toBe(1);
    });

    it('query tanpa hasil terkumpul sebagai daftar kerja redaksi', async () => {
      await db.delete(schema.searchQueries);
      for (let i = 0; i < 3; i += 1) await recordSearch('layanan yang belum ada', 0);

      const kosong = await getZeroResultQueries();
      expect(kosong[0]?.query).toBe('layanan yang belum ada');
      expect(kosong[0]?.n).toBe(3);
    });

    it('query populer hanya menghitung pencarian yang membuahkan hasil', async () => {
      await db.delete(schema.searchQueries);
      for (let i = 0; i < 4; i += 1) await recordSearch('donasi', 5);
      for (let i = 0; i < 9; i += 1) await recordSearch('tidak ada apa-apa', 0);

      expect(await getTopQueries()).toEqual(['donasi']);
    });

    it('query yang jarang tidak dianggap populer', async () => {
      await db.delete(schema.searchQueries);
      await recordSearch('sekali saja', 2);
      expect(await getTopQueries()).toEqual([]);
    });
  });

  describe('feedback FAQ', () => {
    it('menulis catatan mentah dan penghitung agregat sekaligus', async () => {
      await db.delete(schema.faqFeedback);
      await db.update(schema.faqs).set({ helpfulYes: 0, helpfulNo: 0 });

      const hasil = await recordFaqFeedback('cara-berdonasi', true, null);
      expect(hasil?.helpfulYes).toBe(1);

      const catatan = await db.select().from(schema.faqFeedback);
      expect(catatan).toHaveLength(1);
      expect(catatan[0]?.isHelpful).toBe(true);
    });

    it('menyimpan alasan hanya untuk jawaban "Belum"', async () => {
      await db.delete(schema.faqFeedback);

      await recordFaqFeedback('cara-berdonasi', false, 'kurang-lengkap');
      // Alasan yang ikut terkirim bersama "Ya" dibuang, bukan disimpan:
      // gabungan itu tidak punya arti dan hanya mengotori laporan.
      await recordFaqFeedback('cara-berdonasi', true, 'kurang-jelas');

      const catatan = await db
        .select()
        .from(schema.faqFeedback)
        .orderBy(sql`${schema.faqFeedback.isHelpful}`);
      expect(catatan.map((row) => row.reason)).toEqual(['kurang-lengkap', null]);
    });

    /**
     * Alasan ditanyakan setelah pengguna menjawab, jadi ia tiba sebagai
     * permintaan kedua. Sebelum attachFaqFeedbackReason() ada, permintaan itu
     * dicatat sebagai feedback baru dan satu orang terhitung dua kali "Belum".
     */
    it('melengkapi alasan tanpa menambah suara kedua', async () => {
      await db.delete(schema.faqFeedback);
      await db.update(schema.faqs).set({ helpfulYes: 0, helpfulNo: 0 });

      const awal = await recordFaqFeedback('cara-berdonasi', false, null);
      expect(awal?.helpfulNo).toBe(1);

      expect(await attachFaqFeedbackReason(awal!.feedbackId, 'kurang-lengkap')).toBe(true);

      const [faq] = await db
        .select({ n: schema.faqs.helpfulNo })
        .from(schema.faqs)
        .where(eq(schema.faqs.slug, 'cara-berdonasi'));
      expect(faq?.n).toBe(1);

      const catatan = await db.select().from(schema.faqFeedback);
      expect(catatan).toHaveLength(1);
      expect(catatan[0]?.reason).toBe('kurang-lengkap');
    });

    it('alasan tidak bisa ditimpa berkali-kali dengan id yang sama', async () => {
      await db.delete(schema.faqFeedback);
      const awal = await recordFaqFeedback('cara-berdonasi', false, null);

      expect(await attachFaqFeedbackReason(awal!.feedbackId, 'kurang-jelas')).toBe(true);
      expect(await attachFaqFeedbackReason(awal!.feedbackId, 'sudah-tidak-berlaku')).toBe(false);

      const catatan = await db.select().from(schema.faqFeedback);
      expect(catatan[0]?.reason).toBe('kurang-jelas');
    });

    it('alasan tidak bisa dipasang pada jawaban "Ya"', async () => {
      await db.delete(schema.faqFeedback);
      const awal = await recordFaqFeedback('cara-berdonasi', true, null);
      expect(await attachFaqFeedbackReason(awal!.feedbackId, 'kurang-jelas')).toBe(false);
    });

    it('menolak slug yang bukan FAQ publik', async () => {
      expect(await recordFaqFeedback('faq-yang-tidak-ada', true, null)).toBeNull();
    });
  });
});

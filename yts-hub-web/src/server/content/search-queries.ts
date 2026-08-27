/**
 * Pencarian terpadu — 07-SEARCH-AND-FAQ.md.
 *
 * "Search harus membantu pengguna menemukan jawaban atau tindakan, bukan sekadar
 * mencocokkan string" (§1). Yang membedakan keduanya adalah peringkat, jadi bagian
 * terpenting file ini adalah ekspresi skor di `scoreExpression()` — bukan klausa
 * WHERE-nya.
 *
 * ## Kenapa satu query SQL, bukan enam query lalu digabung di JavaScript
 *
 * Peringkat harus dibandingkan LINTAS jenis entity: sebuah FAQ bisa lebih relevan
 * daripada layanan untuk query yang sama, dan §3 menuntut satu hasil "Paling
 * relevan" di paling atas. Kalau tiap entity diambil terpisah lalu diurutkan di
 * JavaScript, batas `LIMIT` per entity sudah memotong kandidat sebelum sempat
 * dibandingkan — hasil terbaik bisa terbuang hanya karena jenisnya ramai.
 *
 * ## Gate publik
 *
 * Sama persis dengan public-queries.ts: hanya `published` + `public`. Draft dan
 * konten internal tidak pernah bisa ditemukan lewat search (§4, 06-CONTENT-MODEL §13).
 * Kolom pun dipilih eksplisit — tidak ada `select *` di file ini.
 */
import { sql, type SQL } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { buildTsQuery, normalizeQuery, tokenize } from '@/server/content/search-terms';

export type SearchEntityType = 'faq' | 'service' | 'program' | 'unit' | 'event' | 'application';

export interface SearchHit {
  type: SearchEntityType;
  slug: string;
  href: string;
  /** Judul entity; untuk FAQ berisi pertanyaannya. */
  title: string;
  summary: string;
  /** Konteks singkat: kategori, status program, format event, unit pemilik. */
  note: string | null;
  unitName: string | null;
  score: number;
}

/** Cara query dicocokkan — dipakai UI untuk berkata jujur soal hasil yang tampil. */
export type MatchMode = 'all' | 'any';

export interface SearchOutcome {
  raw: string;
  normalized: string;
  hits: SearchHit[];
  /** Hasil dengan skor tertinggi — bagian "Paling relevan" di §3. */
  top: SearchHit | null;
  /** Sisa hasil dikelompokkan per jenis, urut sesuai relevansi kelompoknya. */
  groups: { type: SearchEntityType; label: string; items: SearchHit[] }[];
  mode: MatchMode;
  total: number;
}

/** Label kelompok pada halaman hasil — §3. */
export const entityLabel: Record<SearchEntityType, string> = {
  faq: 'FAQ',
  service: 'Layanan',
  program: 'Program',
  unit: 'Unit',
  event: 'Event',
  application: 'Aplikasi & Website',
};

const hrefFor: Record<SearchEntityType, (slug: string) => string> = {
  faq: (slug) => `/faq/${slug}`,
  service: (slug) => `/layanan/${slug}`,
  program: (slug) => `/program/${slug}`,
  unit: (slug) => `/unit/${slug}`,
  event: (slug) => `/event/${slug}`,
  // Aplikasi tidak punya halaman detail sendiri — 02-IA §5 memperlakukan registry
  // sebagai satu daftar. Fragment mengarahkan ke barisnya, jadi hasil pencarian
  // tetap membawa pengguna ke aplikasi yang dimaksud, bukan ke pucuk daftar.
  application: (slug) => `/aplikasi#${slug}`,
};

/**
 * Ekspresi skor bersama — implementasi urutan sinyal di 07-SEARCH-AND-FAQ.md §4.
 *
 * Angkanya dipilih supaya sinyal yang lebih tinggi TIDAK bisa dikalahkan akumulasi
 * sinyal di bawahnya: kecocokan judul persis (100) selalu di atas kombinasi
 * relevansi teks penuh (maks 40) dan seluruh bonus lain (maks ~25). Itu yang
 * membuat urutannya benar-benar berarti, bukan sekadar penjumlahan bobot.
 *
 * @param vector    kolom tsvector tabel bersangkutan
 * @param titleCol  kolom judul/pertanyaan, untuk sinyal 1
 * @param keyword   sinyal 2 — hanya FAQ yang punya kolom alias
 * @param popular   sinyal 4
 * @param fresh     sinyal 5
 * @param unitCol   sinyal 6 — kolom unit pemilik, null bila entity-nya unit itu sendiri
 */
function scoreExpression(options: {
  vector: SQL;
  titleCol: SQL;
  keyword?: SQL;
  popular?: SQL;
  fresh?: SQL;
  unitCol?: SQL;
}): SQL {
  const { vector, titleCol, keyword, popular, fresh, unitCol } = options;

  // ts_rank_cd dengan normalisasi 32 membagi skor dengan (skor + 1), sehingga
  // hasilnya selalu 0..1. Tanpa itu dokumen panjang mendapat nilai mentah yang
  // besar dan tidak sebanding antar tabel.
  const relevance = sql`ts_rank_cd(${vector}, tsq, 32) * 40`;

  const exact = sql`case
    when lower(${titleCol}) = q.normalized then 100
    when lower(${titleCol}) like q.normalized || '%' then 55
    when position(q.normalized in lower(${titleCol})) > 0 then 35
    else 0 end`;

  return sql`(${relevance}
    + ${exact}
    + ${keyword ?? sql`0`}
    + ${popular ?? sql`0`}
    + ${fresh ?? sql`0`}
    + ${unitCol ? sql`case when ${unitCol} = any(q.unit_ids) then 6 else 0 end` : sql`0`}
  )::float8`;
}

/** Baris mentah hasil UNION. Kolomnya sengaja seragam agar bisa disatukan. */
interface RawHit {
  type: SearchEntityType;
  slug: string;
  title: string;
  summary: string;
  note: string | null;
  unit_name: string | null;
  score: number;
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: unknown[] }).rows ?? []) as T[];
}

/**
 * Membangun query gabungan enam entity.
 *
 * `tsq` dan `q` diikat sebagai parameter, bukan disisipkan ke string SQL. Teks
 * pengunjung tidak pernah menjadi bagian dari perintah.
 */
/**
 * Array `text[]` sebagai daftar parameter, bukan satu nilai.
 *
 * Menyisipkan array JavaScript langsung ke template `sql` tidak menghasilkan
 * array PostgreSQL — driver mengirimkannya sebagai satu nilai skalar dan
 * `array_in` menolaknya. Tiap elemen karena itu diikat sendiri-sendiri; teks
 * pengunjung tetap tidak pernah menjadi bagian dari perintah SQL.
 */
function textArray(values: string[]): SQL {
  if (values.length === 0) return sql`'{}'::text[]`;
  return sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`;
}

function unifiedQuery(
  tsQuery: string,
  normalized: string,
  tokens: string[],
  limit: number,
  mode: MatchMode,
): SQL {
  /**
   * Pencocokan kolom `keywords` harus mengikuti mode yang sedang berlaku.
   *
   * `&&` (beririsan) berarti "cukup satu kata cocok" — kalau dipakai juga di mode
   * ketat, FAQ akan lolos hanya karena salah satu katanya kebetulan ada di daftar
   * alias, sementara halaman tetap mengaku "semua kata cocok". Persis itu yang
   * terjadi sebelum perbaikan ini: "donasi preschool" mengembalikan dua FAQ yang
   * masing-masing hanya memuat satu kata.
   *
   * Jadi mode ketat memakai `@>` (memuat seluruhnya) dan mode longgar `&&`.
   */
  const keywordMatch = mode === 'all' ? sql`f.keywords @> q.tokens` : sql`f.keywords && q.tokens`;

  const branches = [
    // ---- FAQ: satu-satunya entity dengan kolom alias/kata kunci (§4 sinyal 2).
    sql`select 'faq' as type, f.slug, f.question as title, f.summary,
               c.label as note, u.short_name as unit_name,
               ${scoreExpression({
                 vector: sql`f.search_vector`,
                 titleCol: sql`f.question`,
                 keyword: sql`case when f.keywords && q.tokens then 30 else 0 end`,
                 popular: sql`case when f.is_popular then 8 else 0 end
                             + least(f.helpful_yes, 20) * 0.25`,
                 unitCol: sql`f.owner_unit_id`,
               })} as score
        from faqs f
        join faq_categories c on c.id = f.category_id
        join units u on u.id = f.owner_unit_id
        cross join q
        where f.status = 'published' and f.visibility = 'public'
          and (f.search_vector @@ tsq
               or position(q.normalized in lower(f.question)) > 0
               or ${keywordMatch})`,

    sql`select 'service' as type, s.slug, s.title, s.summary,
               s.category as note, u.short_name as unit_name,
               ${scoreExpression({
                 vector: sql`s.search_vector`,
                 titleCol: sql`s.title`,
                 popular: sql`case when s.is_popular then 8 else 0 end`,
                 unitCol: sql`s.owner_unit_id`,
               })} as score
        from services s
        join units u on u.id = s.owner_unit_id
        cross join q
        where s.status = 'published' and s.visibility = 'public'
          and u.status = 'published' and u.visibility = 'public'
          and (s.search_vector @@ tsq or position(q.normalized in lower(s.title)) > 0)`,

    // Program berjalan diangkat, yang sudah selesai diturunkan — §4 sinyal 5.
    sql`select 'program' as type, p.slug, p.title, p.summary,
               p.category as note, u.short_name as unit_name,
               ${scoreExpression({
                 vector: sql`p.search_vector`,
                 titleCol: sql`p.title`,
                 popular: sql`case when p.is_featured then 6 else 0 end`,
                 fresh: sql`case p.program_status
                              when 'berjalan' then 8
                              when 'akan-datang' then 4
                              else -6 end`,
                 unitCol: sql`p.owner_unit_id`,
               })} as score
        from programs p
        join units u on u.id = p.owner_unit_id
        cross join q
        where p.status = 'published' and p.visibility = 'public'
          and u.status = 'published' and u.visibility = 'public'
          and (p.search_vector @@ tsq or position(q.normalized in lower(p.title)) > 0)`,

    sql`select 'unit' as type, u.slug, u.title, u.summary,
               null as note, null as unit_name,
               ${scoreExpression({
                 vector: sql`u.search_vector`,
                 titleCol: sql`u.title`,
               })} as score
        from units u
        cross join q
        where u.status = 'published' and u.visibility = 'public'
          and (u.search_vector @@ tsq
               or position(q.normalized in lower(u.title)) > 0
               or position(q.normalized in lower(u.short_name)) > 0)`,

    // Event yang sudah lewat tetap bisa ditemukan bila dicari langsung, tetapi
    // turun jauh — §4 "archived/expired harus turun atau dikeluarkan". Dipilih
    // "turun" karena orang memang kadang mencari kegiatan yang sudah berlangsung.
    sql`select 'event' as type, e.slug, e.title, e.summary,
               e.format::text as note, u.short_name as unit_name,
               ${scoreExpression({
                 vector: sql`e.search_vector`,
                 titleCol: sql`e.title`,
                 fresh: sql`case
                              when e.start_at is null then 0
                              when e.start_at >= now() then 8
                              else -12 end`,
                 unitCol: sql`e.organizer_unit_id`,
               })} as score
        from events e
        join units u on u.id = e.organizer_unit_id
        cross join q
        where e.status = 'published' and e.visibility = 'public'
          and u.status = 'published' and u.visibility = 'public'
          and (e.search_vector @@ tsq or position(q.normalized in lower(e.title)) > 0)`,

    // Kolom internal registry (technical_owner, repository, hosting, integration
    // notes) tidak ikut di-select DAN tidak ikut di search_vector — lihat schema.ts.
    sql`select 'application' as type, a.slug, a.name as title, a.summary,
               a.kind::text as note, u.short_name as unit_name,
               ${scoreExpression({
                 vector: sql`a.search_vector`,
                 titleCol: sql`a.name`,
                 unitCol: sql`a.owner_unit_id`,
               })} as score
        from applications a
        join units u on u.id = a.owner_unit_id
        cross join q
        where a.status = 'published' and a.visibility = 'public'
          and u.status = 'published' and u.visibility = 'public'
          and (a.search_vector @@ tsq or position(q.normalized in lower(a.name)) > 0)`,
  ];

  return sql`
    with q as (
      select
        to_tsquery('indonesian', ${tsQuery}) as tsq,
        ${normalized}::text as normalized,
        ${textArray(tokens)} as tokens,
        -- Sinyal 6: bila query menyebut nama unit, isi unit itu ikut terangkat.
        coalesce((
          select array_agg(id) from units
          where status = 'published' and visibility = 'public'
            and (position(lower(title) in ${normalized}) > 0
                 or position(lower(short_name) in ${normalized}) > 0)
        ), '{}'::uuid[]) as unit_ids
    )
    select * from (${sql.join(branches, sql` union all `)}) hasil
    where score > 0
    order by score desc, title asc
    limit ${limit}
  `;
}

/**
 * Menjalankan pencarian.
 *
 * Dua percobaan: pertama semua kata wajib ada, dan hanya bila itu kosong barulah
 * dilonggarkan menjadi "cukup satu kata". Urutan ini penting — melonggarkan sejak
 * awal membuat query tiga kata mengembalikan apa saja yang memuat kata paling
 * umum, dan halaman hasil kehilangan artinya. Mode yang dipakai ikut dikembalikan
 * supaya UI bisa mengatakannya kepada pengguna, bukan diam-diam menampilkan hasil
 * yang lebih longgar daripada yang diminta.
 */
export async function search(raw: string, limit = 40): Promise<SearchOutcome> {
  const normalized = normalizeQuery(raw);
  const tokens = tokenize(raw);
  const { all, any } = buildTsQuery(raw);

  const empty: SearchOutcome = {
    raw,
    normalized,
    hits: [],
    top: null,
    groups: [],
    mode: 'all',
    total: 0,
  };

  if (all === '') return empty;

  const db = getDb();

  let mode: MatchMode = 'all';
  let rows = rowsOf<RawHit>(await db.execute(unifiedQuery(all, normalized, tokens, limit, 'all')));

  if (rows.length === 0 && any !== all) {
    mode = 'any';
    rows = rowsOf<RawHit>(await db.execute(unifiedQuery(any, normalized, tokens, limit, 'any')));
  }

  const hits: SearchHit[] = rows.map((row) => ({
    type: row.type,
    slug: row.slug,
    href: hrefFor[row.type](row.slug),
    title: row.title,
    summary: row.summary,
    note: row.note,
    unitName: row.unit_name,
    score: Number(row.score),
  }));

  if (hits.length === 0) return { ...empty, mode };

  const [top, ...rest] = hits;

  // Kelompok diurutkan menurut hasil terbaik di dalamnya, bukan menurut daftar
  // jenis yang ditetapkan di kode: untuk query "donasi" kelompok Layanan memang
  // seharusnya muncul sebelum FAQ, dan sebaliknya untuk "bagaimana cara".
  const byType = new Map<SearchEntityType, SearchHit[]>();
  for (const hit of rest) {
    const list = byType.get(hit.type) ?? [];
    list.push(hit);
    byType.set(hit.type, list);
  }

  const groups = [...byType.entries()]
    .map(([type, items]) => ({ type, label: entityLabel[type], items }))
    .sort((a, b) => (b.items[0]?.score ?? 0) - (a.items[0]?.score ?? 0));

  return { raw, normalized, hits, top: top ?? null, groups, mode, total: hits.length };
}

/**
 * Saran autocomplete — 07-SEARCH-AND-FAQ.md §6, dibatasi 6–8 saran.
 *
 * Sumbernya sengaja campuran: query yang benar-benar sering diketik orang lain
 * (dari analytics), lalu layanan, FAQ, dan unit. Query populer didahulukan karena
 * itu satu-satunya sumber yang mencerminkan cara pengguna menyebut sesuatu,
 * bukan cara redaksi menamainya.
 */
export interface Suggestion {
  label: string;
  /** Ke mana saran ini membawa — halaman entity, atau halaman hasil pencarian. */
  href: string;
  kind: 'query' | SearchEntityType;
}

export async function suggest(raw: string, limit = 7): Promise<Suggestion[]> {
  const normalized = normalizeQuery(raw);
  if (normalized.length < 2) return [];

  const like = `${normalized}%`;
  const contains = `%${normalized}%`;

  const rows = rowsOf<{ label: string; slug: string | null; kind: Suggestion['kind'] }>(
    await getDb().execute(sql`
      (select query_normalized as label, null::text as slug, 'query' as kind,
              count(*)::int as weight, 0 as tier
         from search_queries
        where result_count > 0 and query_normalized like ${like}
        group by query_normalized
        order by count(*) desc
        limit 3)
      union all
      (select title as label, slug, 'service' as kind, 0 as weight, 1 as tier
         from services
        where status = 'published' and visibility = 'public' and lower(title) like ${contains}
        order by sort_order, title
        limit 4)
      union all
      (select question as label, slug, 'faq' as kind, 0 as weight, 2 as tier
         from faqs
        where status = 'published' and visibility = 'public'
          and (lower(question) like ${contains} or keywords && ${textArray([normalized])})
        order by sort_order, question
        limit 4)
      union all
      (select title as label, slug, 'unit' as kind, 0 as weight, 3 as tier
         from units
        where status = 'published' and visibility = 'public'
          and (lower(title) like ${contains} or lower(short_name) like ${contains})
        order by sort_order, title
        limit 2)
      order by tier, weight desc, label
      limit ${limit}
    `),
  );

  return rows.map((row) => ({
    label: row.label,
    kind: row.kind,
    href:
      row.kind === 'query' || row.slug === null
        ? `/cari?q=${encodeURIComponent(row.label)}`
        : hrefFor[row.kind](row.slug),
  }));
}

/**
 * Koreksi kata kunci untuk halaman tanpa hasil — §7 ("koreksi kata kunci").
 *
 * Dikoreksi PER KATA, bukan per kalimat. Membandingkan "sekolh" dengan seluruh
 * pertanyaan "Bagaimana cara mendaftar sekolah YTS?" menghasilkan kemiripan
 * rendah — bagian yang cocok tenggelam di antara kata lain — sehingga koreksi
 * tidak pernah muncul justru saat paling dibutuhkan. Karena itu judul, pertanyaan,
 * dan alias dipecah dulu menjadi kata, lalu tiap kata pengguna dicocokkan ke
 * kosakata itu.
 *
 * Hanya kata yang benar-benar tidak dikenali yang diganti; kata yang sudah ada di
 * kosakata dibiarkan apa adanya. Bila tidak ada satu pun kata yang bisa
 * diperbaiki, mengembalikan null — 07-SEARCH §7 lebih baik menawarkan kategori
 * dan FAQ populer daripada saran yang salah.
 */
export async function suggestCorrection(raw: string): Promise<string | null> {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return null;

  // Ambang 0.4, diukur bukan ditebak. Satu huruf hilang pada kata sedang
  // memberi ~0.44 (donsi→donasi, kajan→kajian), sedangkan dua kata berbeda yang
  // kebetulan berbagi awalan jatuh jauh di bawahnya (dana→donasi = 0.09).
  //
  // Huruf tertukar (porgram→program = 0.33) sengaja TIDAK ikut terkoreksi:
  // menurunkan ambang sampai menangkapnya juga membuka pintu bagi saran yang
  // salah, dan §7 sudah menyediakan kategori serta FAQ populer sebagai jalan
  // keluar lain untuk pencarian tanpa hasil.
  const rows = rowsOf<{ token: string; koreksi: string }>(
    await getDb().execute(sql`
      with kosakata as (
        select distinct lower(kata) as kata from (
          select unnest(regexp_split_to_array(question, '[^[:alnum:]]+')) as kata
            from faqs where status = 'published' and visibility = 'public'
          union all
          select unnest(keywords) from faqs
            where status = 'published' and visibility = 'public'
          union all
          select unnest(regexp_split_to_array(title, '[^[:alnum:]]+'))
            from services where status = 'published' and visibility = 'public'
          union all
          select unnest(regexp_split_to_array(title, '[^[:alnum:]]+'))
            from programs where status = 'published' and visibility = 'public'
          union all
          select unnest(regexp_split_to_array(title || ' ' || short_name, '[^[:alnum:]]+'))
            from units where status = 'published' and visibility = 'public'
        ) semua
        where length(kata) >= 3
      ),
      dicari as (select unnest(${textArray(tokens)}) as token)
      select dicari.token,
             (select kata from kosakata
               where similarity(kata, dicari.token) > 0.4
               order by similarity(kata, dicari.token) desc
               limit 1) as koreksi
        from dicari
       where not exists (select 1 from kosakata where kata = dicari.token)
    `),
  );

  const corrections = new Map(
    rows.filter((row) => row.koreksi !== null).map((row) => [row.token, row.koreksi] as const),
  );
  if (corrections.size === 0) return null;

  return tokens.map((token) => corrections.get(token) ?? token).join(' ');
}

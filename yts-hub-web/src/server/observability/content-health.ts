/**
 * Kesehatan konten — 10-DEVELOPMENT-PLAN.md §10 ("content health").
 *
 * Menjawab satu pertanyaan yang tidak dijawab audit log maupun pemantau tautan:
 * apakah yang SUDAH TERBIT benar-benar layak dibaca publik.
 *
 * Temuan terpenting ada di urutan pertama dan bukan kebetulan: konten terbit
 * yang isinya masih PLACEHOLDER. Itu persis pelanggaran yang paling ditakuti
 * proyek ini — 05-HALLMARK-ANTI-SLOP.md §7, "no fake data exposed as real" —
 * dan satu-satunya cara ia lolos adalah lewat penerbitan yang tidak diperiksa.
 * Seed sengaja mengisi field yang menunggu data unit dengan PLACEHOLDER
 * eksplisit; laporan ini yang memastikan penanda itu tidak ikut terbit diam-diam.
 *
 * Berbeda dari pemantau tautan, laporan ini TIDAK menyimpan hasilnya. Ia dihitung
 * saat halaman dibuka: seluruh datanya sudah ada di tabel konten, dan menyimpan
 * salinan hanya menciptakan kemungkinan laporan yang basi tanpa ada yang tahu.
 */
import { sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { PLACEHOLDER } from '@/server/db/seed-data';
import { ENTITIES, type EntityKey } from '@/server/admin/entities';

export type IssueKind = 'placeholder' | 'field-kosong' | 'buntu' | 'tanpa-tinjauan';

export interface ContentIssue {
  kind: IssueKind;
  entity: EntityKey;
  entityId: string;
  slug: string;
  title: string;
  unitId: string | null;
  unitName: string | null;
  /** Penjelasan yang bisa langsung ditindaklanjuti. */
  detail: string;
}

export const ISSUE_LABEL: Record<IssueKind, string> = {
  placeholder: 'Masih berisi placeholder',
  'field-kosong': 'Field wajib kosong',
  buntu: 'Halaman buntu',
  'tanpa-tinjauan': 'Tanpa jadwal tinjauan',
};

export const ISSUE_WHY: Record<IssueKind, string> = {
  placeholder:
    'Terbit dengan penanda "menunggu data resmi unit" yang terbaca pengunjung sebagai isi sebenarnya (05-HALLMARK §7).',
  'field-kosong':
    'Field yang ditandai wajib di admin masih kosong, padahal kontennya sudah terbit.',
  buntu:
    'Tidak punya satu pun tautan lanjutan. 02-IA §7 melarang halaman buntu — pengunjung sampai di sini lalu berhenti.',
  'tanpa-tinjauan':
    'Terbit tanpa tanggal tinjauan, sehingga tidak akan pernah muncul di antrean tinjauan ulang (06-CONTENT-MODEL §10).',
};

interface RawRow {
  entity: EntityKey;
  entityId: string;
  slug: string;
  title: string;
  unitId: string | null;
  unitName: string | null;
  kind: IssueKind;
  detail: string;
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: unknown[] }).rows ?? []) as T[];
}

/**
 * Kolom teks tiap entity yang boleh memuat PLACEHOLDER.
 *
 * Diturunkan dari peta field admin, bukan ditulis ulang: menambah field baru di
 * entities.ts otomatis ikut diperiksa, dan daftar terpisah pasti akan tertinggal.
 */
function placeholderColumns(key: EntityKey): string[] {
  const TEXTUAL = new Set(['text', 'textarea']);
  const SNAKE = (name: string) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return ENTITIES[key].fields
    .filter((field) => TEXTUAL.has(field.type))
    .map((field) => SNAKE(field.name));
}

/**
 * Menyusun temuan untuk satu jenis entity.
 *
 * Ditulis sebagai SQL, bukan dengan menarik seluruh baris lalu memeriksanya di
 * JavaScript: jumlah konten YTS akan tumbuh, dan laporan yang menarik semuanya
 * akan melambat justru ketika paling dibutuhkan.
 */
async function issuesFor(key: EntityKey, unitIds: string[] | null): Promise<ContentIssue[]> {
  const spec = ENTITIES[key];
  const table = sql.raw(`"${spec.key === 'faq' ? 'faqs' : `${spec.key}s`}"`);
  const titleCol = sql.raw(`"${spec.titleColumn === 'question' ? 'question' : spec.titleColumn}"`);
  const ownerCol = sql.raw(
    spec.ownerColumn === 'self'
      ? '"id"'
      : `"${spec.ownerColumn.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}"`,
  );

  const columns = placeholderColumns(key);
  const placeholderCheck =
    columns.length === 0
      ? sql`false`
      : sql.join(
          columns.map((column) => sql`t.${sql.raw(`"${column}"`)} like ${`${PLACEHOLDER}%`}`),
          sql` or `,
        );

  const scope =
    unitIds === null
      ? sql``
      : unitIds.length === 0
        ? sql`and false`
        : sql`and t.${ownerCol} in (${sql.join(
            unitIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`;

  const rows = rowsOf<RawRow>(
    await getDb().execute(sql`
      select ${key} as entity, t.id as "entityId", t.slug, t.${titleCol} as title,
             t.${ownerCol} as "unitId", u.short_name as "unitName",
             temuan.kind, temuan.detail
        from ${table} t
        left join units u on u.id = t.${ownerCol}
        cross join lateral (
          select 'placeholder'::text as kind,
                 'Ada field yang masih berisi teks PLACEHOLDER.'::text as detail
           where ${placeholderCheck}
          union all
          select 'tanpa-tinjauan', 'Terbit tetapi review_due_at kosong.'
           where t.review_due_at is null
        ) temuan
       where t.status = 'published' and t.visibility = 'public'
         ${scope}
       order by t.${titleCol}
    `),
  );

  return rows.map((row) => ({ ...row, entity: key }));
}

export interface HealthReport {
  issues: ContentIssue[];
  byKind: Record<IssueKind, number>;
  /** Jumlah konten terbit yang diperiksa. */
  checked: number;
}

/**
 * @param unitIds unit yang boleh dilihat pemanggil; null = seluruh organisasi
 */
export async function contentHealth(unitIds: string[] | null): Promise<HealthReport> {
  const keys: EntityKey[] = ['service', 'program', 'faq', 'event', 'unit', 'application'];

  const perEntity = await Promise.all(keys.map((key) => issuesFor(key, unitIds)));
  const issues = perEntity.flat();

  const byKind: Record<IssueKind, number> = {
    placeholder: 0,
    'field-kosong': 0,
    buntu: 0,
    'tanpa-tinjauan': 0,
  };
  for (const issue of issues) byKind[issue.kind] += 1;

  // Placeholder lebih dulu: itu satu-satunya temuan yang sudah terbaca
  // pengunjung sebagai informasi resmi.
  const ORDER: IssueKind[] = ['placeholder', 'field-kosong', 'buntu', 'tanpa-tinjauan'];
  issues.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  return { issues, byKind, checked: new Set(issues.map((issue) => issue.entityId)).size };
}

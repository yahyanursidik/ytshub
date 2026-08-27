/**
 * Governance konten — 06-CONTENT-MODEL-AND-CMS.md §9-§12, 10-DEVELOPMENT-PLAN §8.
 *
 * Satu-satunya jalan konten berubah dari sisi admin. Tiga jaminan yang dipegang
 * di sini, dan tidak boleh diulang atau dilewati di tempat lain:
 *
 * 1. Setiap perubahan melewati `can()` / `canTransition()`. Tidak ada route yang
 *    menyimpulkan izin sendiri (06-CONTENT-MODEL §13).
 * 2. Setiap perubahan menulis satu baris audit berisi keadaan SEBELUMNYA, dalam
 *    transaksi yang sama dengan perubahannya. Kalau salah satunya gagal,
 *    keduanya batal — tidak ada perubahan tanpa jejak, dan tidak ada jejak atas
 *    perubahan yang tidak terjadi.
 * 3. Penerbitan mengisi published_at, reviewed_at, dan review_due_at sekaligus.
 *    §10 menuntut setiap konten terbit punya tanggal tinjauan; mengisinya
 *    otomatis membuat kewajiban itu tidak bergantung pada ingatan seseorang.
 */
import { and, eq, sql, type SQL } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { contentAudit, units } from '@/server/db/schema';
import {
  can,
  canTransition,
  nextReviewDate,
  type Action,
  type Actor,
  type ContentStatus,
} from '@/server/auth/roles';
import { ENTITIES, type EntityKey, type EntitySpec } from '@/server/admin/entities';

/** Baris konten apa pun, dilihat dari sisi governance. */
interface ContentRow {
  id: string;
  slug: string;
  status: ContentStatus;
  ownerUnitId: string | null;
  [key: string]: unknown;
}

export class GovernanceError extends Error {
  constructor(
    message: string,
    readonly kind: 'forbidden' | 'not_found' | 'invalid',
  ) {
    super(message);
    this.name = 'GovernanceError';
  }
}

/**
 * Kolom unit pemilik untuk sebuah entity.
 *
 * Unit adalah pemilik dirinya sendiri, jadi izinnya diperiksa terhadap `id`
 * barisnya — bukan terhadap kolom terpisah yang tidak ada.
 */
function ownerColumnOf(spec: EntitySpec): SQL {
  const table = spec.table as unknown as Record<string, SQL>;
  if (spec.ownerColumn === 'self') return table.id!;
  return table[spec.ownerColumn]!;
}

function tableColumn(spec: EntitySpec, name: string): SQL {
  return (spec.table as unknown as Record<string, SQL>)[name]!;
}

/** Membaca satu baris konten apa adanya, tanpa gate publik — ini sisi admin. */
async function loadRow(spec: EntitySpec, id: string): Promise<ContentRow> {
  const rows = await getDb()
    .select()
    .from(spec.table as never)
    .where(eq(tableColumn(spec, 'id'), id))
    .limit(1);

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new GovernanceError(`${spec.label} tidak ditemukan.`, 'not_found');

  return {
    ...row,
    id: row.id as string,
    slug: row.slug as string,
    status: row.status as ContentStatus,
    ownerUnitId: (spec.ownerColumn === 'self'
      ? row.id
      : row[spec.ownerColumn]) as string | null,
  };
}

/**
 * Menegakkan izin lalu mengembalikan barisnya.
 *
 * Urutannya disengaja: baris dibaca lebih dulu karena izin bergantung pada unit
 * pemiliknya, dan unit itu hanya diketahui dari barisnya sendiri. Yang TIDAK
 * boleh terjadi adalah barisnya ikut dikembalikan saat izin ditolak — karena
 * itu fungsi ini melempar, bukan mengembalikan pasangan {row, allowed}.
 */
async function authorizeRow(
  actor: Actor,
  spec: EntitySpec,
  id: string,
  action: Action,
): Promise<ContentRow> {
  const row = await loadRow(spec, id);
  const permission = can(actor, action, row.ownerUnitId);
  if (!permission.allowed) throw new GovernanceError(permission.reason!, 'forbidden');
  return row;
}

/* --------------------------------------------------------------- membaca */

export interface AdminListItem {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  visibility: string;
  unitId: string | null;
  unitName: string | null;
  updatedAt: Date;
  reviewDueAt: Date | null;
}

/**
 * Daftar konten yang BOLEH DILIHAT `actor`.
 *
 * Penyaringan terjadi di SQL, bukan setelah baris terbaca: daftar yang diambil
 * penuh lalu disaring di JavaScript akan tetap benar di layar, tetapi jumlah
 * total, penghitung, dan halaman berikutnya akan bocor menghitung konten unit
 * lain — dan itu jenis kebocoran yang paling mudah luput.
 */
export async function listForActor(
  actor: Actor,
  key: EntityKey,
  filters: { status?: ContentStatus; unitId?: string } = {},
): Promise<AdminListItem[]> {
  const spec = ENTITIES[key];
  const owner = ownerColumnOf(spec);

  const scope = unitScopeCondition(actor, owner);
  if (scope === null) return [];

  const conditions = [scope];
  if (filters.status) conditions.push(eq(tableColumn(spec, 'status'), filters.status));
  if (filters.unitId) conditions.push(eq(owner, filters.unitId));

  const columns = {
    id: tableColumn(spec, 'id'),
    slug: tableColumn(spec, 'slug'),
    title: tableColumn(spec, spec.titleColumn),
    status: tableColumn(spec, 'status'),
    visibility: tableColumn(spec, 'visibility'),
    unitId: owner,
    updatedAt: tableColumn(spec, 'updatedAt'),
    reviewDueAt: tableColumn(spec, 'reviewDueAt'),
  };

  const order = sql`${tableColumn(spec, 'updatedAt')} desc`;

  // Unit adalah pemiliknya sendiri, jadi nama unitnya ada di baris yang sama.
  // Men-join `units` di sini akan menjadi join tabel ke dirinya sendiri tanpa
  // alias, dan PostgreSQL menolaknya: "table name units specified more than once".
  if (spec.ownerColumn === 'self') {
    const rows = await getDb()
      .select({ ...columns, unitName: units.shortName })
      .from(spec.table as never)
      .where(and(...conditions))
      .orderBy(order);
    return rows as unknown as AdminListItem[];
  }

  const rows = await getDb()
    .select({ ...columns, unitName: units.shortName })
    .from(spec.table as never)
    .leftJoin(units, eq(owner, units.id))
    .where(and(...conditions))
    .orderBy(order);

  return rows as unknown as AdminListItem[];
}

/**
 * Kondisi SQL yang membatasi hasil pada unit yang boleh dilihat `actor`.
 * Mengembalikan null bila ia tidak boleh melihat apa pun.
 */
function unitScopeCondition(actor: Actor, ownerColumn: SQL): SQL | null {
  // Penugasan tingkat organisasi membuka seluruh unit.
  if (actor.assignments.some((assignment) => assignment.unitId === null)) {
    return sql`true`;
  }

  const unitIds = actor.assignments
    .map((assignment) => assignment.unitId)
    .filter((unitId): unitId is string => unitId !== null);

  if (unitIds.length === 0) return null;

  return sql`${ownerColumn} in (${sql.join(
    unitIds.map((unitId) => sql`${unitId}`),
    sql`, `,
  )})`;
}

export async function getForActor(actor: Actor, key: EntityKey, id: string) {
  const spec = ENTITIES[key];
  return authorizeRow(actor, spec, id, 'read');
}

/* ------------------------------------------------------------- menyunting */

/**
 * Menyimpan perubahan field.
 *
 * Status TIDAK bisa diubah lewat jalur ini — itu tugas `transition()`. Kalau
 * keduanya digabung, sebuah form biasa bisa mengirim `status=published` dan
 * melewati seluruh pemeriksaan lifecycle. Karena itu `status`, `publishedAt`,
 * `reviewedAt`, dan `reviewDueAt` dibuang dari input sebelum apa pun ditulis.
 */
const GOVERNED_COLUMNS = ['id', 'code', 'status', 'publishedAt', 'reviewedAt', 'reviewDueAt'];

export async function updateContent(
  actor: Actor,
  key: EntityKey,
  id: string,
  input: Record<string, unknown>,
  changeSummary: string | null,
): Promise<{ changedFields: string[] }> {
  const spec = ENTITIES[key];
  const before = await authorizeRow(actor, spec, id, 'update');

  const editable = new Set(spec.fields.map((field) => field.name));
  const patch: Record<string, unknown> = {};
  const changedFields: string[] = [];

  for (const [name, value] of Object.entries(input)) {
    if (!editable.has(name) || GOVERNED_COLUMNS.includes(name)) continue;
    // Perbandingan longgar disengaja: nilai dari form selalu string, sedangkan
    // nilai di database sudah bertipe. Yang ingin diketahui adalah "berubah
    // atau tidak", bukan "bertipe sama atau tidak".
    if (String(before[name] ?? '') === String(value ?? '')) continue;
    patch[name] = value;
    changedFields.push(name);
  }

  if (changedFields.length === 0) return { changedFields: [] };

  await getDb().transaction(async (tx) => {
    await tx
      .update(spec.table as never)
      .set({ ...patch, updatedAt: new Date() } as never)
      .where(eq(tableColumn(spec, 'id'), id));

    await tx.insert(contentAudit).values({
      entity: key,
      entityId: id,
      entitySlug: before.slug,
      action: 'updated',
      actorId: actor.id,
      actorName: actor.name,
      changeSummary,
      changedFields,
      snapshotBefore: pickSnapshot(before, changedFields),
    });
  });

  return { changedFields };
}

/**
 * Keadaan sebelumnya, dibatasi pada kolom yang benar-benar berubah.
 *
 * Menyimpan seluruh baris pada setiap penyuntingan akan menggandakan isi
 * database tanpa menambah informasi: kolom yang tidak berubah sudah ada di
 * tabel aslinya, dan rantai perubahan tetap bisa disusun ulang dari potongan
 * per-kolom ini.
 */
function pickSnapshot(row: ContentRow, fields: string[]): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of fields) {
    const value = row[field];
    snapshot[field] = value instanceof Date ? value.toISOString() : value;
  }
  return snapshot;
}

/* ------------------------------------------------------- transisi status */

export interface TransitionResult {
  from: ContentStatus;
  to: ContentStatus;
  reviewDueAt: Date | null;
}

/**
 * Memindahkan konten ke status lain.
 *
 * Menolak bila perpindahannya tidak terdaftar di §9 ATAU pelakunya tidak
 * berwenang — keduanya diperiksa oleh `canTransition`, sekaligus, karena celah
 * yang paling sering terjadi adalah salah satunya diperiksa dan satunya tidak.
 */
export async function transition(
  actor: Actor,
  key: EntityKey,
  id: string,
  to: ContentStatus,
  reason: string | null,
): Promise<TransitionResult> {
  const spec = ENTITIES[key];
  const before = await loadRow(spec, id);

  const permission = canTransition(actor, before.status, to, before.ownerUnitId);
  if (!permission.allowed) throw new GovernanceError(permission.reason!, 'forbidden');

  if (to === 'in_review') assertReadyForReview(spec, before);

  const now = new Date();
  const patch: Record<string, unknown> = { status: to, updatedAt: now };
  let reviewDueAt: Date | null = null;

  if (to === 'published') {
    reviewDueAt = nextReviewDate(key, now);
    // publishedAt hanya diisi sekali: yang dicari orang adalah kapan informasi
    // ini pertama kali tersedia, bukan kapan terakhir disunting.
    if (!before.publishedAt) patch.publishedAt = now;
    patch.reviewedAt = now;
    patch.reviewDueAt = reviewDueAt;
  }

  if (to === 'archived') {
    // Konten arsip tidak punya jadwal tinjauan — ia tidak lagi menjanjikan
    // apa pun kepada publik, dan membiarkannya jatuh tempo hanya membuat
    // daftar kerja redaksi penuh oleh hal yang sudah selesai.
    patch.reviewDueAt = null;
  }

  await getDb().transaction(async (tx) => {
    await tx
      .update(spec.table as never)
      .set(patch as never)
      .where(eq(tableColumn(spec, 'id'), id));

    await tx.insert(contentAudit).values({
      entity: key,
      entityId: id,
      entitySlug: before.slug,
      action: 'status_changed',
      fromStatus: before.status,
      toStatus: to,
      actorId: actor.id,
      actorName: actor.name,
      changeSummary: reason,
      changedFields: ['status'],
      snapshotBefore: { status: before.status },
    });
  });

  return { from: before.status, to, reviewDueAt };
}

/**
 * Konten tidak boleh masuk antrean tinjauan dalam keadaan setengah jadi.
 *
 * Diperiksa saat pengiriman, bukan saat penyimpanan: draft memang boleh
 * disimpan belum lengkap — itu gunanya draft. Yang tidak boleh adalah
 * membebani approver dengan konten yang jelas belum siap dibaca.
 */
function assertReadyForReview(spec: EntitySpec, row: ContentRow): void {
  const missing = spec.fields
    .filter((field) => field.required)
    .filter((field) => {
      const value = row[field.name];
      return value === null || value === undefined || String(value).trim() === '';
    })
    .map((field) => field.label);

  if (missing.length > 0) {
    throw new GovernanceError(
      `Belum bisa dikirim untuk ditinjau. Field wajib yang masih kosong: ${missing.join(', ')}.`,
      'invalid',
    );
  }
}

/* ------------------------------------------------------------- audit log */

export interface AuditEntry {
  id: string;
  action: string;
  fromStatus: ContentStatus | null;
  toStatus: ContentStatus | null;
  actorName: string | null;
  changeSummary: string | null;
  changedFields: string[];
  createdAt: Date;
}

/** Riwayat satu konten, terbaru lebih dulu — 06-CONTENT-MODEL §12. */
export async function auditFor(
  actor: Actor,
  key: EntityKey,
  id: string,
  limit = 50,
): Promise<AuditEntry[]> {
  // Riwayat mengikuti izin baca kontennya; tidak ada jalur terpisah untuk
  // membaca audit konten yang isinya sendiri tidak boleh dilihat.
  await authorizeRow(actor, ENTITIES[key], id, 'read');

  return getDb()
    .select({
      id: contentAudit.id,
      action: contentAudit.action,
      fromStatus: contentAudit.fromStatus,
      toStatus: contentAudit.toStatus,
      actorName: contentAudit.actorName,
      changeSummary: contentAudit.changeSummary,
      changedFields: contentAudit.changedFields,
      createdAt: contentAudit.createdAt,
    })
    .from(contentAudit)
    .where(and(eq(contentAudit.entity, key), eq(contentAudit.entityId, id)))
    .orderBy(sql`${contentAudit.createdAt} desc`)
    .limit(limit) as unknown as Promise<AuditEntry[]>;
}

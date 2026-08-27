/**
 * Data dasbor admin.
 *
 * Dasbor menjawab satu pertanyaan: apa yang perlu saya kerjakan sekarang.
 * Karena itu isinya bukan statistik, melainkan tiga antrean kerja yang nyata —
 * menunggu tinjauan, jatuh tempo ditinjau ulang, dan draft yang tertinggal.
 *
 * Semuanya dibatasi pada unit yang boleh dilihat pemakainya. Pembatasannya
 * dilakukan lewat `listForActor()` yang sudah menyaring di SQL, bukan dengan
 * query terpisah yang mudah lupa ikut menyaring.
 */
import { isReviewOverdue, type Actor, type ContentStatus } from '@/server/auth/roles';
import { ENTITIES, ENTITY_ORDER, type EntityKey } from '@/server/admin/entities';
import { listForActor, type AdminListItem } from '@/server/admin/governance';

export interface WorkItem extends AdminListItem {
  entity: EntityKey;
  entityLabel: string;
  entitySlug: string;
  /** Hari sampai jatuh tempo; negatif berarti sudah lewat. */
  daysUntilDue: number | null;
}

export interface Dashboard {
  /** Menunggu keputusan approver. */
  awaitingReview: WorkItem[];
  /** Sudah terbit tetapi jadwal tinjauannya lewat — 06-CONTENT-MODEL §11. */
  overdue: WorkItem[];
  /** Akan jatuh tempo dalam 14 hari. */
  dueSoon: WorkItem[];
  /** Draft yang belum bergerak. */
  drafts: WorkItem[];
  /** Jumlah per status, untuk seluruh entity yang boleh dilihat. */
  counts: Record<ContentStatus, number>;
}

const DUE_SOON_DAYS = 14;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export async function buildDashboard(actor: Actor, now: Date = new Date()): Promise<Dashboard> {
  const perEntity = await Promise.all(
    ENTITY_ORDER.map(async (key) => {
      const items = await listForActor(actor, key);
      return items.map<WorkItem>((item) => ({
        ...item,
        entity: key,
        entityLabel: ENTITIES[key].label,
        entitySlug: ENTITIES[key].slug,
        daysUntilDue: item.reviewDueAt ? daysBetween(now, new Date(item.reviewDueAt)) : null,
      }));
    }),
  );

  const all = perEntity.flat();

  const counts: Record<ContentStatus, number> = {
    draft: 0,
    in_review: 0,
    approved: 0,
    published: 0,
    needs_review: 0,
    archived: 0,
  };
  for (const item of all) counts[item.status] += 1;

  const overdue = all
    .filter((item) => isReviewOverdue(item.status, item.reviewDueAt, now))
    // Yang paling lama terlewat lebih dulu — itu yang paling mungkin sudah salah.
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));

  const dueSoon = all
    .filter(
      (item) =>
        item.status === 'published' &&
        item.daysUntilDue !== null &&
        item.daysUntilDue >= 0 &&
        item.daysUntilDue <= DUE_SOON_DAYS,
    )
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));

  const byOldest = (a: WorkItem, b: WorkItem) =>
    new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();

  return {
    // Antrean tinjauan diurutkan dari yang paling lama menunggu: yang tertua
    // adalah yang paling lama menahan pekerjaan orang lain.
    awaitingReview: all.filter((item) => item.status === 'in_review').sort(byOldest),
    overdue,
    dueSoon,
    drafts: all.filter((item) => item.status === 'draft').sort(byOldest).slice(0, 10),
    counts,
  };
}

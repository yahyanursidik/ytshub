/**
 * Pemantauan tautan eksternal — 08-INTEGRATION-AND-ROUTING.md §6.
 *
 * Berjalan sebagai perintah terjadwal (`npm run links:check`), BUKAN saat build
 * dan bukan saat pengunjung membuka halaman. Alasannya: memanggil sistem orang
 * lain adalah efek samping yang harus terkendali jadwal dan jumlahnya, dan
 * halaman publik tidak boleh menunggu jawaban server pihak ketiga.
 *
 * Yang dikirim hanya permintaan HEAD/GET biasa dengan User-Agent yang menyebut
 * dirinya. Tidak ada percobaan menembus apa pun; bila sebuah sistem menolak
 * diperiksa, itu dicatat sebagai catatan untuk manusia, bukan diakali.
 */
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { applications, events, externalLinks, programs, services, units } from '@/server/db/schema';
import { classify, type ProbeResult } from '@/server/integrations/link-status';
import type { LinkEntity } from '@/server/integrations/link-types';

/** Batas waktu satu permintaan. Lewat ini, dicatat sebagai tidak menjawab. */
const TIMEOUT_MS = 10_000;

/** Jeda antar permintaan ke host yang sama, agar pemeriksaan tidak terasa seperti serangan. */
const DELAY_MS = 250;

const USER_AGENT =
  'YTSHubLinkChecker/1.0 (+pemantauan tautan internal Yayasan Tarbiyah Sunnah)';

export interface LinkTarget {
  entity: LinkEntity;
  entityId: string;
  field: string;
  url: string;
  /** Judul kontennya, untuk laporan yang bisa dibaca manusia. */
  title: string;
}

/**
 * Mengumpulkan seluruh URL publik dari tabel konten.
 *
 * Hanya konten `published` + `public`: tautan pada draft belum menjanjikan
 * apa pun kepada siapa pun, dan memeriksanya berarti menghubungi sistem luar
 * atas nama halaman yang belum terbit.
 */
export async function collectTargets(): Promise<LinkTarget[]> {
  const db = getDb();
  const published = <T extends { status: unknown; visibility: unknown }>(table: T) =>
    and(
      eq(table.status as never, 'published' as never),
      eq(table.visibility as never, 'public' as never),
    );

  const [unitRows, serviceRows, programRows, eventRows, appRows] = await Promise.all([
    db
      .select({ id: units.id, title: units.title, websiteUrl: units.websiteUrl })
      .from(units)
      .where(and(published(units), isNotNull(units.websiteUrl))),
    db
      .select({ id: services.id, title: services.title, ctaUrl: services.ctaUrl })
      .from(services)
      .where(and(published(services), isNotNull(services.ctaUrl))),
    db
      .select({ id: programs.id, title: programs.title, ctaUrl: programs.ctaUrl })
      .from(programs)
      .where(and(published(programs), isNotNull(programs.ctaUrl))),
    db
      .select({
        id: events.id,
        title: events.title,
        registrationUrl: events.registrationUrl,
        mapUrl: events.mapUrl,
      })
      .from(events)
      .where(published(events)),
    db
      .select({ id: applications.id, title: applications.name, url: applications.url })
      .from(applications)
      .where(and(published(applications), isNotNull(applications.url))),
  ]);

  const targets: LinkTarget[] = [];
  const add = (
    entity: LinkEntity,
    entityId: string,
    title: string,
    field: string,
    url: string | null,
  ) => {
    // Hanya http(s). `mailto:` dan `tel:` tidak bisa diperiksa dengan cara ini,
    // dan melaporkannya sebagai gagal akan menjadi peringatan palsu selamanya.
    if (url && /^https?:\/\//i.test(url)) targets.push({ entity, entityId, field, url, title });
  };

  for (const row of unitRows) add('unit', row.id, row.title, 'websiteUrl', row.websiteUrl);
  for (const row of serviceRows) add('service', row.id, row.title, 'ctaUrl', row.ctaUrl);
  for (const row of programRows) add('program', row.id, row.title, 'ctaUrl', row.ctaUrl);
  for (const row of eventRows) {
    add('event', row.id, row.title, 'registrationUrl', row.registrationUrl);
    add('event', row.id, row.title, 'mapUrl', row.mapUrl);
  }
  for (const row of appRows) add('application', row.id, row.title, 'url', row.url);

  return targets;
}

/**
 * Menjelaskan kegagalan jaringan dengan kalimat yang bisa ditindaklanjuti.
 *
 * `fetch` di Node melempar "fetch failed" untuk hampir semua kegagalan dan
 * menaruh sebab sebenarnya di `error.cause`. Pesan mentahnya tidak memberi tahu
 * admin apa pun — "fetch failed" sama bunyinya untuk domain yang sudah tidak
 * terdaftar dan untuk sertifikat yang kedaluwarsa, padahal tindakannya berbeda.
 */
function describeNetworkError(error: Error & { cause?: { message?: string; code?: string } }) {
  const code = error.cause?.code;

  const known: Record<string, string> = {
    ENOTFOUND: 'Domain tidak ditemukan — kemungkinan sudah tidak terdaftar.',
    EAI_AGAIN: 'Nama domain gagal diterjemahkan (masalah DNS sementara).',
    ECONNREFUSED: 'Koneksi ditolak — server tidak menerima permintaan di alamat ini.',
    ECONNRESET: 'Koneksi diputus server di tengah permintaan.',
    ETIMEDOUT: 'Server tidak menjawab sampai batas waktu.',
    CERT_HAS_EXPIRED: 'Sertifikat HTTPS tujuan sudah kedaluwarsa.',
    ERR_TLS_CERT_ALTNAME_INVALID: 'Sertifikat HTTPS tidak cocok dengan nama domainnya.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'Sertifikat HTTPS tujuan tidak tepercaya.',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Rantai sertifikat HTTPS tujuan tidak lengkap.',
  };

  if (code && known[code]) return known[code];
  if (code) return `Permintaan gagal (${code}).`;
  return error.cause?.message ?? error.message ?? 'Permintaan gagal.';
}

/**
 * Menghubungi satu URL.
 *
 * HEAD lebih dulu karena tidak menarik badan jawaban. Sebagian server menolak
 * HEAD dengan 405 atau 501 meski halamannya sehat, jadi jawaban itu dicoba
 * ulang dengan GET — tanpa itu, seluruh sistem yang tidak mendukung HEAD akan
 * dilaporkan bermasalah padahal tidak.
 */
export async function probe(url: string): Promise<ProbeResult> {
  const attempt = async (method: 'HEAD' | 'GET'): Promise<ProbeResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      });
      return { httpStatus: response.status, finalUrl: response.url || url, error: null };
    } catch (caught) {
      const error = caught as Error & { cause?: { message?: string; code?: string } };
      return {
        httpStatus: null,
        finalUrl: null,
        error:
          error.name === 'AbortError'
            ? `Tidak ada jawaban dalam ${TIMEOUT_MS / 1000} detik.`
            : describeNetworkError(error),
      };
    } finally {
      clearTimeout(timer);
    }
  };

  const head = await attempt('HEAD');
  if (head.httpStatus === 405 || head.httpStatus === 501) return attempt('GET');
  return head;
}

export interface CheckSummary {
  checked: number;
  healthy: number;
  redirected: number;
  warning: number;
  broken: number;
  /** Tautan yang BARU rusak pada pemeriksaan ini — bahan peringatan ke admin. */
  newlyBroken: { title: string; url: string; note: string }[];
  removed: number;
}

/**
 * Memeriksa seluruh tautan dan menyimpan hasilnya.
 *
 * Berurutan, bukan paralel. Jumlah tautan YTS Hub dihitung puluhan, dan
 * memeriksanya serentak hanya menghemat beberapa detik sambil membuat kita
 * terlihat seperti lonjakan trafik di mata sistem yang diperiksa.
 */
export async function checkAllLinks(
  options: { onProgress?: (target: LinkTarget, status: string) => void } = {},
): Promise<CheckSummary> {
  const db = getDb();
  const targets = await collectTargets();

  const existing = await db.select().from(externalLinks);
  type ExistingRow = (typeof existing)[number];
  const previous = new Map<string, ExistingRow>(
    existing.map((row) => [`${row.entity}:${row.entityId}:${row.field}`, row]),
  );

  const summary: CheckSummary = {
    checked: 0,
    healthy: 0,
    redirected: 0,
    warning: 0,
    broken: 0,
    newlyBroken: [],
    removed: 0,
  };

  const seen: string[] = [];

  for (const target of targets) {
    const key = `${target.entity}:${target.entityId}:${target.field}`;
    seen.push(key);

    const before = previous.get(key);
    // URL yang berubah memulai riwayat baru: kegagalan alamat lama tidak boleh
    // membuat alamat baru langsung dinyatakan rusak.
    const priorFailures = before && before.url === target.url ? before.consecutiveFailures : 0;

    const result = await probe(target.url);
    const verdict = classify(target.url, result, priorFailures);

    const failures = verdict.isFailure ? priorFailures + 1 : 0;
    const wasBroken = before?.status === 'broken' && before.url === target.url;

    await db
      .insert(externalLinks)
      .values({
        entity: target.entity,
        entityId: target.entityId,
        field: target.field,
        url: target.url,
        status: verdict.status,
        httpStatus: result.httpStatus,
        redirectTarget: verdict.status === 'redirected' ? result.finalUrl : null,
        error: result.error,
        consecutiveFailures: failures,
        checkedAt: new Date(),
        firstBrokenAt:
          verdict.status === 'broken' ? (wasBroken ? before.firstBrokenAt : new Date()) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [externalLinks.entity, externalLinks.entityId, externalLinks.field],
        set: {
          url: target.url,
          status: verdict.status,
          httpStatus: result.httpStatus,
          redirectTarget: verdict.status === 'redirected' ? result.finalUrl : null,
          error: result.error,
          consecutiveFailures: failures,
          checkedAt: new Date(),
          firstBrokenAt:
            verdict.status === 'broken'
              ? (wasBroken ? (before?.firstBrokenAt ?? new Date()) : new Date())
              : null,
          updatedAt: new Date(),
        },
      });

    summary.checked += 1;
    summary[verdict.status] += 1;
    if (verdict.status === 'broken' && !wasBroken) {
      summary.newlyBroken.push({ title: target.title, url: target.url, note: verdict.note });
    }

    options.onProgress?.(target, `${verdict.status} — ${verdict.note}`);

    if (DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  // Baris untuk URL yang sudah tidak ada lagi di konten dibuang. Membiarkannya
  // membuat daftar tautan rusak berisi hal yang sudah dihapus editor.
  const stale = existing
    .filter((row) => !seen.includes(`${row.entity}:${row.entityId}:${row.field}`))
    .map((row) => row.id);

  if (stale.length > 0) {
    await db.delete(externalLinks).where(inArray(externalLinks.id, stale));
    summary.removed = stale.length;
  }

  return summary;
}

export interface LinkReportRow {
  id: string;
  entity: LinkEntity;
  entityId: string;
  field: string;
  url: string;
  status: string | null;
  httpStatus: number | null;
  redirectTarget: string | null;
  error: string | null;
  checkedAt: Date | null;
  firstBrokenAt: Date | null;
  title: string | null;
  unitName: string | null;
}

/**
 * Tautan yang perlu ditindaklanjuti, untuk halaman admin.
 *
 * Judul kontennya diambil lewat LEFT JOIN ke lima tabel sekaligus dan
 * digabung dengan COALESCE — satu query, bukan lima query lalu disatukan di
 * JavaScript, supaya pengurutan dan pembatasan jumlahnya tetap berarti.
 */
export async function listLinks(
  filter: {
    status?: string;
    /**
     * Unit yang boleh dilihat pemanggil. `null` berarti seluruh organisasi.
     *
     * Disaring di SQL bersama query-nya, bukan setelah baris terbaca — aturan
     * yang sama dengan governance.ts, dan alasannya sama: penyaringan setelahnya
     * membuat jumlah dan urutan menghitung konten unit lain.
     */
    unitIds?: string[] | null;
  } = {},
): Promise<LinkReportRow[]> {
  const { unitIds = null } = filter;
  if (unitIds !== null && unitIds.length === 0) return [];

  const unitScope =
    unitIds === null
      ? sql``
      : sql`and coalesce(u.id, s.owner_unit_id, p.owner_unit_id, e.organizer_unit_id,
              a.owner_unit_id) in (${sql.join(
                unitIds.map((id) => sql`${id}::uuid`),
                sql`, `,
              )})`;

  const rows = await getDb().execute(sql`
    select
      l.id, l.entity, l.entity_id as "entityId", l.field, l.url, l.status,
      l.http_status as "httpStatus", l.redirect_target as "redirectTarget",
      l.error, l.checked_at as "checkedAt", l.first_broken_at as "firstBrokenAt",
      coalesce(u.title, s.title, p.title, e.title, a.name) as title,
      coalesce(uu.short_name, su.short_name, pu.short_name, eu.short_name, au.short_name)
        as "unitName"
    from external_links l
    left join units u on l.entity = 'unit' and u.id = l.entity_id
    left join units uu on uu.id = u.id
    left join services s on l.entity = 'service' and s.id = l.entity_id
    left join units su on su.id = s.owner_unit_id
    left join programs p on l.entity = 'program' and p.id = l.entity_id
    left join units pu on pu.id = p.owner_unit_id
    left join events e on l.entity = 'event' and e.id = l.entity_id
    left join units eu on eu.id = e.organizer_unit_id
    left join applications a on l.entity = 'application' and a.id = l.entity_id
    left join units au on au.id = a.owner_unit_id
    where true
      ${filter.status ? sql`and l.status = ${filter.status}` : sql``}
      ${unitScope}
    order by
      case l.status
        when 'broken' then 0 when 'warning' then 1 when 'redirected' then 2 else 3
      end,
      l.checked_at desc nulls last
  `);

  return (Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? [])) as
    LinkReportRow[];
}

/**
 * Status tautan untuk sekumpulan konten, dipakai halaman publik.
 *
 * Halaman publik memakainya untuk berkata jujur: tautan yang diketahui rusak
 * tidak boleh disodorkan seolah-olah berfungsi.
 */
export async function linkStatusFor(
  entity: LinkEntity,
  entityIds: string[],
): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map();

  const rows = await getDb()
    .select({
      entityId: externalLinks.entityId,
      field: externalLinks.field,
      status: externalLinks.status,
    })
    .from(externalLinks)
    .where(and(eq(externalLinks.entity, entity), inArray(externalLinks.entityId, entityIds)));

  return new Map(
    rows
      .filter((row) => row.status !== null)
      .map((row) => [`${row.entityId}:${row.field}`, row.status!] as const),
  );
}

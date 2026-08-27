/**
 * Peran, lifecycle, dan siapa boleh melakukan apa.
 *
 * Sengaja TIDAK menyentuh database maupun HTTP: seluruh isi file ini adalah
 * fungsi murni atas data yang sudah diambil. Aturan otorisasi adalah tempat
 * kesalahan paling mahal di proyek ini, dan aturan yang bisa diuji tanpa
 * database akan benar-benar diuji.
 *
 * Sumber: 06-CONTENT-MODEL-AND-CMS.md §9-§13 dan 10-DEVELOPMENT-PLAN.md §8.
 */

export type Role = 'viewer' | 'editor' | 'approver' | 'admin';

export type ContentStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'needs_review'
  | 'archived';

/**
 * Peran yang dimiliki seseorang, beserta lingkupnya.
 * `unitId: null` berarti berlaku di seluruh organisasi.
 */
export interface RoleAssignment {
  unitId: string | null;
  role: Role;
}

export interface Actor {
  id: string;
  name: string;
  email: string;
  assignments: RoleAssignment[];
}

/**
 * Urutan kewenangan. Dipakai untuk pertanyaan "minimal peran X" — bukan untuk
 * menyimpulkan izin secara langsung, karena lingkup unit tetap harus diperiksa.
 */
const RANK: Record<Role, number> = { viewer: 0, editor: 1, approver: 2, admin: 3 };

/** Tindakan yang bisa diminta seseorang terhadap sebuah konten. */
export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'submit' // draft → in_review
  | 'approve' // in_review → approved
  | 'reject' // in_review → draft
  | 'publish' // approved → published
  | 'archive' // published/approved → archived
  | 'restore' // archived → draft
  | 'manage_users';

/**
 * Peran minimum untuk tiap tindakan.
 *
 * Ditulis sebagai tabel, bukan rangkaian `if`, supaya seluruh kebijakan terbaca
 * dalam satu layar dan penambahan tindakan baru tidak bisa lupa menetapkan
 * siapa yang boleh melakukannya.
 */
const MINIMUM_ROLE: Record<Action, Role> = {
  read: 'viewer',
  create: 'editor',
  update: 'editor',
  submit: 'editor',
  approve: 'approver',
  reject: 'approver',
  publish: 'approver',
  archive: 'approver',
  restore: 'admin',
  manage_users: 'admin',
};

/**
 * Peran tertinggi yang dimiliki seseorang atas sebuah unit.
 *
 * Penugasan organisasi (`unitId: null`) selalu ikut dihitung, sehingga admin
 * organisasi berlaku di semua unit tanpa perlu satu baris per unit.
 *
 * `unitId` null pada pemanggilan berarti "konten belum punya unit" — hanya
 * terjadi saat membuat konten baru; yang berlaku hanyalah penugasan organisasi.
 */
export function roleFor(actor: Actor, unitId: string | null): Role | null {
  let best: Role | null = null;

  for (const assignment of actor.assignments) {
    const applies = assignment.unitId === null || (unitId !== null && assignment.unitId === unitId);
    if (!applies) continue;
    if (best === null || RANK[assignment.role] > RANK[best]) best = assignment.role;
  }

  return best;
}

/** true bila seseorang punya peran apa pun di unit mana pun. */
export function hasAnyRole(actor: Actor): boolean {
  return actor.assignments.length > 0;
}

/**
 * Transisi lifecycle yang sah — 06-CONTENT-MODEL-AND-CMS.md §9.
 *
 * Ditulis sebagai daftar tertutup, bukan aturan yang disimpulkan: status hanya
 * boleh berpindah sepanjang panah yang benar-benar ada di dokumen. Perpindahan
 * yang tidak terdaftar ditolak, termasuk yang "kelihatannya masuk akal" seperti
 * draft langsung ke published.
 */
const TRANSITIONS: { from: ContentStatus; to: ContentStatus; action: Action }[] = [
  { from: 'draft', to: 'in_review', action: 'submit' },
  { from: 'in_review', to: 'draft', action: 'reject' },
  { from: 'in_review', to: 'approved', action: 'approve' },
  // Approver boleh mengembalikan yang sudah disetujui bila keliru, selama belum terbit.
  { from: 'approved', to: 'draft', action: 'reject' },
  { from: 'approved', to: 'published', action: 'publish' },
  // Jatuh tempo tinjauan menaikkan needs_review; dari sana isinya disunting lagi.
  { from: 'needs_review', to: 'draft', action: 'update' },
  { from: 'needs_review', to: 'in_review', action: 'submit' },
  // Konten terbit yang sudah tidak berlaku diarsipkan, tidak dihapus:
  // 12-ACCEPTANCE-CHECKLIST menuntut jejaknya tetap ada.
  { from: 'published', to: 'archived', action: 'archive' },
  { from: 'approved', to: 'archived', action: 'archive' },
  { from: 'needs_review', to: 'archived', action: 'archive' },
  { from: 'draft', to: 'archived', action: 'archive' },
  { from: 'archived', to: 'draft', action: 'restore' },
];

export interface Transition {
  to: ContentStatus;
  action: Action;
  label: string;
  /** Alasan wajib diisi — untuk tindakan yang perlu dipertanggungjawabkan. */
  requiresReason: boolean;
}

const TRANSITION_LABEL: Record<Action, string> = {
  read: 'Lihat',
  create: 'Buat',
  update: 'Kembalikan ke draft',
  submit: 'Kirim untuk ditinjau',
  approve: 'Setujui',
  reject: 'Kembalikan ke penyunting',
  publish: 'Terbitkan',
  archive: 'Arsipkan',
  restore: 'Pulihkan ke draft',
  manage_users: 'Kelola pengguna',
};

/**
 * Tindakan yang mengubah ketersediaan informasi publik atau membatalkan
 * pekerjaan orang lain harus disertai alasan — itulah yang membuat audit log
 * bisa dibaca sebagai riwayat keputusan, bukan sekadar deretan cap waktu.
 */
const REASON_REQUIRED: Action[] = ['reject', 'archive', 'restore'];

/** Semua transisi yang sah dari sebuah status, tanpa memandang siapa pelakunya. */
export function transitionsFrom(status: ContentStatus): Transition[] {
  return TRANSITIONS.filter((transition) => transition.from === status).map((transition) => ({
    to: transition.to,
    action: transition.action,
    label: TRANSITION_LABEL[transition.action],
    requiresReason: REASON_REQUIRED.includes(transition.action),
  }));
}

/** true bila perpindahan status ini terdaftar di 06-CONTENT-MODEL §9. */
export function isValidTransition(from: ContentStatus, to: ContentStatus): boolean {
  return TRANSITIONS.some((transition) => transition.from === from && transition.to === to);
}

/** Tindakan yang memindahkan status dari `from` ke `to`, atau null bila tidak sah. */
export function actionForTransition(from: ContentStatus, to: ContentStatus): Action | null {
  return (
    TRANSITIONS.find((transition) => transition.from === from && transition.to === to)?.action ??
    null
  );
}

export interface Permission {
  allowed: boolean;
  /** Alasan penolakan, untuk ditampilkan dan dicatat. Null bila diizinkan. */
  reason: string | null;
}

const allow: Permission = { allowed: true, reason: null };
const deny = (reason: string): Permission => ({ allowed: false, reason });

/**
 * Keputusan otorisasi tunggal untuk seluruh aplikasi.
 *
 * Setiap route dan setiap aksi admin memanggil fungsi ini. Tidak ada jalur lain
 * yang boleh menyimpulkan izin sendiri — 06-CONTENT-MODEL §13 menuntut otorisasi
 * sisi server sebagai sumber kebenaran, dan sumber kebenaran yang tersebar di
 * banyak tempat bukan sumber kebenaran.
 *
 * @param unitId unit pemilik konten; null saat konten belum ada (pembuatan baru)
 */
export function can(actor: Actor, action: Action, unitId: string | null): Permission {
  const role = roleFor(actor, unitId);

  if (role === null) {
    return deny(
      unitId === null
        ? 'Anda belum diberi peran di organisasi ini.'
        : 'Anda tidak diberi peran pada unit pemilik konten ini.',
    );
  }

  if (RANK[role] < RANK[MINIMUM_ROLE[action]]) {
    return deny(`Tindakan ini membutuhkan peran ${MINIMUM_ROLE[action]}; peran Anda ${role}.`);
  }

  return allow;
}

/**
 * Apakah seseorang boleh memindahkan sebuah konten ke status tertentu.
 *
 * Dua pemeriksaan yang tidak boleh dipisah: perpindahannya sah menurut §9, DAN
 * pelakunya berwenang. Memisahkannya membuka celah klasik — status yang benar
 * dipindahkan oleh orang yang salah, atau sebaliknya.
 */
export function canTransition(
  actor: Actor,
  from: ContentStatus,
  to: ContentStatus,
  unitId: string | null,
): Permission {
  const action = actionForTransition(from, to);

  if (action === null) {
    return deny(`Perpindahan status dari ${from} ke ${to} tidak diizinkan.`);
  }

  return can(actor, action, unitId);
}

/**
 * Jadwal tinjauan ulang — 06-CONTENT-MODEL-AND-CMS.md §11.
 *
 * Angka di dokumen berupa rentang (mis. layanan 90-180 hari); yang dipakai di
 * sini adalah batas BAWAH rentang itu. Konten yang ditinjau lebih sering tidak
 * merugikan siapa pun, sedangkan informasi resmi yayasan yang basi merugikan
 * orang yang mempercayainya.
 */
export const REVIEW_CADENCE_DAYS: Record<string, number> = {
  unit: 180,
  service: 90,
  program: 30,
  faq: 90,
  event: 30,
  application: 90,
};

/** Tanggal tinjauan berikutnya untuk sebuah entity, dihitung dari saat terbit. */
export function nextReviewDate(entity: string, from: Date): Date {
  const days = REVIEW_CADENCE_DAYS[entity] ?? 90;
  const due = new Date(from);
  due.setUTCDate(due.getUTCDate() + days);
  return due;
}

/**
 * true bila konten terbit sudah melewati tanggal tinjauannya.
 *
 * Dihitung, bukan disimpan sebagai status. Kalau `needs_review` ditulis ke
 * database oleh sebuah proses terjadwal, maka daftar "jatuh tempo" hanya
 * seakurat proses itu — dan diamnya proses terlihat sama persis dengan
 * "tidak ada yang jatuh tempo".
 */
export function isReviewOverdue(
  status: ContentStatus,
  reviewDueAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (status !== 'published' || reviewDueAt === null) return false;
  return reviewDueAt.getTime() <= now.getTime();
}

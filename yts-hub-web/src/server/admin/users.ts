/**
 * Pengelolaan pengguna & peran — 10-DEVELOPMENT-PLAN.md §8.
 *
 * Hanya admin organisasi yang boleh menyentuh apa pun di sini. Pemeriksaannya
 * ada di setiap fungsi, bukan hanya di halaman yang memanggilnya: halaman bisa
 * bertambah, fungsi ini yang tetap menjadi pintunya.
 *
 * Kata sandi TIDAK diurus di sini. Menyetel ulang kata sandi tetap lewat
 * `npm run admin:user -- password`, karena tanpa infrastruktur surat satu-satunya
 * cara menyampaikannya adalah menampilkannya di layar orang lain — dan itu
 * tempat yang salah untuk kata sandi.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { units, userUnitRoles, users } from '@/server/db/schema';
import { can, type Actor, type Role } from '@/server/auth/roles';
import { revokeSessionsFor } from '@/server/auth/session';
import { GovernanceError } from '@/server/admin/governance';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  roles: { id: string; role: Role; unitId: string | null; unitName: string | null }[];
}

function assertAdmin(actor: Actor): void {
  const permission = can(actor, 'manage_users', null);
  if (!permission.allowed) throw new GovernanceError(permission.reason!, 'forbidden');
}

export async function listUsers(actor: Actor): Promise<ManagedUser[]> {
  assertAdmin(actor);
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
      roleId: userUnitRoles.id,
      role: userUnitRoles.role,
      unitId: userUnitRoles.unitId,
      unitName: units.shortName,
    })
    .from(users)
    .leftJoin(userUnitRoles, eq(userUnitRoles.userId, users.id))
    .leftJoin(units, eq(userUnitRoles.unitId, units.id))
    .orderBy(asc(users.email));

  // Satu baris per peran menjadi satu entri per pengguna.
  const byUser = new Map<string, ManagedUser>();
  for (const row of rows) {
    const existing = byUser.get(row.id) ?? {
      id: row.id,
      name: row.name,
      email: row.email,
      isActive: row.isActive,
      createdAt: row.createdAt,
      roles: [],
    };
    if (row.roleId && row.role) {
      existing.roles.push({
        id: row.roleId,
        role: row.role as Role,
        unitId: row.unitId,
        unitName: row.unitName,
      });
    }
    byUser.set(row.id, existing);
  }

  return [...byUser.values()];
}

/** Unit yang bisa dipilih saat menetapkan peran. */
export async function assignableUnits(actor: Actor) {
  assertAdmin(actor);
  return getDb()
    .select({ id: units.id, slug: units.slug, name: units.shortName })
    .from(units)
    .orderBy(asc(units.sortOrder), asc(units.title));
}

/**
 * Menetapkan atau mengubah peran seseorang pada satu unit.
 *
 * Satu penugasan per (pengguna, unit): menetapkan ulang menimpa yang lama, bukan
 * menumpuknya. Kalau ditumpuk, `roleFor()` akan memilih yang tertinggi dan
 * penurunan peran tidak akan pernah berlaku — kegagalan yang senyap dan justru
 * ke arah yang lebih berbahaya.
 */
export async function assignRole(
  actor: Actor,
  userId: string,
  role: Role,
  unitId: string | null,
): Promise<void> {
  assertAdmin(actor);
  const db = getDb();

  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!target) throw new GovernanceError('Pengguna tidak ditemukan.', 'not_found');

  const existing = await db
    .select({ id: userUnitRoles.id })
    .from(userUnitRoles)
    .where(
      and(
        eq(userUnitRoles.userId, userId),
        unitId === null ? isNull(userUnitRoles.unitId) : eq(userUnitRoles.unitId, unitId),
      ),
    );

  if (existing[0]) {
    await db.update(userUnitRoles).set({ role }).where(eq(userUnitRoles.id, existing[0].id));
  } else {
    await db.insert(userUnitRoles).values({ userId, unitId, role });
  }
}

export async function removeRole(actor: Actor, roleId: string): Promise<void> {
  assertAdmin(actor);
  await getDb().delete(userUnitRoles).where(eq(userUnitRoles.id, roleId));
}

/**
 * Menonaktifkan atau mengaktifkan akun.
 *
 * Menonaktifkan tidak menghapus barisnya — audit log menunjuk ke pengguna ini,
 * dan riwayat siapa menerbitkan apa tidak boleh hilang karena orangnya sudah
 * tidak bertugas (06-CONTENT-MODEL §10). Sesinya diakhiri seketika agar
 * penonaktifan berlaku sekarang, bukan saat cookie-nya kedaluwarsa.
 *
 * Admin tidak bisa menonaktifkan dirinya sendiri: itu satu-satunya kesalahan di
 * halaman ini yang tidak bisa diperbaiki dari dalam aplikasi.
 */
export async function setUserActive(
  actor: Actor,
  userId: string,
  isActive: boolean,
): Promise<void> {
  assertAdmin(actor);

  if (userId === actor.id && !isActive) {
    throw new GovernanceError(
      'Anda tidak bisa menonaktifkan akun Anda sendiri. Minta admin lain melakukannya.',
      'invalid',
    );
  }

  const db = getDb();
  await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
  if (!isActive) await revokeSessionsFor(userId);
}

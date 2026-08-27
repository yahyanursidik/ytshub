/**
 * Menerjemahkan sesi better-auth menjadi `Actor` — objek yang dipakai seluruh
 * pemeriksaan izin di src/server/auth/roles.ts.
 *
 * Ini satu-satunya tempat yang membaca cookie sesi. Route dan komponen tidak
 * pernah menyentuhnya langsung; mereka menerima `Actor` yang sudah lengkap
 * dengan penugasan perannya, sehingga tidak ada halaman yang bisa "lupa"
 * memuat peran lalu menyimpulkan izin dari data yang setengah terisi.
 */
import { and, eq, gt } from 'drizzle-orm';

import { getAuth } from '@/server/auth/auth';
import { getDb } from '@/server/db/client';
import { sessions, userUnitRoles, users } from '@/server/db/schema';
import type { Actor, RoleAssignment } from '@/server/auth/roles';

/**
 * Membaca sesi dari permintaan, lalu mengambil penugasan perannya.
 *
 * Mengembalikan null bila tidak ada sesi sah, ATAU bila akunnya sudah
 * dinonaktifkan. Pemeriksaan `isActive` dilakukan di sini, bukan hanya saat
 * masuk: menonaktifkan akun harus langsung berlaku pada sesi yang sedang
 * berjalan, bukan menunggu sesinya kedaluwarsa tujuh hari kemudian.
 */
export async function getActor(request: Request): Promise<Actor | null> {
  const auth = getAuth();

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;

  const db = getDb();

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user || !user.isActive) return null;

  const assignments = await db
    .select({ unitId: userUnitRoles.unitId, role: userUnitRoles.role })
    .from(userUnitRoles)
    .where(eq(userUnitRoles.userId, user.id));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    assignments: assignments as RoleAssignment[],
  };
}

/**
 * Mengakhiri seluruh sesi milik seseorang.
 *
 * Dipakai saat akun dinonaktifkan atau kata sandinya disetel ulang. `getActor`
 * sudah menolak akun nonaktif, tetapi menghapus sesinya tetap perlu — kalau
 * tidak, barisnya menumpuk sampai kedaluwarsa dan cookie lama tetap dikirim
 * ke setiap permintaan tanpa pernah bisa dipakai.
 */
export async function revokeSessionsFor(userId: string): Promise<number> {
  const deleted = await getDb()
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id });
  return deleted.length;
}

/** Jumlah sesi yang masih berlaku — dipakai halaman pengguna di admin. */
export async function countActiveSessions(userId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())));
  return rows.length;
}

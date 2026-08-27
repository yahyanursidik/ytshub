/**
 * CLI pengelolaan akun admin.
 *
 * Pendaftaran mandiri dimatikan (lihat src/server/auth/auth.ts), jadi inilah
 * jalan akun pertama dibuat — dan jalan kata sandi disetel ulang selama belum
 * ada infrastruktur surat.
 *
 * Kata sandi dibuat oleh perintah ini dan ditampilkan SEKALI, bukan diketik
 * sebagai argumen: argumen tersimpan di riwayat shell dan terbaca di daftar
 * proses. Untuk memasukkan kata sandi pilihan sendiri, pakai variabel
 * environment YTS_ADMIN_PASSWORD.
 *
 * Pakai:
 *   npm run admin:user -- create "Nama" email@yts.or.id admin
 *   npm run admin:user -- role email@yts.or.id editor ts-lab-school
 *   npm run admin:user -- password email@yts.or.id
 *   npm run admin:user -- disable email@yts.or.id
 *   npm run admin:user -- list
 */
import 'dotenv/config';

import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { createLocalAccountIssuer } from '@better-auth/core/db';

import { createDatabase } from '../src/server/db/client.ts';
import { getAuth } from '../src/server/auth/auth.ts';
import { units, userUnitRoles, users } from '../src/server/db/schema.ts';
import { revokeSessionsFor } from '../src/server/auth/session.ts';

const ROLES = ['viewer', 'editor', 'approver', 'admin'] as const;
type Role = (typeof ROLES)[number];

const db = createDatabase();

/** Kata sandi acak yang bisa dibacakan lewat telepon tanpa salah dengar. */
function generatePassword(): string {
  // Tanpa huruf/angka yang mudah tertukar (0/O, 1/l/I).
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(20);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

async function findUser(email: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return user ?? null;
}

/**
 * Memastikan argumennya benar-benar alamat email.
 *
 * Bukan validasi berlebihan: di Windows, `npm run admin:user -- create "Nama Panjang" ...`
 * kehilangan tanda kutipnya, sehingga nama bergeser menjadi email dan email
 * menjadi peran. Tanpa pemeriksaan ini akun akan terbuat dengan email "YTS".
 */
function assertEmail(value: string, position: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(
      `"${value}" bukan alamat email yang sah (dibaca sebagai ${position}).\n` +
        '  Bila nama Anda mengandung spasi, sebagian shell membuang tanda kutipnya.\n' +
        '  Jalankan langsung tanpa npm run:  npx tsx scripts/admin.ts create "Nama Panjang" email@yts.or.id admin',
    );
  }
}

async function create(name: string, email: string, role: string, unitSlug?: string) {
  assertEmail(email, 'email');
  if (!ROLES.includes(role as Role)) {
    throw new Error(`Peran tidak dikenal: ${role}. Pilih salah satu dari ${ROLES.join(', ')}.`);
  }
  if (await findUser(email)) {
    throw new Error(`Sudah ada akun dengan email ${email}.`);
  }

  const password = process.env.YTS_ADMIN_PASSWORD ?? generatePassword();
  if (password.length < 12) {
    throw new Error('YTS_ADMIN_PASSWORD minimal 12 karakter.');
  }

  /**
   * Memakai adapter internal better-auth, BUKAN endpoint signUpEmail.
   *
   * Endpoint itu sengaja dimatikan lewat `disableSignUp` supaya tidak ada yang
   * bisa membuat akun sendiri lewat HTTP — dan penjagaan itu berlaku juga untuk
   * pemanggilan dari server, sebagaimana seharusnya. Yang tetap dipakai dari
   * pustaka adalah bagian yang penting: hashing kata sandi dan bentuk baris
   * `accounts`, sehingga tidak ada keputusan keamanan yang disalin ke sini.
   */
  const ctx = await getAuth().$context;

  const created = await ctx.internalAdapter.createUser(
    { name, email: email.toLowerCase(), emailVerified: false },
    { method: 'email-password' },
  );

  if (!created?.id) throw new Error('Pembuatan akun gagal tanpa pesan dari better-auth.');

  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: 'credential',
    // Bentuk `issuer` ditentukan better-auth, bukan kami. Dipanggil lewat
    // helper-nya sendiri supaya tetap benar bila formatnya berubah.
    issuer: createLocalAccountIssuer('credential'),
    accountId: created.id,
    password: await ctx.password.hash(password),
  });

  await assignRole(email, role, unitSlug, { quiet: true });

  console.log(`\n✓ Akun dibuat.`);
  console.log(`  Nama     : ${name}`);
  console.log(`  Email    : ${email.toLowerCase()}`);
  console.log(`  Peran    : ${role}${unitSlug ? ` @ ${unitSlug}` : ' (seluruh organisasi)'}`);
  if (!process.env.YTS_ADMIN_PASSWORD) {
    console.log(`\n  Kata sandi: ${password}`);
    console.log('  Tampil sekali ini saja. Sampaikan lewat kanal aman, lalu minta diganti.');
  }
}

async function assignRole(
  email: string,
  role: string,
  unitSlug?: string,
  options: { quiet?: boolean } = {},
) {
  if (!ROLES.includes(role as Role)) {
    throw new Error(`Peran tidak dikenal: ${role}. Pilih salah satu dari ${ROLES.join(', ')}.`);
  }

  const user = await findUser(email);
  if (!user) throw new Error(`Tidak ada akun dengan email ${email}.`);

  let unitId: string | null = null;
  if (unitSlug) {
    const [unit] = await db
      .select({ id: units.id })
      .from(units)
      .where(eq(units.slug, unitSlug))
      .limit(1);
    if (!unit) throw new Error(`Tidak ada unit dengan slug ${unitSlug}.`);
    unitId = unit.id;
  }

  const existing = await db
    .select({ id: userUnitRoles.id })
    .from(userUnitRoles)
    .where(
      and(
        eq(userUnitRoles.userId, user.id),
        unitId === null ? isNull(userUnitRoles.unitId) : eq(userUnitRoles.unitId, unitId),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(userUnitRoles)
      .set({ role: role as Role })
      .where(eq(userUnitRoles.id, existing[0]!.id));
  } else {
    await db.insert(userUnitRoles).values({ userId: user.id, unitId, role: role as Role });
  }

  if (!options.quiet) {
    console.log(
      `✓ ${email} kini ${role}${unitSlug ? ` di unit ${unitSlug}` : ' untuk seluruh organisasi'}.`,
    );
  }
}

async function resetPassword(email: string) {
  const user = await findUser(email);
  if (!user) throw new Error(`Tidak ada akun dengan email ${email}.`);

  const password = process.env.YTS_ADMIN_PASSWORD ?? generatePassword();
  const auth = getAuth();

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  await ctx.internalAdapter.updatePassword(user.id, hash);

  // Kata sandi lama tidak boleh tetap membuka pintu lewat sesi yang sudah ada.
  const revoked = await revokeSessionsFor(user.id);

  console.log(`✓ Kata sandi ${email} disetel ulang. ${revoked} sesi diakhiri.`);
  if (!process.env.YTS_ADMIN_PASSWORD) {
    console.log(`\n  Kata sandi baru: ${password}`);
    console.log('  Tampil sekali ini saja.');
  }
}

async function setActive(email: string, isActive: boolean) {
  const user = await findUser(email);
  if (!user) throw new Error(`Tidak ada akun dengan email ${email}.`);

  await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, user.id));
  const revoked = isActive ? 0 : await revokeSessionsFor(user.id);

  console.log(
    isActive
      ? `✓ ${email} diaktifkan kembali.`
      : `✓ ${email} dinonaktifkan. ${revoked} sesi diakhiri. Barisnya tidak dihapus agar audit log tetap utuh.`,
  );
}

async function list() {
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      isActive: users.isActive,
      role: userUnitRoles.role,
      unit: units.slug,
    })
    .from(users)
    .leftJoin(userUnitRoles, eq(userUnitRoles.userId, users.id))
    .leftJoin(units, eq(userUnitRoles.unitId, units.id))
    .orderBy(users.email);

  if (rows.length === 0) {
    console.log('Belum ada akun. Buat yang pertama dengan:');
    console.log('  npm run admin:user -- create "Nama" email@yts.or.id admin');
    return;
  }

  console.table(
    rows.map((row) => ({
      email: row.email,
      nama: row.name,
      aktif: row.isActive ? 'ya' : 'TIDAK',
      peran: row.role ?? '(belum ada)',
      unit: row.unit ?? (row.role ? 'seluruh organisasi' : ''),
    })),
  );
}

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case 'create': {
      const [name, email, role, unitSlug] = args;
      if (!name || !email || !role) {
        throw new Error('Pakai: create "Nama" email@yts.or.id <peran> [slug-unit]');
      }
      await create(name, email, role, unitSlug);
      break;
    }
    case 'role': {
      const [email, role, unitSlug] = args;
      if (!email || !role) throw new Error('Pakai: role email@yts.or.id <peran> [slug-unit]');
      await assignRole(email, role, unitSlug);
      break;
    }
    case 'password': {
      const [email] = args;
      if (!email) throw new Error('Pakai: password email@yts.or.id');
      await resetPassword(email);
      break;
    }
    case 'disable': {
      const [email] = args;
      if (!email) throw new Error('Pakai: disable email@yts.or.id');
      await setActive(email, false);
      break;
    }
    case 'enable': {
      const [email] = args;
      if (!email) throw new Error('Pakai: enable email@yts.or.id');
      await setActive(email, true);
      break;
    }
    case 'list':
      await list();
      break;
    default:
      console.log(
        [
          'Perintah:',
          '  create "Nama" <email> <peran> [slug-unit]  membuat akun + peran',
          '  role <email> <peran> [slug-unit]           menetapkan peran',
          '  password <email>                           menyetel ulang kata sandi',
          '  disable <email> / enable <email>           menonaktifkan / mengaktifkan',
          '  list                                       daftar akun & perannya',
          '',
          `Peran: ${ROLES.join(', ')}. Tanpa slug-unit, peran berlaku seluruh organisasi.`,
        ].join('\n'),
      );
  }
  process.exit(0);
} catch (error) {
  console.error(`\n✗ ${(error as Error).message}`);
  process.exit(1);
}

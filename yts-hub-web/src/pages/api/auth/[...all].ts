/**
 * Endpoint better-auth (masuk, keluar, sesi).
 *
 * Seluruh jalur di bawah /api/auth ditangani pustaka; tidak ada logika kami di
 * sini. Menambahkan apa pun ke berkas ini hampir selalu pertanda bahwa yang
 * dibutuhkan sebenarnya adalah pemeriksaan izin — dan tempatnya di
 * src/server/auth/roles.ts, bukan di lapisan autentikasi.
 */
import type { APIRoute } from 'astro';

import { getAuth } from '@/server/auth/auth';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => getAuth().handler(request);

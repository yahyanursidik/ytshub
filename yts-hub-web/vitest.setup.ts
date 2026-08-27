/**
 * Memuat .env sebelum test berjalan, supaya DATABASE_URL_TEST tersedia.
 * Test integrasi otomatis di-skip bila variabel itu kosong.
 */
import 'dotenv/config';

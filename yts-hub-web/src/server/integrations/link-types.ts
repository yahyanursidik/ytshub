/**
 * Tipe bersama untuk pemantauan tautan.
 *
 * Dipisahkan agar `link-status.ts` — yang sengaja tidak menyentuh database
 * maupun jaringan — tidak perlu mengimpor skema Drizzle hanya untuk satu tipe.
 */

/** Empat status di 08-INTEGRATION-AND-ROUTING.md §6. */
export type LinkStatus = 'healthy' | 'redirected' | 'warning' | 'broken';

/** Entity yang bisa memiliki URL publik. */
export type LinkEntity = 'unit' | 'service' | 'program' | 'event' | 'application';

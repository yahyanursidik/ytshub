/**
 * Test aturan otorisasi dan lifecycle.
 *
 * File ini menjaga tiga hal yang kalau bocor tidak terlihat sebagai error
 * melainkan sebagai "kok bisa?":
 * 1. peran di satu unit tidak boleh berlaku di unit lain;
 * 2. status tidak boleh melompati langkah di 06-CONTENT-MODEL §9;
 * 3. transisi yang sah tidak boleh dijalankan oleh peran yang tidak berwenang.
 */
import { describe, expect, it } from 'vitest';

import {
  actionForTransition,
  can,
  canTransition,
  isReviewOverdue,
  isValidTransition,
  nextReviewDate,
  roleFor,
  transitionsFrom,
  type Actor,
  type ContentStatus,
} from './roles';

const UNIT_A = '11111111-1111-1111-1111-111111111111';
const UNIT_B = '22222222-2222-2222-2222-222222222222';

const actor = (assignments: Actor['assignments']): Actor => ({
  id: 'u1',
  name: 'Uji',
  email: 'uji@example.org',
  assignments,
});

const editorA = actor([{ unitId: UNIT_A, role: 'editor' }]);
const approverA = actor([{ unitId: UNIT_A, role: 'approver' }]);
const orgAdmin = actor([{ unitId: null, role: 'admin' }]);
const nobody = actor([]);

describe('roleFor', () => {
  it('memberi peran hanya pada unit yang ditugaskan', () => {
    expect(roleFor(editorA, UNIT_A)).toBe('editor');
    expect(roleFor(editorA, UNIT_B)).toBeNull();
  });

  it('penugasan organisasi berlaku di semua unit', () => {
    expect(roleFor(orgAdmin, UNIT_A)).toBe('admin');
    expect(roleFor(orgAdmin, UNIT_B)).toBe('admin');
    expect(roleFor(orgAdmin, null)).toBe('admin');
  });

  it('mengambil peran tertinggi bila seseorang punya beberapa penugasan', () => {
    const ganda = actor([
      { unitId: UNIT_A, role: 'editor' },
      { unitId: UNIT_A, role: 'approver' },
    ]);
    expect(roleFor(ganda, UNIT_A)).toBe('approver');
  });

  it('penugasan unit lain tidak terbawa ke unit yang diminta', () => {
    const campuran = actor([
      { unitId: UNIT_A, role: 'admin' },
      { unitId: UNIT_B, role: 'viewer' },
    ]);
    expect(roleFor(campuran, UNIT_B)).toBe('viewer');
  });

  it('konten tanpa unit hanya tunduk pada penugasan organisasi', () => {
    expect(roleFor(editorA, null)).toBeNull();
    expect(roleFor(orgAdmin, null)).toBe('admin');
  });
});

describe('can', () => {
  it('menolak orang tanpa peran apa pun, dengan alasan yang bisa ditampilkan', () => {
    const hasil = can(nobody, 'read', UNIT_A);
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toBeTruthy();
  });

  it('editor boleh menyunting dan mengirim, tidak boleh menyetujui', () => {
    expect(can(editorA, 'update', UNIT_A).allowed).toBe(true);
    expect(can(editorA, 'submit', UNIT_A).allowed).toBe(true);
    expect(can(editorA, 'approve', UNIT_A).allowed).toBe(false);
    expect(can(editorA, 'publish', UNIT_A).allowed).toBe(false);
  });

  it('approver mewarisi kewenangan editor', () => {
    expect(can(approverA, 'update', UNIT_A).allowed).toBe(true);
    expect(can(approverA, 'publish', UNIT_A).allowed).toBe(true);
  });

  it('memulihkan arsip dan mengelola pengguna hanya untuk admin', () => {
    expect(can(approverA, 'restore', UNIT_A).allowed).toBe(false);
    expect(can(approverA, 'manage_users', null).allowed).toBe(false);
    expect(can(orgAdmin, 'restore', UNIT_A).allowed).toBe(true);
    expect(can(orgAdmin, 'manage_users', null).allowed).toBe(true);
  });

  /** Inti otorisasi YTS Hub: peran dilingkupi unit, bukan global. */
  it('kewenangan di satu unit tidak berlaku di unit lain', () => {
    expect(can(approverA, 'publish', UNIT_A).allowed).toBe(true);
    expect(can(approverA, 'publish', UNIT_B).allowed).toBe(false);
    expect(can(approverA, 'read', UNIT_B).allowed).toBe(false);
  });
});

describe('transisi lifecycle', () => {
  it('mengikuti urutan di 06-CONTENT-MODEL §9', () => {
    expect(isValidTransition('draft', 'in_review')).toBe(true);
    expect(isValidTransition('in_review', 'approved')).toBe(true);
    expect(isValidTransition('approved', 'published')).toBe(true);
    expect(isValidTransition('published', 'archived')).toBe(true);
  });

  it('tidak bisa melompati tinjauan dan persetujuan', () => {
    expect(isValidTransition('draft', 'published')).toBe(false);
    expect(isValidTransition('draft', 'approved')).toBe(false);
    expect(isValidTransition('in_review', 'published')).toBe(false);
  });

  it('konten terbit tidak bisa mundur langsung ke draft', () => {
    // Jalannya lewat arsip atau needs_review; menurunkannya diam-diam akan
    // menghilangkan halaman publik tanpa jejak keputusan.
    expect(isValidTransition('published', 'draft')).toBe(false);
  });

  it('status tidak bisa berpindah ke dirinya sendiri', () => {
    const semua: ContentStatus[] = [
      'draft',
      'in_review',
      'approved',
      'published',
      'needs_review',
      'archived',
    ];
    for (const status of semua) expect(isValidTransition(status, status)).toBe(false);
  });

  it('setiap transisi punya tindakan yang menamainya', () => {
    expect(actionForTransition('draft', 'in_review')).toBe('submit');
    expect(actionForTransition('approved', 'published')).toBe('publish');
    expect(actionForTransition('draft', 'published')).toBeNull();
  });

  it('menawarkan alasan wajib untuk tindakan yang membatalkan pekerjaan', () => {
    const dariReview = transitionsFrom('in_review');
    expect(dariReview.find((t) => t.action === 'reject')?.requiresReason).toBe(true);
    expect(dariReview.find((t) => t.action === 'approve')?.requiresReason).toBe(false);

    const dariTerbit = transitionsFrom('published');
    expect(dariTerbit.find((t) => t.action === 'archive')?.requiresReason).toBe(true);
  });

  it('arsip hanya bisa dipulihkan, tidak bisa langsung terbit lagi', () => {
    expect(transitionsFrom('archived').map((t) => t.to)).toEqual(['draft']);
  });
});

describe('canTransition', () => {
  it('menolak perpindahan yang sah bila pelakunya tidak berwenang', () => {
    // Perpindahannya benar menurut §9, orangnya yang tidak boleh.
    expect(isValidTransition('in_review', 'approved')).toBe(true);
    expect(canTransition(editorA, 'in_review', 'approved', UNIT_A).allowed).toBe(false);
  });

  it('menolak perpindahan yang tidak sah meski pelakunya admin', () => {
    const hasil = canTransition(orgAdmin, 'draft', 'published', UNIT_A);
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('tidak diizinkan');
  });

  it('mengizinkan bila perpindahan sah dan pelakunya berwenang', () => {
    expect(canTransition(editorA, 'draft', 'in_review', UNIT_A).allowed).toBe(true);
    expect(canTransition(approverA, 'approved', 'published', UNIT_A).allowed).toBe(true);
  });

  it('approver unit lain tidak bisa menerbitkan konten unit ini', () => {
    expect(canTransition(approverA, 'approved', 'published', UNIT_B).allowed).toBe(false);
  });
});

describe('jadwal tinjauan', () => {
  it('memakai batas bawah rentang di 06-CONTENT-MODEL §11', () => {
    const terbit = new Date('2026-01-01T00:00:00.000Z');
    expect(nextReviewDate('program', terbit).toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(nextReviewDate('service', terbit).toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(nextReviewDate('unit', terbit).toISOString()).toBe('2026-06-30T00:00:00.000Z');
  });

  it('entity yang tidak terdaftar tetap mendapat jadwal, bukan tidak sama sekali', () => {
    const terbit = new Date('2026-01-01T00:00:00.000Z');
    expect(nextReviewDate('entah-apa', terbit).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('hanya konten terbit yang bisa jatuh tempo', () => {
    const kemarin = new Date('2026-01-01T00:00:00.000Z');
    const sekarang = new Date('2026-06-01T00:00:00.000Z');
    expect(isReviewOverdue('published', kemarin, sekarang)).toBe(true);
    expect(isReviewOverdue('draft', kemarin, sekarang)).toBe(false);
    expect(isReviewOverdue('archived', kemarin, sekarang)).toBe(false);
  });

  it('konten tanpa tanggal tinjauan tidak dianggap jatuh tempo', () => {
    expect(isReviewOverdue('published', null)).toBe(false);
  });

  it('belum jatuh tempo bila tanggalnya masih di depan', () => {
    const besok = new Date('2026-12-01T00:00:00.000Z');
    const sekarang = new Date('2026-06-01T00:00:00.000Z');
    expect(isReviewOverdue('published', besok, sekarang)).toBe(false);
  });
});

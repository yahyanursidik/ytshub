/**
 * Menerjemahkan hasil satu permintaan HTTP menjadi status tautan.
 *
 * Dipisah dari pemeriksanya dan TIDAK menyentuh jaringan, karena di sinilah
 * penilaiannya berada — dan penilaian yang salah di sini menghasilkan dua
 * kegagalan yang sama-sama buruk: peringatan palsu yang membuat admin berhenti
 * membaca peringatan, atau tautan mati yang dibiarkan karena dianggap sehat.
 *
 * Empat status dari 08-INTEGRATION-AND-ROUTING.md §6.
 */
import type { LinkStatus } from '@/server/integrations/link-types';

/**
 * Berapa kali gagal berturut-turut sebelum sebuah tautan dinyatakan rusak.
 *
 * Tiga, bukan satu. Server yang sedang di-deploy, jaringan yang tersendat, dan
 * pembatasan laju semuanya menghasilkan kegagalan sesaat. Dengan pemeriksaan
 * harian, tiga kali berarti tautan sudah bermasalah tiga hari berturut-turut —
 * cukup lama untuk yakin, cukup cepat untuk masih berguna.
 */
export const FAILURES_BEFORE_BROKEN = 3;

export interface ProbeResult {
  /** Kode HTTP terakhir, atau null bila permintaannya tidak pernah sampai. */
  httpStatus: number | null;
  /** URL final setelah mengikuti redirect. */
  finalUrl: string | null;
  /** Pesan kesalahan jaringan, bila ada. */
  error: string | null;
}

export interface Verdict {
  status: LinkStatus;
  /** true bila hasil ini dihitung sebagai kegagalan berturut-turut. */
  isFailure: boolean;
  /** Penjelasan singkat untuk ditampilkan ke admin. */
  note: string;
}

/**
 * Membandingkan dua URL untuk menentukan apakah terjadi pengalihan yang berarti.
 *
 * Perbedaan yang TIDAK dianggap pengalihan: garis miring di akhir, `http` yang
 * naik ke `https`, dan `www.` yang muncul atau hilang. Ketiganya normalisasi
 * biasa yang dilakukan hampir setiap server, dan melaporkannya sebagai
 * "redirected" akan menandai seluruh registry sekaligus tanpa satu pun yang
 * perlu ditindaklanjuti.
 */
export function isMeaningfulRedirect(from: string, to: string): boolean {
  const normalize = (value: string) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return value;
    }
    const host = parsed.host.replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/$/, '');
    // Protokol sengaja dibuang: naik ke https adalah perbaikan, bukan pindah.
    return `${host}${path}${parsed.search}`;
  };

  return normalize(from) !== normalize(to);
}

/**
 * Menentukan status dari hasil permintaan.
 *
 * @param previousFailures kegagalan berturut-turut SEBELUM percobaan ini
 */
export function classify(
  url: string,
  result: ProbeResult,
  previousFailures: number,
): Verdict {
  const { httpStatus, finalUrl, error } = result;

  // Permintaan tidak pernah sampai: DNS gagal, koneksi ditolak, atau waktu habis.
  if (httpStatus === null) {
    const failures = previousFailures + 1;
    return {
      status: failures >= FAILURES_BEFORE_BROKEN ? 'broken' : 'warning',
      isFailure: true,
      note: error ?? 'Tidak ada jawaban dari server.',
    };
  }

  // 404 dan 410 adalah jawaban PASTI: server menjawab, dan jawabannya adalah
  // "tidak ada". Tidak perlu menunggu tiga kali untuk memercayainya.
  if (httpStatus === 404 || httpStatus === 410) {
    return {
      status: 'broken',
      isFailure: true,
      note: `Halaman tidak ditemukan (${httpStatus}).`,
    };
  }

  // 401/403: server ada dan menjawab, aksesnya yang dibatasi. Bisa jadi memang
  // begitu (portal yang menuntut masuk), jadi ini catatan untuk diperiksa
  // manusia — bukan tautan yang otomatis dinyatakan rusak.
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      status: 'warning',
      isFailure: false,
      note: `Akses dibatasi (${httpStatus}). Periksa apakah tautan ini memang menuntut masuk.`,
    };
  }

  // 429: kita yang diminta melambat. Bukan kesalahan pemilik tautan, dan
  // menghitungnya sebagai kegagalan akan menyalahkan sistem yang sehat.
  if (httpStatus === 429) {
    return {
      status: 'warning',
      isFailure: false,
      note: 'Pemeriksaan dibatasi laju oleh server tujuan (429).',
    };
  }

  if (httpStatus >= 500) {
    const failures = previousFailures + 1;
    return {
      status: failures >= FAILURES_BEFORE_BROKEN ? 'broken' : 'warning',
      isFailure: true,
      note: `Server tujuan bermasalah (${httpStatus}).`,
    };
  }

  if (httpStatus >= 400) {
    return {
      status: 'warning',
      isFailure: false,
      note: `Jawaban tak terduga (${httpStatus}).`,
    };
  }

  // 2xx — dan mungkin sampai di sini lewat pengalihan.
  if (finalUrl && isMeaningfulRedirect(url, finalUrl)) {
    return {
      status: 'redirected',
      isFailure: false,
      note: `Dialihkan ke ${finalUrl}. Perbarui tautannya agar pengguna tidak melewati satu lompatan.`,
    };
  }

  return { status: 'healthy', isFailure: false, note: `Sehat (${httpStatus}).` };
}

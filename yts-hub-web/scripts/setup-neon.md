# Menyiapkan Neon — jalankan dari laptop Anda

Sesi Claude berjalan di sandbox yang memblokir host Neon, jadi tiga perintah
berikut perlu dijalankan dari komputer Anda sendiri.

```bash
cd yts-hub-web
npm install

# .env sudah berisi DATABASE_URL Neon. Pastikan koneksinya hidup:
npm run db:check

# Buat seluruh tabel di Neon:
npm run db:migrate

# Isi data pengembangan (bertanda DEV-, bukan data resmi YTS):
npm run db:seed

# Lihat hasilnya:
npm run dev
```

`db:check` menampilkan driver yang dipakai, versi server, dan jumlah tabel —
dengan password disamarkan, jadi aman di-screenshot.

## Bila db:check gagal

| Pesan                        | Artinya                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `Host not in allowlist`      | Jaringan memblokir `api.<region>.aws.neon.tech` (HTTPS/443) |
| `ETIMEDOUT` / `ECONNREFUSED` | Host `ep-*.<region>.aws.neon.tech` tidak terjangkau         |
| `DATABASE_URL belum diisi`   | `.env` belum ada atau variabelnya kosong                    |

## Setelah berhasil

1. **Reset password `neondb_owner` di dashboard Neon.** Connection string yang
   dipakai sekarang pernah dikirim lewat chat, jadi anggap sudah bocor.
2. Simpan password baru di `.env` lokal dan di Netlify → Site settings →
   Environment variables. Jangan pernah menaruhnya di file yang ikut ter-commit.
3. Untuk test integrasi, buat **branch Neon khusus test** lalu isi
   `DATABASE_URL_TEST` dengan connection string branch itu. Isi database test
   dihapus setiap kali test berjalan — jangan arahkan ke database utama.

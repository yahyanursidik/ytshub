ALTER TABLE "contacts" ADD COLUMN "code" text;--> statement-breakpoint
-- DITAMBAHKAN MANUAL — backfill, tidak bisa dihasilkan drizzle-kit.
--
-- Sebelum kolom ini ada, kontak seed dihapus lewat unit pemiliknya yang berkode
-- `DEV-`. Sejak unit menjadi data resmi berkode `YTS-`, cara itu tidak lagi
-- menemukan apa pun: kontak lama tertinggal tanpa penanda, dan penghapusan unit
-- DEV gagal karena masih ada kontak yang menunjuk ke sana.
--
-- Yang ditandai HANYA baris yang jelas-jelas berasal dari seed: nilainya kosong
-- DAN catatannya masih PLACEHOLDER. Kontak yang dimasukkan pengelola lewat admin
-- punya nilai sungguhan, jadi tidak pernah tersentuh pernyataan ini — penting,
-- karena baris bertanda DEV- akan dihapus `db:seed:clear`.
UPDATE "contacts"
   SET "code" = 'DEV-CONTACT-LEGACY'
 WHERE "code" IS NULL
   AND "value" IS NULL
   AND "note" = 'PLACEHOLDER — menunggu data resmi unit';

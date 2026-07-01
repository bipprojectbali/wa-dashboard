-- AlterTable: idempoten (IF NOT EXISTS) + semua kolom nullable/defaulted → aman di tabel berisi data.
-- Idempotency guard balasan WA per request.
ALTER TABLE "verify_request" ADD COLUMN IF NOT EXISTS "replySentAt" TIMESTAMP(3);

-- Balasan otomatis WAV: switch (default MATI) + teks kustom opsional (null = default di kode).
ALTER TABLE "wa_policy" ADD COLUMN IF NOT EXISTS "verifyReplyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "wa_policy" ADD COLUMN IF NOT EXISTS "verifyReplyMessage" TEXT;

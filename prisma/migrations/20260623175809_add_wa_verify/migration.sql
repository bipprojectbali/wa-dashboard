-- CreateEnum (idempotent: Postgres tidak punya CREATE TYPE IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE "VerifyStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "VerifyDelivery" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "verify_consumer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyPrefix" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verify_consumer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "verify_request" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expectedPhone" TEXT,
    "status" "VerifyStatus" NOT NULL DEFAULT 'PENDING',
    "matchedPhone" TEXT,
    "matchedMessageId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "deliveryStatus" "VerifyDelivery" NOT NULL DEFAULT 'PENDING',
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastDeliveryError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verify_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "verify_inbound_log" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromMasked" TEXT NOT NULL,
    "tokenFound" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "consumerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verify_inbound_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "verify_consumer_apiKeyHash_key" ON "verify_consumer"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "verify_request_token_key" ON "verify_request"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "verify_request_consumerId_idx" ON "verify_request"("consumerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "verify_request_token_idx" ON "verify_request"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "verify_request_status_expiresAt_idx" ON "verify_request"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "verify_inbound_log_createdAt_idx" ON "verify_inbound_log"("createdAt");

-- AddForeignKey (idempotent guard)
DO $$ BEGIN
  ALTER TABLE "verify_request" ADD CONSTRAINT "verify_request_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "verify_consumer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

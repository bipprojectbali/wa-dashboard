-- CreateTable
CREATE TABLE IF NOT EXISTS "wa_policy" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "allowFirstContact" BOOLEAN NOT NULL DEFAULT false,
    "maxPerMinute" INTEGER NOT NULL DEFAULT 3,
    "maxPerHour" INTEGER NOT NULL DEFAULT 20,
    "maxPerDay" INTEGER NOT NULL DEFAULT 100,
    "minIntervalSeconds" INTEGER NOT NULL DEFAULT 8,
    "perRecipientCooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "requireAck" BOOLEAN NOT NULL DEFAULT true,
    "contractVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "wa_policy_pkey" PRIMARY KEY ("id")
);

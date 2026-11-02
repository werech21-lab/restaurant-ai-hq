-- Server-to-inbox SMTP credentials for exclusive radar operational reports.
-- Stored in NotificationSetting so Ops can activate without redeploying.

ALTER TABLE "NotificationSetting"
  ADD COLUMN IF NOT EXISTS "smtpHost" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
  ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER NOT NULL DEFAULT 465,
  ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "smtpUser" TEXT NOT NULL DEFAULT 'sec@venturefoodskw.com',
  ADD COLUMN IF NOT EXISTS "smtpPass" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "smtpFrom" TEXT NOT NULL DEFAULT 'sec@venturefoodskw.com',
  ADD COLUMN IF NOT EXISTS "smtpEnabled" BOOLEAN NOT NULL DEFAULT false;

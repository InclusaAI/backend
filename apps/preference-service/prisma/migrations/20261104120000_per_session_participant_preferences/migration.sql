-- The original init migration predates commit f7bcbe8 ("preferences are per
-- session participant"): it created a per-user table with captionsEnabled /
-- avatarEnabled, while schema.prisma and the application now use per-session,
-- per-participant rows with a channels[] enum.
--
-- Rewriting an already-versioned migration would break any database that
-- applied it, so this migration corrects the table in place. It is safe on a
-- fresh database (the init migration creates the old table first) and on one
-- where the old migration already ran.

-- CreateEnum (guard against databases that were already `db push`ed)
DO $$ BEGIN
    CREATE TYPE "AccessibilityChannel" AS ENUM ('CAPTIONS', 'AVATAR', 'GESTURES', 'TRANSLATION', 'TTS');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- DropTable
-- Pre-release schema only; the old table's rows cannot be mapped to a
-- (sessionId, participantId) pair, so there is nothing to preserve.
DROP TABLE IF EXISTS "accessibility_preferences";

-- CreateTable
CREATE TABLE "accessibility_preferences" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "channels" "AccessibilityChannel"[],
    "captionLanguage" TEXT,
    "translationTargetLanguage" TEXT,
    "signLanguage" TEXT NOT NULL DEFAULT 'ASL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessibility_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accessibility_preferences_sessionId_participantId_key" ON "accessibility_preferences"("sessionId", "participantId");

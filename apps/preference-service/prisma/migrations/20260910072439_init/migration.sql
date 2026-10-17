-- CreateTable
CREATE TABLE "accessibility_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "avatarEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessibility_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accessibility_preferences_userId_key" ON "accessibility_preferences"("userId");

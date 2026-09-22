-- CreateEnum
CREATE TYPE "CommunicationMode" AS ENUM ('SPEECH', 'SIGN_LANGUAGE', 'HYBRID');

-- CreateTable
CREATE TABLE "presentations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slideMetadata" JSONB NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communicationMode" "CommunicationMode" NOT NULL,
    "joinCode" TEXT,
    "qrPayload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT,
    "captionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "avatarEnabled" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "join_tokens" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "join_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presentations_organizationId_idx" ON "presentations"("organizationId");

-- CreateIndex
CREATE INDEX "presentations_ownerId_idx" ON "presentations"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_joinCode_key" ON "sessions"("joinCode");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "session_participants_userId_idx" ON "session_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_sessionId_userId_key" ON "session_participants"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "join_tokens_token_key" ON "join_tokens"("token");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "presentations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_tokens" ADD CONSTRAINT "join_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

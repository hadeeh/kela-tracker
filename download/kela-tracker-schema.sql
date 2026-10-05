-- ============================================
-- Kela Tracker — Database Schema
-- Run this in Neon's SQL Editor
-- ============================================

-- 1. Rooms table
CREATE TABLE IF NOT EXISTS "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- 2. Room members table
CREATE TABLE IF NOT EXISTS "RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePerKela" INTEGER NOT NULL DEFAULT 50,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- 3. Kela incidents table (votes/accusations)
CREATE TABLE IF NOT EXISTS "KelaIncident" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accusedById" TEXT NOT NULL,
    "reason" TEXT,
    "votesYes" INTEGER NOT NULL DEFAULT 0,
    "votesNo" INTEGER NOT NULL DEFAULT 0,
    "verdict" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KelaIncident_pkey" PRIMARY KEY ("id")
);

-- 4. Votes table (individual votes on an incident)
CREATE TABLE IF NOT EXISTS "Vote" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- 5. Custom sounds table (uploaded by Kela Minister)
CREATE TABLE IF NOT EXISTS "CustomSound" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "soundType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomSound_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- Indexes (for faster queries)
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "Room_code_key" ON "Room"("code");

CREATE INDEX IF NOT EXISTS "RoomMember_roomId_idx" ON "RoomMember"("roomId");
CREATE UNIQUE INDEX IF NOT EXISTS "RoomMember_roomId_email_key" ON "RoomMember"("roomId", "email");

CREATE INDEX IF NOT EXISTS "KelaIncident_roomId_idx" ON "KelaIncident"("roomId");
CREATE INDEX IF NOT EXISTS "KelaIncident_createdAt_idx" ON "KelaIncident"("createdAt");

CREATE INDEX IF NOT EXISTS "Vote_incidentId_idx" ON "Vote"("incidentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Vote_incidentId_voterId_key" ON "Vote"("incidentId", "voterId");

CREATE INDEX IF NOT EXISTS "CustomSound_roomId_idx" ON "CustomSound"("roomId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomSound_roomId_soundType_key" ON "CustomSound"("roomId", "soundType");

-- ============================================
-- Foreign keys (relationships between tables)
-- ============================================

ALTER TABLE "RoomMember"
    ADD CONSTRAINT "RoomMember_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE;

ALTER TABLE "KelaIncident"
    ADD CONSTRAINT "KelaIncident_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE;

ALTER TABLE "KelaIncident"
    ADD CONSTRAINT "KelaIncident_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "RoomMember"("id") ON DELETE CASCADE;

ALTER TABLE "KelaIncident"
    ADD CONSTRAINT "KelaIncident_accusedById_fkey"
    FOREIGN KEY ("accusedById") REFERENCES "RoomMember"("id") ON DELETE CASCADE;

ALTER TABLE "Vote"
    ADD CONSTRAINT "Vote_incidentId_fkey"
    FOREIGN KEY ("incidentId") REFERENCES "KelaIncident"("id") ON DELETE CASCADE;

ALTER TABLE "Vote"
    ADD CONSTRAINT "Vote_voterId_fkey"
    FOREIGN KEY ("voterId") REFERENCES "RoomMember"("id") ON DELETE CASCADE;

ALTER TABLE "CustomSound"
    ADD CONSTRAINT "CustomSound_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE;

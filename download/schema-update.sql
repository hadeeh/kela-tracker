-- ============================================
-- Kela Tracker — Complete Schema Update
-- Run this in Neon SQL Editor
-- ============================================

-- 1. Add 'status' column to RoomMember (for join approval system)
ALTER TABLE "RoomMember"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'approved';

-- 2. Add 'mugshotId' to KelaIncident (for Hall of Shame)
ALTER TABLE "KelaIncident"
  ADD COLUMN IF NOT EXISTS "mugshotId" TEXT;

-- 3. Create Mugshot table (for Hall of Shame photos)
CREATE TABLE IF NOT EXISTS "Mugshot" (
  id TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "incidentId" TEXT,
  data BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL,
  caption TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Mugshot_pkey" PRIMARY KEY (id)
);

-- 4. Add foreign key from Mugshot to Room
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Mugshot_roomId_fkey'
  ) THEN
    ALTER TABLE "Mugshot"
      ADD CONSTRAINT "Mugshot_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Add foreign key from KelaIncident to Mugshot (optional link)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'KelaIncident_mugshotId_fkey'
  ) THEN
    ALTER TABLE "KelaIncident"
      ADD CONSTRAINT "KelaIncident_mugshotId_fkey"
      FOREIGN KEY ("mugshotId") REFERENCES "Mugshot"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Create index on Mugshot.roomId
CREATE INDEX IF NOT EXISTS "Mugshot_roomId_idx" ON "Mugshot"("roomId");

-- 7. Verify all existing members have 'approved' status
UPDATE "RoomMember" SET "status" = 'approved' WHERE "status" IS NULL OR "status" = '';

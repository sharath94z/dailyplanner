DROP INDEX IF EXISTS "Routine_userId_isEnabled_idx";

ALTER TABLE "Routine"
DROP COLUMN "durationMinutes",
DROP COLUMN "rrule",
DROP COLUMN "preferredTimeWindow",
DROP COLUMN "isEnabled",
ADD COLUMN "startTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN "endTime" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Routine_userId_isActive_idx" ON "Routine"("userId", "isActive");

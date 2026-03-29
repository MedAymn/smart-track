-- Add Specs to phones table
ALTER TABLE phones ADD COLUMN IF NOT EXISTS "batteryHealth" TEXT NULL;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS "grade" TEXT NULL;

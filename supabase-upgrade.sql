-- Phase 3 Update: Allow storing return notes on phones
ALTER TABLE phones ADD COLUMN IF NOT EXISTS "returnReason" TEXT;

-- Drop the old status check constraint so we can save 'returned' as a status
ALTER TABLE phones DROP CONSTRAINT IF EXISTS phones_status_check;

-- Drop the constraint on the existing phoneId column since we no longer need it.
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_phoneId_fkey;

-- We want to add an array of UUIDs instead
-- First, add the new column allowing nulls while we migrate data
ALTER TABLE sales ADD COLUMN "phoneIds" UUID[] DEFAULT '{}';

-- Migrate existing data: for every row with a phoneId, put it into the new phoneIds array
UPDATE sales SET "phoneIds" = ARRAY["phoneId"] WHERE "phoneId" IS NOT NULL;

-- Make it required from now on
ALTER TABLE sales ALTER COLUMN "phoneIds" SET NOT NULL;

-- CRITICAL FIX: The old "phoneId" column must be allowed to be empty!
ALTER TABLE sales ALTER COLUMN "phoneId" DROP NOT NULL;

-- Finally drop the old column (optional but cleaner)
-- ONLY RUN THIS LINE IF YOU ARE SURE THE MIGRATION WORKED
-- ALTER TABLE sales DROP COLUMN "phoneId";

-- Phase 4 Update: Add selling price for expected sales profit estimation
ALTER TABLE phones ADD COLUMN IF NOT EXISTS "sellingPrice" DECIMAL;

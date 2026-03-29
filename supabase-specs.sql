-- Phone Specifications Update: Add Color and Storage Capacity columns
-- Run this SQL in your Supabase SQL Editor to add the new phone spec fields

ALTER TABLE phones ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS "storage" TEXT;

-- Add dueDate column to sales table for debt reminders
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMPTZ NULL;

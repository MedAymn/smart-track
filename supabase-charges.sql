-- ==========================================
-- PHASE 6 UPDATE: Charges & Expenses Tracking
-- ==========================================

-- Allow tracking specific categories for outgoing transactions (like Rent, Salaries, Electricity)
ALTER TABLE public.caisse_transactions ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'general';

-- Add return notes and status improvements if they were missed
ALTER TABLE public.phones ADD COLUMN IF NOT EXISTS "returnReason" TEXT;
ALTER TABLE public.phones ADD COLUMN IF NOT EXISTS "returnPrice" NUMERIC;
ALTER TABLE public.phones ADD COLUMN IF NOT EXISTS "returnDate" TIMESTAMPTZ;

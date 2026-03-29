-- ==========================================
-- PHASE 5 UPDATE: Caisse (Transactions)
-- ==========================================

-- Create Caisse (Treasury transactions) Table
CREATE TABLE IF NOT EXISTS public.caisse_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    amount NUMERIC NOT NULL,
    label TEXT NOT NULL,
    "transactionDate" TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Turn on RLS
ALTER TABLE public.caisse_transactions ENABLE ROW LEVEL SECURITY;

-- Allow public access (since no Auth is set up yet)
CREATE POLICY "Allow public access on caisse_transactions" ON public.caisse_transactions FOR ALL USING (true);

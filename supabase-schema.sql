-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.phones (
    id UUID PRIMARY KEY,
    model TEXT NOT NULL,
    imei TEXT,
    "purchasePrice" NUMERIC NOT NULL,
    "purchaseDate" TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('inventory', 'sold'))
);

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY,
    "phoneId" UUID NOT NULL REFERENCES public.phones(id) ON DELETE CASCADE,
    "customerName" TEXT NOT NULL,
    "salePrice" NUMERIC NOT NULL,
    "amountPaid" NUMERIC Default 0,
    "saleDate" TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid'))
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY,
    "saleId" UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    "paymentDate" TIMESTAMPTZ NOT NULL
);

-- Turn on Row Level Security (RLS) but allow anon access for now (since no Auth is set up yet)
-- Note: In a production app you should enforce authentication setup, but for this migration we'll allow anon read/write.
ALTER TABLE public.phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access on phones" ON public.phones FOR ALL USING (true);
CREATE POLICY "Allow public access on sales" ON public.sales FOR ALL USING (true);
CREATE POLICY "Allow public access on payments" ON public.payments FOR ALL USING (true);

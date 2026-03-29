-- ==========================================
-- PHASE 4 UPDATE: Fournisseurs & Clients
-- ==========================================

-- 1. Create Suppliers (Fournisseurs) Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Supplier Payments Table
-- This tracks money we send to suppliers
CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "supplierId" UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('cash', 'edahabia', 'bank_transfer')),
    "paymentDate" TIMESTAMPTZ NOT NULL,
    notes TEXT
);

-- Turn on RLS for new tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access on suppliers" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "Allow public access on clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow public access on supplier_payments" ON public.supplier_payments FOR ALL USING (true);

-- ==========================================
-- ALTER EXISTING TABLES
-- ==========================================

-- 4. Add supplierId to phones
ALTER TABLE public.phones ADD COLUMN IF NOT EXISTS "supplierId" UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 5. Add clientId to sales and migrate existing customerName data
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "clientId" UUID REFERENCES public.clients(id) ON DELETE RESTRICT;

-- Auto-migrate existing customer names to actual client records
-- We use a DO block to avoid duplicate client creations if run multiple times
DO $$
DECLARE
    r RECORD;
    new_client_id UUID;
BEGIN
    FOR r IN SELECT DISTINCT "customerName" FROM public.sales WHERE "customerName" IS NOT NULL AND "clientId" IS NULL
    LOOP
        -- Insert a new client
        INSERT INTO public.clients (name) VALUES (r."customerName") RETURNING id INTO new_client_id;
        
        -- Update all sales with this customerName to point to the new clientId
        UPDATE public.sales SET "clientId" = new_client_id WHERE "customerName" = r."customerName";
    END LOOP;
END $$;

-- Drop the old customerName column completely 
-- (You can comment this out if you're worried about data loss, but we migrated it to clients table)
ALTER TABLE public.sales DROP COLUMN IF NOT EXISTS "customerName";

-- 6. Add payment method to payments table (for client versements)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'edahabia', 'bank_transfer'));

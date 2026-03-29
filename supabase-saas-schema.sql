-- ==========================================
-- SAAS MULTI-TENANT SCHEMA setup for Supabase
-- ==========================================

-- 1. Create a `stores` table to represent each tenant/shop
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create `profiles` to map users to their stores (useful for staff later)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff'))
);

-- Helper function to get current user's store_id
CREATE OR REPLACE FUNCTION get_user_store_id() RETURNS UUID AS $$
    SELECT store_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Create tables with `store_id` for tenant data isolation

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL DEFAULT get_user_store_id() REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL DEFAULT get_user_store_id() REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL DEFAULT get_user_store_id() REFERENCES public.stores(id) ON DELETE CASCADE,
    "supplierId" UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('cash', 'edahabia', 'bank_transfer')),
    "paymentDate" TIMESTAMPTZ NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS public.phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL DEFAULT get_user_store_id() REFERENCES public.stores(id) ON DELETE CASCADE,
    "supplierId" UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    imei TEXT,
    "purchasePrice" NUMERIC NOT NULL,
    "purchaseDate" TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('inventory', 'sold')),
    grade TEXT,
    "batteryHealth" INTEGER,
    storage TEXT,
    color TEXT,
    "returnPrice" NUMERIC,
    "returnReason" TEXT,
    "returnDate" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL DEFAULT get_user_store_id() REFERENCES public.stores(id) ON DELETE CASCADE,
    "phoneIds" UUID[],
    "clientId" UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    "salePrice" NUMERIC NOT NULL,
    "amountPaid" NUMERIC Default 0,
    "saleDate" TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid'))
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL DEFAULT get_user_store_id() REFERENCES public.stores(id) ON DELETE CASCADE,
    "saleId" UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    "paymentDate" TIMESTAMPTZ NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'edahabia', 'bank_transfer'))
);

CREATE TABLE IF NOT EXISTS public.caisse_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL DEFAULT get_user_store_id() REFERENCES public.stores(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    amount NUMERIC NOT NULL,
    label TEXT NOT NULL,
    "transactionDate" TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures each store can only access its own data
-- ==========================================

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_transactions ENABLE ROW LEVEL SECURITY;

-- Stores & Profiles Policies
CREATE POLICY "Users can view their own store" ON public.stores FOR SELECT USING (id = get_user_store_id() OR owner_id = auth.uid());
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Tenant Data Policies (CRUD using store_id)
-- Note: 'get_user_store_id()' evaluates to the current user's store_id when the query is run
CREATE POLICY "Tenant access on suppliers" ON public.suppliers FOR ALL USING (store_id = get_user_store_id());
CREATE POLICY "Tenant access on clients" ON public.clients FOR ALL USING (store_id = get_user_store_id());
CREATE POLICY "Tenant access on supplier_payments" ON public.supplier_payments FOR ALL USING (store_id = get_user_store_id());
CREATE POLICY "Tenant access on phones" ON public.phones FOR ALL USING (store_id = get_user_store_id());
CREATE POLICY "Tenant access on sales" ON public.sales FOR ALL USING (store_id = get_user_store_id());
CREATE POLICY "Tenant access on payments" ON public.payments FOR ALL USING (store_id = get_user_store_id());
CREATE POLICY "Tenant access on caisse_transactions" ON public.caisse_transactions FOR ALL USING (store_id = get_user_store_id());

-- ==========================================
-- TRIGGERS TO AUTO-CREATE STORE ON USER SIGN UP
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user_store() 
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
BEGIN
    -- Create a new store for the user
    INSERT INTO public.stores (owner_id, name)
    VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'store_name', 'My Store'))
    RETURNING id INTO new_store_id;

    -- Create profile linked to the new store
    INSERT INTO public.profiles (id, store_id, full_name, role)
    VALUES (NEW.id, new_store_id, coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), 'admin');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function every time a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_store();

-- 7. Create `audit_logs` to track employee actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL DEFAULT get_user_store_id() REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

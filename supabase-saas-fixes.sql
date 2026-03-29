-- ==========================================
-- SAAS MULTI-TENANT SCHEMA FIXES & RBAC
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Fix missing columns in `phones`
ALTER TABLE public.phones ADD COLUMN IF NOT EXISTS "sellingPrice" NUMERIC;

-- Convert batteryHealth to TEXT if it was INTEGER, to support "100%"
ALTER TABLE public.phones ALTER COLUMN "batteryHealth" TYPE TEXT USING "batteryHealth"::TEXT;

-- 2. Fix missing columns in `sales`
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "customerName" TEXT;

-- 3. Fix missing categories in `caisse_transactions`
ALTER TABLE public.caisse_transactions ADD COLUMN IF NOT EXISTS "category" TEXT;

-- 4. Update the handle_new_user_store trigger to support Worker / Staff Join Codes
CREATE OR REPLACE FUNCTION public.handle_new_user_store() 
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
BEGIN
    -- Check if the user is trying to join an existing store using a join code metadata
    IF NEW.raw_user_meta_data->>'join_store_id' IS NOT NULL AND NEW.raw_user_meta_data->>'join_store_id' != '' THEN
        -- Joining an existing store as staff
        INSERT INTO public.profiles (id, store_id, full_name, role)
        VALUES (
            NEW.id, 
            (NEW.raw_user_meta_data->>'join_store_id')::UUID, 
            coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), 
            'staff'
        );
    ELSE
        -- Create a new store for the user
        INSERT INTO public.stores (owner_id, name)
        VALUES (
            NEW.id, 
            coalesce(NEW.raw_user_meta_data->>'store_name', 'My Store')
        )
        RETURNING id INTO new_store_id;

        -- Create profile linked to the new store
        INSERT INTO public.profiles (id, store_id, full_name, role)
        VALUES (
            NEW.id, 
            new_store_id, 
            coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), 
            'admin'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix RLS on `audit_logs` (was missing — any user could read all stores' logs)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow users to see/insert logs that belong to their own store
CREATE POLICY "Tenant access on audit_logs"
    ON public.audit_logs
    FOR ALL
    USING (store_id = get_user_store_id())
    WITH CHECK (store_id = get_user_store_id());

-- Allow users to read profiles from their own store
-- (needed for the joined query in Activity.tsx: profiles:user_id(full_name, role))
CREATE POLICY "Users can view store profiles"
    ON public.profiles
    FOR SELECT
    USING (store_id = get_user_store_id());

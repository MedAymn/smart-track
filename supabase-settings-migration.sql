-- Settings Migration: Add store contact fields + update policy
-- Run this in your Supabase SQL editor

-- 1. Add contact columns to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Allow store owners (admins) to update their own store
CREATE POLICY IF NOT EXISTS "Store owners can update their store"
  ON public.stores
  FOR UPDATE
  USING (owner_id = auth.uid());

-- 3. Also allow staff members to read store details (SELECT already exists but broaden it)
-- The existing SELECT policy covers this, so nothing more needed.

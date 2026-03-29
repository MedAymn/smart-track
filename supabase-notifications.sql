-- ==========================================
-- NOTIFICATIONS SCHEMA setup for Supabase
-- ==========================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: The 'get_user_store_id()' function must already exist from the saas-schema layout.

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Tenant Data Policies (CRUD using store_id)
CREATE POLICY "Tenant access on notifications" ON public.notifications FOR ALL USING (store_id = get_user_store_id());

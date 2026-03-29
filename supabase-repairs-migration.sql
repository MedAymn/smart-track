-- 0. Drop the old table if it exists to fix the case-sensitivity issue
DROP TABLE IF EXISTS public.repair_orders CASCADE;

-- 1. Create the repair_orders table
CREATE TABLE IF NOT EXISTS public.repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  device_description TEXT NOT NULL,
  issue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_progress','done','delivered','cancelled')),
  repair_cost NUMERIC DEFAULT 0,
  deposit NUMERIC DEFAULT 0,
  received_date TIMESTAMPTZ NOT NULL,
  delivery_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;

-- 3. Create Isolation Policy (only see repairs for your store)
CREATE POLICY "store_isolation" ON public.repair_orders 
USING (store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid()));

-- 4. Create trigger to auto-inject store_id
CREATE TRIGGER set_store_id_repair_orders
  BEFORE INSERT ON public.repair_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_store_id();

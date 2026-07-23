-- Communities
CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.communities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "communities read" ON public.communities FOR SELECT USING (true);
CREATE POLICY "communities write" ON public.communities FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Blocks
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, name)
);
GRANT SELECT ON public.blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks read" ON public.blocks FOR SELECT USING (true);
CREATE POLICY "blocks write" ON public.blocks FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products read" ON public.products FOR SELECT USING (true);
CREATE POLICY "products write" ON public.products FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  flat_no TEXT NOT NULL DEFAULT '',
  alt_phone TEXT DEFAULT '',
  packing_note TEXT,
  community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  block_id UUID REFERENCES public.blocks(id) ON DELETE SET NULL,
  community_name TEXT NOT NULL,
  block_name TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;
GRANT USAGE ON SEQUENCE public.order_number_seq TO anon;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'MM' || LPAD(nextval('public.order_number_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION public.generate_order_number();

GRANT SELECT ON public.orders TO anon;
GRANT INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read own" ON public.orders FOR SELECT USING (true);
CREATE POLICY "orders insert" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders write" ON public.orders FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Order Items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_items TO anon;
GRANT INSERT ON public.order_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items read" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "order_items insert" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items write" ON public.order_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Enable Realtime for live order updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_community_name ON public.orders (community_name);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders (phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_blocks_community_id ON public.blocks (community_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products (active) WHERE active = true;

-- Seed Data
INSERT INTO public.products (name, unit, price) VALUES
  ('Chicken (Curry Cut)', 'kg', 260),
  ('Chicken (Boneless)', 'kg', 380),
  ('Mutton', 'kg', 780),
  ('Fish (Rohu)', 'kg', 300),
  ('Prawns', 'kg', 550),
  ('Eggs', 'dozen', 90);

INSERT INTO public.communities (name) VALUES ('Green Valley'), ('Sunrise Heights');

INSERT INTO public.blocks (community_id, name)
SELECT id, b.name FROM public.communities c
CROSS JOIN (VALUES ('A'), ('B'), ('C')) AS b(name)
WHERE c.name = 'Green Valley';

INSERT INTO public.blocks (community_id, name)
SELECT id, b.name FROM public.communities c
CROSS JOIN (VALUES ('Tower 1'), ('Tower 2')) AS b(name)
WHERE c.name = 'Sunrise Heights';

-- Settings table
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings write" ON public.settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "settings update" ON public.settings FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('maintenance_message', 'We are currently under maintenance. Please try again later.')
ON CONFLICT (key) DO NOTHING;

-- Storage policies for product-images bucket (create bucket manually in dashboard first)
CREATE POLICY "product-images select anon" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "product-images insert anon" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product-images update anon" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product-images delete anon" ON storage.objects FOR DELETE USING (bucket_id = 'product-images');

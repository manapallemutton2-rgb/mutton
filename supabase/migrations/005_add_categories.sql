-- Categories table for managing product categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories write" ON public.categories FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Seed default categories with images
INSERT INTO public.categories (name, slug, image_url) VALUES
  ('Mutton', 'mutton', '/mutton.avif'),
  ('Chicken', 'chicken', '/chicken.webp'),
  ('Fish', 'fish', '/fish.jpg'),
  ('Prawns', 'prawns', '/fish.jpg'),
  ('Eggs', 'eggs', '/Eggs.avif'),
  ('others', 'others', NULL)
ON CONFLICT (slug) DO NOTHING;

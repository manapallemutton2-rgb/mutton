ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

-- Backfill existing products based on name
UPDATE public.products SET category = 'chicken' WHERE name ILIKE 'chicken%';
UPDATE public.products SET category = 'mutton' WHERE name ILIKE 'mutton%';
UPDATE public.products SET category = 'fish' WHERE name ILIKE 'fish%';
UPDATE public.products SET category = 'prawns' WHERE name ILIKE 'prawns%';
UPDATE public.products SET category = 'eggs' WHERE name ILIKE 'eggs%';

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category) WHERE active = true;

-- Add database-backed subcategories for products.
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  priority INTEGER CHECK (priority IS NULL OR priority >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_slug, slug)
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subcategory TEXT;

GRANT SELECT ON public.subcategories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
GRANT ALL ON public.subcategories TO service_role;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subcategories read" ON public.subcategories;
CREATE POLICY "subcategories read" ON public.subcategories FOR SELECT USING (true);
DROP POLICY IF EXISTS "subcategories write" ON public.subcategories;
CREATE POLICY "subcategories write" ON public.subcategories FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_subcategories_category_priority
  ON public.subcategories (category_slug, priority ASC NULLS LAST, name ASC);

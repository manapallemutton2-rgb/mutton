-- Ensure the product-images bucket exists (previously had to be created manually
-- in the dashboard — missing bucket was the #1 image-upload failure).
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Normalize legacy product categories to lowercase slugs so shop filtering
-- (p.category === categorySlug) never misses due to case ("Mutton" vs "mutton").
UPDATE public.products SET category = LOWER(TRIM(category)) WHERE category IS NOT NULL;
UPDATE public.products SET subcategory = LOWER(TRIM(subcategory)) WHERE subcategory IS NOT NULL;
UPDATE public.categories SET slug = LOWER(TRIM(slug)) WHERE slug IS NOT NULL;
UPDATE public.subcategories SET category_slug = LOWER(TRIM(category_slug)) WHERE category_slug IS NOT NULL;
UPDATE public.subcategories SET slug = LOWER(TRIM(slug)) WHERE slug IS NOT NULL;

-- Orphan products whose category has no row in categories: move them to 'others'
-- so they still display instead of falling back to a generic "Category" card.
INSERT INTO public.categories (name, slug) VALUES ('Others', 'others')
ON CONFLICT (slug) DO NOTHING;

UPDATE public.products
SET category = 'others'
WHERE category IS NULL OR TRIM(category) = ''
   OR category NOT IN (SELECT slug FROM public.categories);

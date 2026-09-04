-- Remove the retired Yabe category and its products.
DELETE FROM public.products WHERE category = 'yabe';
DELETE FROM public.categories WHERE slug = 'yabe';

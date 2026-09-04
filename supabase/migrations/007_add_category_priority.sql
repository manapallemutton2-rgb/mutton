-- Add manual display ordering for categories.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS priority INTEGER
  CHECK (priority IS NULL OR priority >= 1);

CREATE INDEX IF NOT EXISTS idx_categories_priority
  ON public.categories (priority ASC NULLS LAST, name ASC);

-- Preserve the existing category order for rows that do not have a priority yet.
UPDATE public.categories
SET priority = ordered.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS row_num
  FROM public.categories
  WHERE priority IS NULL
) AS ordered
WHERE public.categories.id = ordered.id;

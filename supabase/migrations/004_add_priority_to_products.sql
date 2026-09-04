-- Add priority column to products table
-- Lower number = higher priority (appears first)
-- NULL priority means default ordering

ALTER TABLE products ADD COLUMN IF NOT EXISTS priority integer DEFAULT NULL;

-- Create an index for efficient sorting by priority
CREATE INDEX IF NOT EXISTS idx_products_priority ON products (priority NULLS LAST);

-- Set default priority for existing products based on their current order
-- Products with no priority get a default based on creation date
UPDATE products SET priority = sub.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS row_num
  FROM products
  WHERE priority IS NULL
) AS sub
WHERE products.id = sub.id;

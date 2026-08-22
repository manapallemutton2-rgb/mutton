ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock NUMERIC(10,2)
    CHECK (stock IS NULL OR stock >= 0);

-- Table-level GRANT already covers all columns from original migration

-- Atomic stock deduction: returns success, product_name, and available stock
CREATE OR REPLACE FUNCTION public.deduct_product_stock(
  p_product_id UUID,
  p_quantity NUMERIC(10,2)
)
RETURNS TABLE(success BOOLEAN, product_name TEXT, available NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock NUMERIC(10,2);
  v_name TEXT;
BEGIN
  SELECT stock, name INTO v_current_stock, v_name
  FROM public.products
  WHERE id = p_product_id;

  -- NULL stock means unlimited
  IF v_current_stock IS NULL THEN
    RETURN QUERY SELECT true::BOOLEAN, v_name, NULL::NUMERIC;
    RETURN;
  END IF;

  IF v_current_stock >= p_quantity THEN
    UPDATE public.products
    SET stock = stock - p_quantity
    WHERE id = p_product_id;

    RETURN QUERY SELECT true::BOOLEAN, v_name, v_current_stock - p_quantity;
  ELSE
    RETURN QUERY SELECT false::BOOLEAN, v_name, v_current_stock;
  END IF;
END;
$$;

-- Restore stock after failed order
CREATE OR REPLACE FUNCTION public.restore_product_stock(
  p_product_id UUID,
  p_quantity NUMERIC(10,2)
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.products
  SET stock = stock + p_quantity
  WHERE id = p_product_id AND stock IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_product_stock TO anon;
GRANT EXECUTE ON FUNCTION public.restore_product_stock TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

INSERT INTO public.settings (key, value) VALUES
  ('orders_open', 'true')
ON CONFLICT (key) DO NOTHING;

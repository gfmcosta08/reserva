-- Quantidade em estoque (munição e itens consumíveis em lote; padrão 1 para equipamentos unitários)
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_stock_quantity_check;

ALTER TABLE public.materials
  ADD CONSTRAINT materials_stock_quantity_check CHECK (stock_quantity >= 1);

COMMENT ON COLUMN public.materials.stock_quantity IS 'Quantidade em estoque (ex.: projéteis). Equipamentos unitários usam 1.';

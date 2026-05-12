-- Adiciona campos marca, modelo e calibre à tabela materials

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS modelo TEXT,
  ADD COLUMN IF NOT EXISTS calibre TEXT;

CREATE INDEX IF NOT EXISTS idx_materials_marca  ON public.materials (marca);
CREATE INDEX IF NOT EXISTS idx_materials_modelo ON public.materials (modelo);
CREATE INDEX IF NOT EXISTS idx_materials_calibre ON public.materials (calibre);

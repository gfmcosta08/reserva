ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_status_check;
ALTER TABLE public.materials ADD CONSTRAINT materials_status_check CHECK (status IN ('available', 'in_use', 'maintenance', 'blocked', 'cautelado'));

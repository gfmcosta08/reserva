-- Migration: Adicionar campos de quantidade para controle de devolução
-- Data: 2026-03-27

-- Adicionar campos de quantidade na tabela cautela_items
ALTER TABLE public.cautela_items
ADD COLUMN IF NOT EXISTS quantity_delivered INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_returned INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES public.profiles(id);

-- Comentários para documentação
COMMENT ON COLUMN public.cautela_items.quantity_delivered IS 'Quantidade entregue ao cautelado (padrão: 1 para itens únicos)';
COMMENT ON COLUMN public.cautela_items.quantity_returned IS 'Quantidade devolvida pelo cautelado';
COMMENT ON COLUMN public.cautela_items.returned_at IS 'Data e hora da devolução';
COMMENT ON COLUMN public.cautela_items.returned_by IS 'Operador que recebeu a devolução';

-- Atualizar itens existentes com quantity_delivered = 1
UPDATE public.cautela_items
SET quantity_delivered = 1
WHERE quantity_delivered IS NULL;

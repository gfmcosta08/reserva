-- Migration: Add columns to support Permanent Cautela Document format

-- Add Destino and Situação Legado to Cautelas
ALTER TABLE public.cautelas 
ADD COLUMN IF NOT EXISTS destino TEXT,
ADD COLUMN IF NOT EXISTS situacao_legado TEXT;

-- Add Carregadores to Cautela Items
ALTER TABLE public.cautela_items
ADD COLUMN IF NOT EXISTS carregadores TEXT;

-- Add Tamanho (for Coletes) to Materials
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS tamanho TEXT;

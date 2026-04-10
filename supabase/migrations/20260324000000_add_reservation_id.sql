-- Adicionar coluna de Identificação da Reserva
ALTER TABLE materials ADD COLUMN reservation_id text;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS materials_reservation_id_idx ON materials (reservation_id);

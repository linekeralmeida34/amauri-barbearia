-- Adiciona coluna created_by na tabela bookings para indicar quem criou o agendamento
-- Execute este script no Supabase SQL Editor

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS created_by TEXT
  CHECK (created_by IN ('client', 'barber', 'admin'))
  DEFAULT 'client'
  NOT NULL;

COMMENT ON COLUMN bookings.created_by IS 'Origem da criação do agendamento: client, barber ou admin';

-- Backfill explícito para consistência
UPDATE bookings SET created_by = COALESCE(created_by, 'client');

-- Índice parcial opcional para consultas por origem
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);



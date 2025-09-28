-- Adicionar coluna canceled_by_admin na tabela bookings
-- Execute este script no Supabase SQL Editor

-- Adicionar coluna canceled_by_admin na tabela bookings
ALTER TABLE bookings 
ADD COLUMN canceled_by_admin BOOLEAN DEFAULT FALSE;

-- Comentário para documentar a coluna
COMMENT ON COLUMN bookings.canceled_by_admin IS 'Indica se o agendamento foi cancelado pelo administrador';

-- Atualizar registros existentes para ter o valor padrão
UPDATE bookings SET canceled_by_admin = FALSE WHERE canceled_by_admin IS NULL;

-- Criar índice para melhorar performance nas consultas
CREATE INDEX idx_bookings_canceled_by_admin ON bookings(canceled_by_admin) WHERE canceled_by_admin = TRUE;

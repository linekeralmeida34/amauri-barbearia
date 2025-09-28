-- Adicionar coluna payment_method na tabela bookings
-- Execute este script no Supabase SQL Editor

-- Adicionar coluna payment_method na tabela bookings
ALTER TABLE bookings 
ADD COLUMN payment_method TEXT CHECK (payment_method IN ('credit_card', 'debit_card', 'cash', 'pix'));

-- Comentário para documentar a coluna
COMMENT ON COLUMN bookings.payment_method IS 'Forma de pagamento: credit_card, debit_card, cash, pix';

-- Atualizar registros existentes para ter um valor padrão (opcional)
-- UPDATE bookings SET payment_method = NULL WHERE payment_method IS NULL;

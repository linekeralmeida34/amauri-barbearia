-- Adicionar 'voucher' como opção de forma de pagamento
-- Execute este script no Supabase SQL Editor

-- Primeiro, remover a constraint existente
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

-- Adicionar nova constraint incluindo 'voucher'
ALTER TABLE bookings 
ADD CONSTRAINT bookings_payment_method_check 
CHECK (payment_method IN ('credit_card', 'debit_card', 'cash', 'pix', 'voucher'));

-- Atualizar o comentário da coluna
COMMENT ON COLUMN bookings.payment_method IS 'Forma de pagamento: credit_card, debit_card, cash, pix, voucher';

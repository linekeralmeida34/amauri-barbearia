-- Script de teste para verificar o campo canceled_by_admin
-- Execute este script no Supabase SQL Editor

-- 1. Verificar se a coluna existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name = 'canceled_by_admin';

-- 2. Verificar os dados atuais da tabela bookings
SELECT id, status, canceled_by_admin, customer_name, starts_at
FROM bookings 
ORDER BY starts_at DESC 
LIMIT 5;

-- 3. Atualizar alguns agendamentos para testar (substitua os IDs pelos reais)
-- UPDATE bookings SET canceled_by_admin = true WHERE id = 'ID_DO_AGENDAMENTO_AQUI';

-- 4. Verificar se a atualização funcionou
-- SELECT id, status, canceled_by_admin, customer_name, starts_at
-- FROM bookings 
-- WHERE canceled_by_admin = true;

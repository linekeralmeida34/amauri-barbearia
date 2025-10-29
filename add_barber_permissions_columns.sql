-- Script para adicionar colunas de permissões na tabela barbers
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar colunas de permissões
ALTER TABLE barbers 
ADD COLUMN IF NOT EXISTS can_cancel_bookings BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_create_bookings BOOLEAN DEFAULT false;

-- 2. Comentários para documentar as colunas
COMMENT ON COLUMN barbers.can_cancel_bookings IS 'Permite ao barbeiro cancelar agendamentos';
COMMENT ON COLUMN barbers.can_create_bookings IS 'Permite ao barbeiro criar novos agendamentos';

-- 3. Verificar se as colunas foram adicionadas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'barbers' 
  AND column_name IN ('can_cancel_bookings', 'can_create_bookings')
ORDER BY ordinal_position;

-- 4. Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'barbers' 
ORDER BY ordinal_position;


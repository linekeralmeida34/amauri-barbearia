-- Script para adicionar coluna commission_percentage na tabela services
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar coluna commission_percentage na tabela services
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 50.00;

-- 2. Adicionar comentário na coluna
COMMENT ON COLUMN public.services.commission_percentage IS 'Percentual de comissão que o barbeiro recebe por este serviço (0-100)';

-- 3. Adicionar constraint para garantir que o valor esteja entre 0 e 100
ALTER TABLE public.services 
ADD CONSTRAINT check_commission_percentage 
CHECK (commission_percentage >= 0 AND commission_percentage <= 100);

-- 4. Atualizar serviços existentes com comissão padrão de 50%
UPDATE public.services 
SET commission_percentage = 50.00 
WHERE commission_percentage IS NULL;

-- 5. Verificar se a coluna foi adicionada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'services' 
  AND column_name = 'commission_percentage';

-- 6. Verificar dados atualizados
SELECT id, name, price, commission_percentage, 
       ROUND(price * (commission_percentage / 100), 2) as barber_earnings
FROM services 
ORDER BY name;

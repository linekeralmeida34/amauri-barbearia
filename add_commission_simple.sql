-- Script simples para adicionar coluna commission_percentage
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar coluna commission_percentage na tabela services
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 100.00;

-- 2. Atualizar serviços existentes com comissão padrão de 100%
UPDATE public.services 
SET commission_percentage = 100.00 
WHERE commission_percentage IS NULL;

-- 3. Verificar se funcionou
SELECT id, name, price, commission_percentage 
FROM services 
ORDER BY name;

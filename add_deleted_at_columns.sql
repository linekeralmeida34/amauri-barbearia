-- Script para adicionar coluna deleted_at nas tabelas services e barbers
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar coluna deleted_at na tabela services
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Adicionar coluna deleted_at na tabela barbers
ALTER TABLE public.barbers 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Criar índices para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_services_deleted_at ON public.services(deleted_at);
CREATE INDEX IF NOT EXISTS idx_barbers_deleted_at ON public.barbers(deleted_at);

-- 4. Verificar se as colunas foram adicionadas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name IN ('services', 'barbers') 
  AND column_name = 'deleted_at'
ORDER BY table_name;

-- 5. Verificar estrutura das tabelas
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('services', 'barbers') 
ORDER BY table_name, ordinal_position;

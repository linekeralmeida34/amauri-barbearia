-- Script simples para desabilitar RLS na tabela services
-- Execute este script no SQL Editor do Supabase

-- 1. Desabilitar RLS na tabela services
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;

-- 2. Verificar se funcionou
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'services';

-- 3. Testar se consegue fazer consultas
SELECT COUNT(*) as total_services FROM services;
SELECT COUNT(*) as active_services FROM services WHERE is_active = true;

-- 4. Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'services' 
ORDER BY ordinal_position;

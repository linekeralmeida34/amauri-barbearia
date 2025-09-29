-- Script para corrigir permissões de inserção na tabela services
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar estado atual da tabela services
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'services';

-- 2. Verificar políticas atuais
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'services'
ORDER BY policyname;

-- 3. Remover políticas existentes (se houver)
DROP POLICY IF EXISTS "Public can read active services" ON public.services;
DROP POLICY IF EXISTS "Authenticated can read services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.services;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.services;
DROP POLICY IF EXISTS "Enable update for all users" ON public.services;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.services;

-- 4. Desabilitar RLS temporariamente para permitir acesso total
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;

-- 5. Verificar se funcionou
SELECT COUNT(*) as total_services FROM services;
SELECT COUNT(*) as active_services FROM services WHERE is_active = true;

-- 6. Testar inserção (opcional - descomente para testar)
-- INSERT INTO services (name, description, duration_min, price, category, popular, is_active)
-- VALUES ('Teste', 'Serviço de teste', 30, 25.00, 'Cortes', false, true);

-- 7. Verificar permissões finais
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    tableowner
FROM pg_tables 
WHERE tablename = 'services';

-- 8. Verificar se a tabela tem as colunas corretas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'services' 
ORDER BY ordinal_position;

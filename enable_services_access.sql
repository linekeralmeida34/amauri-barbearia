-- Script direto para habilitar acesso à tabela services
-- Execute este script no SQL Editor do Supabase

-- 1. Desabilitar RLS (Row Level Security) na tabela services
-- Isso permite acesso público à tabela, similar ao que deve estar configurado para barbers
ALTER TABLE services DISABLE ROW LEVEL SECURITY;

-- 2. Verificar se funcionou
SELECT COUNT(*) as total_services FROM services;
SELECT COUNT(*) as active_services FROM services WHERE is_active = true;

-- 3. Se ainda não funcionar, tentar habilitar RLS com política permissiva
-- ALTER TABLE services ENABLE ROW LEVEL SECURITY;
-- 
-- DROP POLICY IF EXISTS "Enable read access for all users" ON services;
-- CREATE POLICY "Enable read access for all users" ON services
--     FOR SELECT USING (true);

-- 4. Verificar permissões finais
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    tableowner
FROM pg_tables 
WHERE tablename IN ('services', 'barbers');

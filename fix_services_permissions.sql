-- Script para corrigir permissões da tabela services
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se a tabela services existe e suas permissões atuais
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename = 'services';

-- 2. Verificar políticas RLS (Row Level Security) da tabela services
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'services';

-- 3. Verificar se RLS está habilitado na tabela services
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'services';

-- 4. Criar política para permitir leitura pública da tabela services
-- (similar ao que deve existir para barbers)

-- Primeiro, desabilitar RLS temporariamente se estiver habilitado
ALTER TABLE services DISABLE ROW LEVEL SECURITY;

-- Ou criar uma política permissiva para leitura pública
-- ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir SELECT público
-- DROP POLICY IF EXISTS "Allow public read access" ON services;
-- CREATE POLICY "Allow public read access" ON services
--     FOR SELECT USING (true);

-- 5. Verificar se a tabela services tem as colunas corretas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'services' 
ORDER BY ordinal_position;

-- 6. Testar se consegue fazer SELECT na tabela services
SELECT COUNT(*) as total_services FROM services;
SELECT COUNT(*) as active_services FROM services WHERE is_active = true;

-- 7. Verificar permissões da tabela barbers para comparação
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'barbers';

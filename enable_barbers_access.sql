-- Script direto para habilitar acesso completo à tabela barbers
-- Execute este script no SQL Editor do Supabase

-- 1. Desabilitar RLS (Row Level Security) na tabela barbers
-- Isso permite acesso público completo (SELECT, INSERT, UPDATE, DELETE)
ALTER TABLE barbers DISABLE ROW LEVEL SECURITY;

-- 2. Verificar se funcionou
SELECT COUNT(*) as total_barbers FROM barbers;
SELECT COUNT(*) as active_barbers FROM barbers WHERE is_active = true;

-- 3. Verificar se consegue fazer SELECT com todos os campos
SELECT id, name, email, is_active, created_at 
FROM barbers 
ORDER BY name;

-- 4. Verificar permissões finais
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    tableowner
FROM pg_tables 
WHERE tablename = 'barbers';

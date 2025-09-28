-- Script para testar as políticas RLS da tabela services
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se RLS está habilitado
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

-- 3. Testar como usuário anônimo (simular acesso público)
SET LOCAL role TO anon;
SELECT COUNT(*) as count_anon FROM services WHERE is_active = true;
SELECT id, name, is_active FROM services WHERE is_active = true ORDER BY name;
RESET role;

-- 4. Testar como usuário autenticado (simular acesso admin)
SET LOCAL role TO authenticated;
SELECT COUNT(*) as count_auth FROM services WHERE is_active = true;
SELECT id, name, is_active FROM services WHERE is_active = true ORDER BY name;
RESET role;

-- 5. Verificar todos os serviços (sem filtro)
SELECT id, name, is_active, created_at 
FROM services 
ORDER BY name;

-- 6. Verificar se há serviços inativos
SELECT COUNT(*) as inactive_services 
FROM services 
WHERE is_active = false;

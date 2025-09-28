-- Script para corrigir permissões da tabela barbers
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar políticas RLS atuais da tabela barbers
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
WHERE tablename = 'barbers';

-- 2. Verificar se RLS está habilitado na tabela barbers
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    tableowner
FROM pg_tables 
WHERE tablename = 'barbers';

-- 3. Desabilitar RLS na tabela barbers para permitir acesso público
ALTER TABLE barbers DISABLE ROW LEVEL SECURITY;

-- 4. Verificar se funcionou - testar SELECT
SELECT COUNT(*) as total_barbers FROM barbers;
SELECT COUNT(*) as active_barbers FROM barbers WHERE is_active = true;

-- 5. Testar INSERT (opcional - apenas para verificar se funciona)
-- INSERT INTO barbers (name, email, is_active) 
-- VALUES ('Teste', 'teste@teste.com', true);

-- 6. Se ainda não funcionar, habilitar RLS com política permissiva
-- ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
-- 
-- DROP POLICY IF EXISTS "Enable read access for all users" ON barbers;
-- CREATE POLICY "Enable read access for all users" ON barbers
--     FOR ALL USING (true) WITH CHECK (true);

-- 7. Verificar permissões finais
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    tableowner
FROM pg_tables 
WHERE tablename = 'barbers';

-- Script para desabilitar RLS temporariamente na tabela barbers
-- Execute este script se o anterior não funcionar

-- 1. Desabilitar RLS na tabela barbers (temporário)
ALTER TABLE public.barbers DISABLE ROW LEVEL SECURITY;

-- 2. Verificar se funcionou
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'barbers';

-- 3. Testar SELECT
SELECT COUNT(*) as total_barbers FROM barbers;
SELECT COUNT(*) as active_barbers FROM barbers WHERE is_active = true;

-- 4. Testar INSERT (opcional)
-- INSERT INTO barbers (name, email, is_active) 
-- VALUES ('Teste Sem RLS', 'teste@semrls.com', true);

-- 5. Verificar dados
SELECT id, name, email, is_active, created_at 
FROM barbers 
ORDER BY name;

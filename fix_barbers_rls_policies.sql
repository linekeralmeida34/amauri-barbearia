-- Script para corrigir as políticas RLS da tabela barbers
-- Execute este script no SQL Editor do Supabase

-- 1. Remover todas as políticas existentes da tabela barbers
DROP POLICY IF EXISTS "Public can read active barbers" ON public.barbers;
DROP POLICY IF EXISTS "Authenticated can read barbers" ON public.barbers;
DROP POLICY IF EXISTS "Admins can manage barbers" ON public.barbers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.barbers;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.barbers;
DROP POLICY IF EXISTS "Enable update for all users" ON public.barbers;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.barbers;

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para leitura pública (usuários não autenticados)
CREATE POLICY "Public can read active barbers"
ON public.barbers
FOR SELECT
TO anon
USING (is_active = true);

-- 4. Criar política para leitura de usuários autenticados
CREATE POLICY "Authenticated can read barbers"
ON public.barbers
FOR SELECT
TO authenticated
USING (true);

-- 5. Criar política para gestão por admins (INSERT, UPDATE, DELETE)
-- Primeiro, vamos criar uma política mais simples que permite tudo para usuários autenticados
CREATE POLICY "Authenticated can manage barbers"
ON public.barbers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Verificar se as políticas foram criadas
SELECT 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'barbers'
ORDER BY policyname;

-- 7. Testar se consegue fazer SELECT
SELECT COUNT(*) as total_barbers FROM barbers;
SELECT COUNT(*) as active_barbers FROM barbers WHERE is_active = true;

-- 8. Testar INSERT (opcional - apenas para verificar)
-- INSERT INTO barbers (name, email, is_active) 
-- VALUES ('Teste RLS', 'teste@rls.com', true);

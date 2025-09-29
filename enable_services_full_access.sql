-- Script para habilitar acesso completo à tabela services mantendo RLS
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar estado atual
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'services';

-- 2. Remover todas as políticas existentes
DROP POLICY IF EXISTS "Public can read active services" ON public.services;
DROP POLICY IF EXISTS "Authenticated can read services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.services;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.services;
DROP POLICY IF EXISTS "Enable update for all users" ON public.services;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.services;

-- 3. Garantir que RLS está habilitado
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 4. Criar política permissiva para leitura (usuários anônimos)
CREATE POLICY "Public can read active services"
ON public.services
FOR SELECT
TO anon
USING (is_active = true);

-- 5. Criar política permissiva para leitura (usuários autenticados)
CREATE POLICY "Authenticated can read all services"
ON public.services
FOR SELECT
TO authenticated
USING (true);

-- 6. Criar política permissiva para inserção (usuários autenticados)
CREATE POLICY "Authenticated can insert services"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 7. Criar política permissiva para atualização (usuários autenticados)
CREATE POLICY "Authenticated can update services"
ON public.services
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 8. Criar política permissiva para exclusão (usuários autenticados)
CREATE POLICY "Authenticated can delete services"
ON public.services
FOR DELETE
TO authenticated
USING (true);

-- 9. Verificar se as políticas foram criadas
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

-- 10. Testar consultas
SELECT COUNT(*) as total_services FROM services;
SELECT COUNT(*) as active_services FROM services WHERE is_active = true;
SELECT id, name, is_active FROM services WHERE is_active = true ORDER BY name;

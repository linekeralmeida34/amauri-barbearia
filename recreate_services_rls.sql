-- Script para recriar as políticas RLS da tabela services
-- Execute este script no SQL Editor do Supabase

-- 1. Remover todas as políticas existentes
DROP POLICY IF EXISTS "Public can read active services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.services;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.services;
DROP POLICY IF EXISTS "Enable update for all users" ON public.services;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.services;

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para leitura pública (usuários não autenticados)
CREATE POLICY "Public can read active services"
ON public.services
FOR SELECT
TO anon
USING (is_active = true);

-- 4. Criar política para leitura de usuários autenticados
CREATE POLICY "Authenticated can read services"
ON public.services
FOR SELECT
TO authenticated
USING (true);

-- 5. Criar política para gestão por admins
-- (assumindo que você tem a tabela admin_users)
CREATE POLICY "Admins can manage services"
ON public.services
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
      AND au.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
      AND au.role IN ('owner', 'admin')
  )
);

-- 6. Se não tiver a tabela admin_users, criar política mais simples
-- (descomente as linhas abaixo se necessário)
/*
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;

CREATE POLICY "Admins can manage services"
ON public.services
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
*/

-- 7. Verificar se as políticas foram criadas
SELECT 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'services'
ORDER BY policyname;

-- 8. Testar a consulta
SELECT COUNT(*) as total_services FROM services;
SELECT COUNT(*) as active_services FROM services WHERE is_active = true;
SELECT id, name, is_active FROM services WHERE is_active = true ORDER BY name;

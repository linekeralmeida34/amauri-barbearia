-- ============================================
-- SOLUÇÃO FINAL: Desabilita RLS na tabela bookings
-- Isso permite que clientes consultem seus agendamentos
-- ============================================

-- IMPORTANTE: Este script desabilita RLS completamente na tabela bookings
-- Isso permite acesso público de leitura. Use com cuidado em produção.

-- 1. Desabilita RLS na tabela bookings
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- 2. Remove todas as políticas existentes (para evitar conflitos)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'bookings' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', r.policyname);
  END LOOP;
END $$;

-- 3. Cria função RPC como backup (caso precise reabilitar RLS depois)
DROP FUNCTION IF EXISTS public.get_customer_bookings(TEXT);

CREATE OR REPLACE FUNCTION public.get_customer_bookings(p_phone TEXT)
RETURNS TABLE (
  id UUID,
  starts_at TIMESTAMPTZ,
  status TEXT,
  customer_name TEXT,
  phone TEXT,
  price NUMERIC,
  payment_method TEXT,
  duration_min INTEGER,
  service_name TEXT,
  barber_name TEXT,
  barber_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_phone TEXT;
BEGIN
  -- Normaliza o telefone de entrada
  v_normalized_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF length(v_normalized_phone) > 11 THEN
    v_normalized_phone := right(v_normalized_phone, 11);
  END IF;
  
  IF length(v_normalized_phone) != 11 THEN
    RAISE EXCEPTION 'Telefone inválido. Deve ter 11 dígitos.';
  END IF;

  RETURN QUERY
  SELECT 
    b.id,
    b.starts_at,
    b.status::TEXT,
    b.customer_name,
    b.phone,
    b.price,
    b.payment_method::TEXT,
    b.duration_min,
    s.name AS service_name,
    br.name AS barber_name,
    br.id AS barber_id
  FROM public.bookings b
  LEFT JOIN public.services s ON s.id = b.service_id
  LEFT JOIN public.barbers br ON br.id = b.barber_id
  WHERE 
    -- Normaliza o telefone do banco também para comparar
    CASE 
      WHEN length(regexp_replace(COALESCE(b.phone, ''), '[^0-9]', '', 'g')) > 11 
      THEN right(regexp_replace(COALESCE(b.phone, ''), '[^0-9]', '', 'g'), 11)
      ELSE regexp_replace(COALESCE(b.phone, ''), '[^0-9]', '', 'g')
    END = v_normalized_phone
  ORDER BY b.starts_at DESC;
END;
$$;

-- Garante permissão de execução
GRANT EXECUTE ON FUNCTION public.get_customer_bookings(TEXT) TO anon, authenticated, public;

-- Comentário
COMMENT ON FUNCTION public.get_customer_bookings IS 
  'Função que permite consultar agendamentos por telefone, bypassando RLS.';

-- ============================================
-- VERIFICAÇÃO: Confirma que RLS está desabilitado
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'bookings' AND schemaname = 'public';

-- Se rowsecurity = false, RLS está desabilitado (correto)
-- Se rowsecurity = true, RLS ainda está habilitado (precisa executar novamente)


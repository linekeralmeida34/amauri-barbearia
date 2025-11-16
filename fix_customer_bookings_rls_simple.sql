-- ============================================
-- SOLUÇÃO SIMPLIFICADA: Desabilita RLS temporariamente
-- Use este script se o anterior não funcionar
-- ============================================

-- IMPORTANTE: Este script desabilita RLS na tabela bookings
-- Isso permite acesso público. Use apenas se necessário.

-- Desabilita RLS temporariamente (para testar)
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- Se quiser manter RLS habilitado mas permitir acesso público, use:
-- ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- 
-- E depois crie uma política permissiva:
-- DROP POLICY IF EXISTS "Allow public read" ON public.bookings;
-- CREATE POLICY "Allow public read" ON public.bookings FOR SELECT USING (true);

-- ============================================
-- ALTERNATIVA: Criar função RPC (recomendado)
-- ============================================

-- Remove função se existir
DROP FUNCTION IF EXISTS public.get_customer_bookings(TEXT);

-- Cria função SECURITY DEFINER
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
  -- Normaliza o telefone
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
    -- Remove caracteres não numéricos e pega últimos 11 dígitos
    CASE 
      WHEN length(regexp_replace(b.phone, '[^0-9]', '', 'g')) > 11 
      THEN right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 11)
      ELSE regexp_replace(b.phone, '[^0-9]', '', 'g')
    END = v_normalized_phone
  ORDER BY b.starts_at DESC;
END;
$$;

-- Garante permissão de execução
GRANT EXECUTE ON FUNCTION public.get_customer_bookings(TEXT) TO anon, authenticated, public;

-- Comentário
COMMENT ON FUNCTION public.get_customer_bookings IS 
  'Função que permite consultar agendamentos por telefone, bypassando RLS.';


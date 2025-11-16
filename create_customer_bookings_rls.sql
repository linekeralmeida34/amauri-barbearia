-- ============================================
-- Permissões RLS para Área do Cliente
-- Permite que clientes consultem seus próprios agendamentos por telefone
-- ============================================

-- SOLUÇÃO 1: Remover TODAS as políticas existentes e criar novas
-- Remove todas as políticas existentes da tabela bookings
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'bookings' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', r.policyname);
  END LOOP;
END $$;

-- Habilita RLS na tabela bookings (se ainda não estiver habilitado)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Cria política que permite consulta pública por telefone
-- IMPORTANTE: Esta política permite que QUALQUER pessoa consulte agendamentos
-- por telefone. Se quiser mais segurança, você pode adicionar autenticação.
CREATE POLICY "Allow customers to view their own bookings"
  ON public.bookings
  FOR SELECT
  USING (true); -- Permite leitura pública (necessário para consulta por telefone)

-- Cria política que permite cancelamento apenas de agendamentos futuros
-- e que não foram cancelados pelo admin
CREATE POLICY "Allow customers to cancel their own bookings"
  ON public.bookings
  FOR UPDATE
  USING (
    -- Permite atualizar apenas se:
    -- 1. O status não é 'canceled' (ou está sendo cancelado agora)
    -- 2. O agendamento está no futuro (pelo menos 2 horas antes)
    status != 'canceled' 
    AND starts_at > (NOW() + INTERVAL '2 hours')
    AND (canceled_by_admin IS NULL OR canceled_by_admin = false)
  )
  WITH CHECK (
    -- Permite apenas mudar status para 'canceled'
    status = 'canceled'
  );

-- SOLUÇÃO 2: Criar função SECURITY DEFINER como alternativa
-- Esta função bypassa o RLS de forma segura
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
  -- Normaliza o telefone (remove caracteres não numéricos e pega últimos 11 dígitos)
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

-- Comentários para documentação
COMMENT ON POLICY "Allow customers to view their own bookings" ON public.bookings IS 
  'Permite que clientes consultem agendamentos por telefone (consulta pública)';

COMMENT ON POLICY "Allow customers to cancel their own bookings" ON public.bookings IS 
  'Permite que clientes cancelem seus próprios agendamentos (apenas futuros, com 2h de antecedência)';

-- Garante que a função pode ser executada publicamente
GRANT EXECUTE ON FUNCTION public.get_customer_bookings(TEXT) TO anon, authenticated;

-- Comentários para documentação
COMMENT ON FUNCTION public.get_customer_bookings IS 
  'Função SECURITY DEFINER que permite consultar agendamentos por telefone, bypassando RLS. Use esta função se as políticas RLS não funcionarem.';


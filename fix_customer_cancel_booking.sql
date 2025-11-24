-- ============================================
-- Função RPC para cancelar agendamento do cliente
-- Valida telefone e regras de cancelamento
-- ============================================

DROP FUNCTION IF EXISTS public.cancel_customer_booking(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.cancel_customer_booking(
  p_booking_id UUID,
  p_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_phone TEXT;
  v_booking_phone TEXT;
  v_booking_status TEXT;
  v_booking_starts_at TIMESTAMPTZ;
  v_canceled_by_admin BOOLEAN;
BEGIN
  -- Normaliza o telefone de entrada
  v_normalized_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF length(v_normalized_phone) > 11 THEN
    v_normalized_phone := right(v_normalized_phone, 11);
  END IF;
  
  IF length(v_normalized_phone) != 11 THEN
    RAISE EXCEPTION 'Telefone inválido. Deve ter 11 dígitos.';
  END IF;

  -- Busca o agendamento
  SELECT 
    b.phone,
    b.status::TEXT,
    b.starts_at,
    COALESCE(b.canceled_by_admin, false)
  INTO 
    v_booking_phone,
    v_booking_status,
    v_booking_starts_at,
    v_canceled_by_admin
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  -- Verifica se o agendamento existe
  IF v_booking_phone IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;

  -- Normaliza o telefone do agendamento
  v_booking_phone := regexp_replace(v_booking_phone, '[^0-9]', '', 'g');
  IF length(v_booking_phone) > 11 THEN
    v_booking_phone := right(v_booking_phone, 11);
  END IF;

  -- Verifica se o telefone corresponde
  IF v_booking_phone != v_normalized_phone THEN
    RAISE EXCEPTION 'Este agendamento não pertence a este telefone.';
  END IF;

  -- Verifica se já está cancelado
  IF v_booking_status = 'canceled' THEN
    RAISE EXCEPTION 'Este agendamento já está cancelado.';
  END IF;

  -- Verifica se foi cancelado pelo admin
  IF v_canceled_by_admin = true THEN
    RAISE EXCEPTION 'Este agendamento foi cancelado pelo administrador e não pode ser alterado.';
  END IF;

  -- Verifica se está no futuro (pelo menos 2 horas antes)
  IF v_booking_starts_at <= (NOW() + INTERVAL '2 hours') THEN
    RAISE EXCEPTION 'Agendamentos só podem ser cancelados com pelo menos 2 horas de antecedência.';
  END IF;

  -- Cancela o agendamento
  UPDATE public.bookings
  SET 
    status = 'canceled',
    updated_at = NOW()
  WHERE id = p_booking_id;

END;
$$;

-- Garante permissão de execução
GRANT EXECUTE ON FUNCTION public.cancel_customer_booking(UUID, TEXT) TO anon, authenticated, public;

-- Comentário
COMMENT ON FUNCTION public.cancel_customer_booking IS 
  'Função SECURITY DEFINER que permite cancelar agendamento do cliente, validando telefone e regras de cancelamento.';


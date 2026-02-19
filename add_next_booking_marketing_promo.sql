-- ============================================
-- Promoção de marketing para o próximo agendamento
-- - Aplica desconto/serviço grátis automaticamente no próximo booking
-- - Mantém histórico de preço original e desconto aplicado
-- - Expõe campos promocionais na RPC get_customer_bookings
-- ============================================

BEGIN;

-- 1) Campos promocionais na tabela de agendamentos
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promo_aplicada TEXT,
  ADD COLUMN IF NOT EXISTS promo_discount_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promo_discount_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS promo_campaign TEXT;

COMMENT ON COLUMN public.bookings.original_price IS 'Preço original do serviço antes de promoção.';
COMMENT ON COLUMN public.bookings.promo_aplicada IS 'Texto da promoção aplicada no agendamento.';
COMMENT ON COLUMN public.bookings.promo_discount_value IS 'Valor em R$ descontado por promoção.';
COMMENT ON COLUMN public.bookings.promo_discount_percent IS 'Percentual efetivo de desconto aplicado.';
COMMENT ON COLUMN public.bookings.promo_campaign IS 'Nome da campanha de marketing associada.';

-- 2) Trigger para aplicar promoção apenas uma vez (próximo agendamento)
CREATE OR REPLACE FUNCTION public.apply_next_marketing_promo_to_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_campaign TEXT;
  v_promo_text TEXT;
  v_promo_lower TEXT;
  v_service_name TEXT;
  v_sent_at TIMESTAMPTZ;
  v_original NUMERIC;
  v_discount NUMERIC := 0;
  v_percent NUMERIC;
  v_fixed NUMERIC;
  v_already_used BOOLEAN := FALSE;
BEGIN
  -- Não tenta aplicar em registros sem telefone/preço
  IF NEW.phone IS NULL OR NEW.price IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se já veio com promoção aplicada, respeita o valor atual
  IF NEW.promo_aplicada IS NOT NULL OR COALESCE(NEW.promo_discount_value, 0) > 0 THEN
    IF NEW.original_price IS NULL THEN
      NEW.original_price := NEW.price;
    END IF;
    RETURN NEW;
  END IF;

  v_phone := right(regexp_replace(NEW.phone, '[^0-9]', '', 'g'), 11);
  IF length(v_phone) <> 11 THEN
    RETURN NEW;
  END IF;

  -- Busca a campanha mais recente enviada para o telefone
  -- Nota: se a tabela de marketing não existir ainda, apenas ignora
  BEGIN
    SELECT l.campanha, l.promo_aplicada, l.data_envio
      INTO v_campaign, v_promo_text, v_sent_at
    FROM public.log_envios_marketing l
    WHERE right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 11) = v_phone
    ORDER BY l.data_envio DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      RETURN NEW;
  END;

  IF v_promo_text IS NULL OR v_sent_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Já usou promoção após esse disparo? então não aplica novamente
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 11) = v_phone
      AND b.starts_at >= v_sent_at
      AND (
        b.promo_aplicada IS NOT NULL
        OR COALESCE(b.promo_discount_value, 0) > 0
      )
      AND (TG_OP = 'INSERT' OR b.id <> NEW.id)
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN NEW;
  END IF;

  v_original := GREATEST(COALESCE(NEW.original_price, NEW.price), 0);
  v_promo_lower := lower(v_promo_text);
  SELECT lower(name) INTO v_service_name
  FROM public.services
  WHERE id = NEW.service_id;

  -- "grátis" só vale para o serviço correspondente da campanha
  IF position('barba' in v_promo_lower) > 0
     AND (position('grátis' in v_promo_lower) > 0 OR position('gratis' in v_promo_lower) > 0 OR position('gratuit' in v_promo_lower) > 0) THEN
    IF v_service_name IS NOT NULL AND position('barba' in v_service_name) > 0 THEN
      v_discount := v_original;
    END IF;
  ELSIF position('sobrancelha' in v_promo_lower) > 0
     AND (position('grátis' in v_promo_lower) > 0 OR position('gratis' in v_promo_lower) > 0 OR position('gratuit' in v_promo_lower) > 0) THEN
    IF v_service_name IS NOT NULL AND position('sobrancelha' in v_service_name) > 0 THEN
      v_discount := v_original;
    END IF;
  ELSE
    -- Ex.: "desconto de 25%"
    BEGIN
      SELECT replace((regexp_match(v_promo_lower, '([0-9]+(?:[.,][0-9]+)?)\s*%'))[1], ',', '.')::numeric
      INTO v_percent;
    EXCEPTION
      WHEN OTHERS THEN
        v_percent := NULL;
    END;

    IF v_percent IS NOT NULL THEN
      v_discount := ROUND(v_original * (v_percent / 100.0), 2);
    ELSE
      -- Ex.: "desconto de R$ 20"
      BEGIN
        SELECT replace((regexp_match(v_promo_lower, 'r\$\s*([0-9]+(?:[.,][0-9]+)?)'))[1], ',', '.')::numeric
        INTO v_fixed;
      EXCEPTION
        WHEN OTHERS THEN
          v_fixed := NULL;
      END;

      IF v_fixed IS NOT NULL THEN
        v_discount := LEAST(ROUND(v_fixed, 2), v_original);
      END IF;
    END IF;
  END IF;

  IF COALESCE(v_discount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  NEW.original_price := v_original;
  NEW.promo_aplicada := v_promo_text;
  NEW.promo_campaign := v_campaign;
  NEW.promo_discount_value := v_discount;
  IF v_original > 0 THEN
    NEW.promo_discount_percent := ROUND((v_discount / v_original) * 100.0, 2);
  END IF;
  NEW.price := GREATEST(v_original - v_discount, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_next_marketing_promo ON public.bookings;
CREATE TRIGGER trg_apply_next_marketing_promo
BEFORE INSERT OR UPDATE OF price, phone, starts_at, promo_aplicada
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.apply_next_marketing_promo_to_booking();

COMMENT ON FUNCTION public.apply_next_marketing_promo_to_booking IS
  'Aplica promoção da tabela log_envios_marketing apenas no próximo agendamento do cliente.';

-- 3) Atualiza RPC da área do cliente para retornar dados de promoção
DROP FUNCTION IF EXISTS public.get_customer_bookings(TEXT);

CREATE OR REPLACE FUNCTION public.get_customer_bookings(p_phone TEXT)
RETURNS TABLE (
  id UUID,
  starts_at TIMESTAMPTZ,
  status TEXT,
  customer_name TEXT,
  phone TEXT,
  price NUMERIC,
  original_price NUMERIC,
  promo_aplicada TEXT,
  promo_discount_value NUMERIC,
  promo_discount_percent NUMERIC,
  promo_campaign TEXT,
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
  v_normalized_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF length(v_normalized_phone) > 11 THEN
    v_normalized_phone := right(v_normalized_phone, 11);
  END IF;

  IF length(v_normalized_phone) <> 11 THEN
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
    b.original_price,
    b.promo_aplicada,
    b.promo_discount_value,
    b.promo_discount_percent,
    b.promo_campaign,
    b.payment_method::TEXT,
    b.duration_min,
    s.name AS service_name,
    br.name AS barber_name,
    br.id AS barber_id
  FROM public.bookings b
  LEFT JOIN public.services s ON s.id = b.service_id
  LEFT JOIN public.barbers br ON br.id = b.barber_id
  WHERE
    CASE
      WHEN length(regexp_replace(b.phone, '[^0-9]', '', 'g')) > 11
      THEN right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 11)
      ELSE regexp_replace(b.phone, '[^0-9]', '', 'g')
    END = v_normalized_phone
  ORDER BY b.starts_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_bookings(TEXT) TO anon, authenticated, public;

COMMIT;


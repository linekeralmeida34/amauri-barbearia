-- ============================================
-- Cupons de marketing com restrição por status_ia
-- Fonte de elegibilidade: vw_users_cluster
-- Validação por telefone do agendamento (bookings.phone)
-- ============================================

BEGIN;

-- Desativa trigger antiga de aplicação automática (se existir)
DROP TRIGGER IF EXISTS trg_apply_next_marketing_promo ON public.bookings;

-- Campos necessários em bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promo_aplicada TEXT,
  ADD COLUMN IF NOT EXISTS promo_discount_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promo_discount_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS promo_campaign TEXT,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_id UUID;

-- Tabela de cupons
CREATE TABLE IF NOT EXISTS public.marketing_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  required_status_ia TEXT NOT NULL,
  campaign_title TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NULL,
  max_uses_per_phone INTEGER NOT NULL DEFAULT 1 CHECK (max_uses_per_phone > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.marketing_coupons
  ADD COLUMN IF NOT EXISTS campaign_title TEXT NULL;

COMMENT ON TABLE public.marketing_coupons IS
  'Cupons de marketing com elegibilidade vinculada ao status_ia da vw_users_cluster.';
COMMENT ON COLUMN public.marketing_coupons.required_status_ia IS
  'Somente clientes com este status_ia podem usar o cupom.';

-- Função para validar cupom antes da confirmação no front
CREATE OR REPLACE FUNCTION public.validate_marketing_coupon(
  p_phone TEXT,
  p_coupon_code TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  message TEXT,
  coupon_code TEXT,
  discount_percent NUMERIC,
  campaign_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_status_ia TEXT;
  v_coupon public.marketing_coupons%ROWTYPE;
  v_uses INTEGER;
BEGIN
  v_phone := right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 11);
  IF length(v_phone) <> 11 THEN
    RETURN QUERY SELECT FALSE, 'Telefone inválido.', NULL::TEXT, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  SELECT *
    INTO v_coupon
  FROM public.marketing_coupons c
  WHERE upper(c.code) = upper(btrim(coalesce(p_coupon_code, '')))
    AND c.is_active = TRUE
    AND (c.expires_at IS NULL OR c.expires_at >= NOW())
  LIMIT 1;

  IF v_coupon.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Cupom inválido ou expirado.', NULL::TEXT, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  SELECT v.status_ia
    INTO v_status_ia
  FROM public.vw_users_cluster v
  WHERE right(regexp_replace(v.phone, '[^0-9]', '', 'g'), 11) = v_phone
  LIMIT 1;

  IF v_status_ia IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Cupom não elegível para este cliente.', NULL::TEXT, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF lower(btrim(v_status_ia)) <> lower(btrim(v_coupon.required_status_ia)) THEN
    RETURN QUERY SELECT FALSE, 'Cupom não permitido para o status deste cliente.', NULL::TEXT, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  SELECT count(*)
    INTO v_uses
  FROM public.bookings b
  WHERE b.coupon_id = v_coupon.id
    AND right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 11) = v_phone;

  IF v_uses >= v_coupon.max_uses_per_phone THEN
    RETURN QUERY SELECT FALSE, 'Cupom já utilizado no limite permitido.', NULL::TEXT, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    TRUE,
    format('Cupom %s válido.', upper(v_coupon.code)),
    upper(v_coupon.code),
    v_coupon.discount_percent,
    v_coupon.campaign_title;
END;
$$;

-- Função trigger para validar e aplicar cupom no booking
CREATE OR REPLACE FUNCTION public.apply_coupon_from_status_ia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_status_ia TEXT;
  v_coupon public.marketing_coupons%ROWTYPE;
  v_uses INTEGER;
  v_original NUMERIC;
  v_discount NUMERIC;
BEGIN
  -- Sem cupom: segue fluxo normal
  IF NEW.coupon_code IS NULL OR btrim(NEW.coupon_code) = '' THEN
    RETURN NEW;
  END IF;

  -- Campos mínimos
  IF NEW.phone IS NULL OR NEW.price IS NULL THEN
    RAISE EXCEPTION 'Cupom inválido: telefone e preço são obrigatórios para validação.';
  END IF;

  -- Normaliza telefone para 11 dígitos
  v_phone := right(regexp_replace(NEW.phone, '[^0-9]', '', 'g'), 11);
  IF length(v_phone) <> 11 THEN
    RAISE EXCEPTION 'Cupom inválido: telefone deve possuir 11 dígitos.';
  END IF;

  -- Busca cupom válido
  SELECT *
    INTO v_coupon
  FROM public.marketing_coupons c
  WHERE upper(c.code) = upper(btrim(NEW.coupon_code))
    AND c.is_active = TRUE
    AND (c.expires_at IS NULL OR c.expires_at >= NOW())
  LIMIT 1;

  IF v_coupon.id IS NULL THEN
    RAISE EXCEPTION 'Cupom inválido ou expirado.';
  END IF;

  -- Busca status_ia do cliente pela view usando o telefone normalizado
  SELECT v.status_ia
    INTO v_status_ia
  FROM public.vw_users_cluster v
  WHERE right(regexp_replace(v.phone, '[^0-9]', '', 'g'), 11) = v_phone
  LIMIT 1;

  IF v_status_ia IS NULL THEN
    RAISE EXCEPTION 'Cupom não elegível para este cliente.';
  END IF;

  IF lower(btrim(v_status_ia)) <> lower(btrim(v_coupon.required_status_ia)) THEN
    RAISE EXCEPTION 'Cupom não permitido para o status deste cliente.';
  END IF;

  -- Limite de uso por telefone
  SELECT count(*)
    INTO v_uses
  FROM public.bookings b
  WHERE b.coupon_id = v_coupon.id
    AND right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 11) = v_phone
    AND (TG_OP = 'INSERT' OR b.id <> NEW.id);

  IF v_uses >= v_coupon.max_uses_per_phone THEN
    RAISE EXCEPTION 'Cupom já utilizado no limite permitido para este telefone.';
  END IF;

  v_original := GREATEST(COALESCE(NEW.original_price, NEW.price), 0);
  v_discount := ROUND(v_original * (v_coupon.discount_percent / 100.0), 2);

  NEW.original_price := v_original;
  NEW.price := GREATEST(v_original - v_discount, 0);
  NEW.promo_aplicada := format('Cupom %s', upper(v_coupon.code));
  NEW.promo_discount_value := v_discount;
  NEW.promo_discount_percent := v_coupon.discount_percent;
  NEW.promo_campaign := COALESCE(v_coupon.campaign_title, format('status_ia=%s', v_coupon.required_status_ia));
  NEW.coupon_code := upper(v_coupon.code);
  NEW.coupon_id := v_coupon.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_coupon_from_status_ia ON public.bookings;
CREATE TRIGGER trg_apply_coupon_from_status_ia
BEFORE INSERT OR UPDATE OF coupon_code, phone, price
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.apply_coupon_from_status_ia();

COMMIT;


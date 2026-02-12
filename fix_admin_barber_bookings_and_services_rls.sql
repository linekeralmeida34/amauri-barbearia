-- ============================================
-- RLS: Admin vê todos os agendamentos; barbeiro vê apenas os seus.
-- Amauri (amauri@barbearia.com) é tratado como admin.
-- Também corrige alerta de RLS desabilitado em public.services.
-- Execute no SQL Editor do Supabase.
-- ============================================

-- --------- BOOKINGS ---------
-- Remove políticas existentes para evitar conflitos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'bookings' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', r.policyname);
  END LOOP;
END $$;

-- Habilita RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Permite criação pública de agendamentos
CREATE POLICY "Allow public insert bookings"
  ON public.bookings
  FOR INSERT
  WITH CHECK (true);

-- Helper inline: usuário autenticado é admin (barbers.is_admin) ou Amauri
-- Admin vê tudo; barbeiro vê apenas seus agendamentos
CREATE POLICY "Allow admin or own barber read bookings"
  ON public.bookings
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Admin (barbers.is_admin = true)
      EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.is_admin = true
      )
      -- Admin por email fixo (Amauri)
      OR lower(auth.jwt()->>'email') = 'amauri@barbearia.com'
      -- Barbeiro vê apenas seus agendamentos
      OR EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.id = public.bookings.barber_id
      )
    )
  );

-- Atualização: admin pode atualizar tudo; barbeiro apenas seus agendamentos
CREATE POLICY "Allow admin or own barber update bookings"
  ON public.bookings
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.is_admin = true
      )
      OR lower(auth.jwt()->>'email') = 'amauri@barbearia.com'
      OR EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.id = public.bookings.barber_id
      )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.is_admin = true
      )
      OR lower(auth.jwt()->>'email') = 'amauri@barbearia.com'
      OR EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.id = public.bookings.barber_id
      )
    )
  );

-- Cancelamento público (opcional) para área do cliente
CREATE POLICY "Allow customers to cancel their bookings"
  ON public.bookings
  FOR UPDATE
  USING (
    auth.uid() IS NULL
    AND status != 'canceled'
    AND starts_at > (NOW() + INTERVAL '2 hours')
    AND (canceled_by_admin IS NULL OR canceled_by_admin = false)
  )
  WITH CHECK (
    auth.uid() IS NULL
    AND status = 'canceled'
  );

-- --------- SERVICES ---------
-- Remove políticas existentes para evitar conflito
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'services' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.services', r.policyname);
  END LOOP;
END $$;

-- Habilita RLS em services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Leitura pública (necessária para vitrine/booking)
CREATE POLICY "Allow public read services"
  ON public.services
  FOR SELECT
  USING (true);

-- Admin pode gerenciar serviços
CREATE POLICY "Allow admin insert services"
  ON public.services
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.is_admin = true
      )
      OR lower(auth.jwt()->>'email') = 'amauri@barbearia.com'
    )
  );

CREATE POLICY "Allow admin update services"
  ON public.services
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.is_admin = true
      )
      OR lower(auth.jwt()->>'email') = 'amauri@barbearia.com'
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.is_admin = true
      )
      OR lower(auth.jwt()->>'email') = 'amauri@barbearia.com'
    )
  );

CREATE POLICY "Allow admin delete services"
  ON public.services
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.barbers br
        WHERE lower(br.email) = lower(auth.jwt()->>'email')
          AND br.is_admin = true
      )
      OR lower(auth.jwt()->>'email') = 'amauri@barbearia.com'
    )
  );

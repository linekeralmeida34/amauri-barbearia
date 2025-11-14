-- ============================================
-- Correção: impedir sobreposição ignorando agendamentos cancelados (via TRIGGER)
-- ============================================
-- Contexto:
-- - A função list_available_times já ignora bookings com status = 'canceled'
-- - Mas ainda existe (ou existia) uma constraint de overlap na tabela bookings
--   que não ignora cancelados, causando erro ao tentar agendar em horários
--   onde só há agendamentos cancelados.
--
-- Em vez de uma EXCLUDE CONSTRAINT (que exige funções 100% IMMUTABLE),
-- vamos controlar o overlap via TRIGGER, o que é mais flexível.

-- 1) Remover quaisquer constraints EXCLUDE de overlap existentes em bookings
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND contype = 'x' -- 'x' = EXCLUDE constraint
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Constraint EXCLUDE removida: %', constraint_name;
  END LOOP;
END $$;

-- 2) Criar função de trigger para impedir overlap apenas entre bookings não cancelados
CREATE OR REPLACE FUNCTION public.enforce_bookings_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conflict RECORD;
BEGIN
  -- Se o novo registro estiver cancelado, não precisa checar overlap
  IF NEW.status = 'canceled' THEN
    RETURN NEW;
  END IF;

  -- Garante duração mínima padrão (30 min) se não informado
  IF NEW.duration_min IS NULL OR NEW.duration_min <= 0 THEN
    NEW.duration_min := 30;
  END IF;

  -- Verifica se existe algum booking NÃO cancelado que se sobreponha
  SELECT 1
  INTO v_conflict
  FROM public.bookings b
  WHERE b.barber_id = NEW.barber_id
    AND b.id <> COALESCE(NEW.id, b.id) -- evita conflito consigo mesmo em UPDATE
    AND b.status IS DISTINCT FROM 'canceled'
    AND tstzrange(
          b.starts_at,
          b.starts_at + make_interval(mins => COALESCE(b.duration_min, 30)),
          '[)'
        ) &&
        tstzrange(
          NEW.starts_at,
          NEW.starts_at + make_interval(mins => COALESCE(NEW.duration_min, 30)),
          '[)'
        )
  LIMIT 1;

  IF FOUND THEN
    -- Usa código de erro 23P01 (exclusion_violation) e mensagem com 'bookings_no_overlap'
    -- para manter compatibilidade com o código do frontend (createBooking)
    RAISE EXCEPTION 'bookings_no_overlap: horário já reservado para este barbeiro.'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Criar trigger que chama a função antes de INSERT/UPDATE
DROP TRIGGER IF EXISTS bookings_no_overlap_trigger ON public.bookings;

CREATE TRIGGER bookings_no_overlap_trigger
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_bookings_no_overlap();

-- Comentário explicativo
COMMENT ON FUNCTION public.enforce_bookings_no_overlap IS
'Impede sobreposição de horários para o mesmo barbeiro, ignorando agendamentos cancelados. Lança erro 23P01 com texto bookings_no_overlap quando há conflito.';



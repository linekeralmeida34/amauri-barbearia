-- ============================================
-- Correção: Constraint de overlap que ignora agendamentos cancelados
-- ============================================
-- Este script remove a constraint antiga (se existir) e cria uma nova
-- que exclui agendamentos cancelados da verificação de sobreposição

-- Habilita extensão btree_gist se não estiver habilitada (necessária para EXCLUDE com UUID)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Remove constraint antiga se existir (pode ter nomes diferentes)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Procura por constraints EXCLUDE na tabela bookings
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND contype = 'x'  -- 'x' = EXCLUDE constraint
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Constraint removida: %', constraint_name;
  END LOOP;
END $$;

-- Cria a constraint EXCLUDE que só considera agendamentos não cancelados
-- A constraint verifica overlap apenas entre agendamentos do mesmo barbeiro
-- e que não estão cancelados
DO $$
BEGIN
  -- Remove se já existir
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.bookings'::regclass 
    AND conname = 'bookings_no_overlap_excluding_canceled'
  ) THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_no_overlap_excluding_canceled;
    RAISE NOTICE 'Constraint antiga removida';
  END IF;

  -- Cria constraint EXCLUDE que ignora cancelados
  ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap_excluding_canceled
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, starts_at + make_interval(mins => COALESCE(duration_min, 30)), '[)') WITH &&
  )
  WHERE (status IS DISTINCT FROM 'canceled');
  
  RAISE NOTICE 'Constraint criada com sucesso: bookings_no_overlap_excluding_canceled';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao criar constraint: % - %', SQLSTATE, SQLERRM;
    RAISE;
END $$;

-- Comentário explicativo
COMMENT ON CONSTRAINT bookings_no_overlap_excluding_canceled ON public.bookings IS 
'Garante que não há sobreposição de horários para o mesmo barbeiro, EXCETO para agendamentos cancelados. Agendamentos cancelados não bloqueiam novos agendamentos.';


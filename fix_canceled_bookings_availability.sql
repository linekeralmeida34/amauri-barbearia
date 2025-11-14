-- ============================================
-- Correção: Garantir que horários cancelados voltem para disponibilidade
-- ============================================
-- Este script verifica e atualiza a função list_available_times para garantir
-- que agendamentos com status 'canceled' não bloqueiem horários
--
-- IMPORTANTE: Este script usa a versão com horários dinâmicos (business_hours)
-- que é a versão mais recente e completa do sistema

DROP FUNCTION IF EXISTS public.list_available_times(uuid, date, integer);
CREATE OR REPLACE FUNCTION public.list_available_times(
  p_barber_id UUID,
  p_day DATE,
  p_duration_min INTEGER
)
RETURNS TABLE (slot TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tz TEXT := 'America/Sao_Paulo';
  v_day_start_local TIME;
  v_day_end_local   TIME;
  v_lunch_start     TIME;
  v_lunch_end       TIME;
  v_block_start     TIME := NULL;
  v_block_end       TIME := NULL;
  v_day_start_ts    TIMESTAMPTZ;
  v_day_end_ts      TIMESTAMPTZ;
BEGIN
  IF p_duration_min IS NULL OR p_duration_min <= 0 THEN
    RETURN;
  END IF;

  -- Busca horário de funcionamento do estabelecimento
  SELECT 
    COALESCE(open_time, TIME '09:00'),
    COALESCE(close_time, TIME '18:00'),
    lunch_start,
    lunch_end
  INTO v_day_start_local, v_day_end_local, v_lunch_start, v_lunch_end
  FROM public.business_hours
  LIMIT 1;
  
  -- Se não existir registro, usa valores padrão
  IF v_day_start_local IS NULL THEN
    v_day_start_local := TIME '09:00';
    v_day_end_local := TIME '18:00';
    v_lunch_start := TIME '12:00';
    v_lunch_end := TIME '13:00';
  END IF;

  -- Carrega bloqueio (dia específico ou global)
  SELECT b.start_time, b.end_time
  INTO v_block_start, v_block_end
  FROM public.barber_day_blocks b
  WHERE b.barber_id = p_barber_id AND (b.day = p_day OR b.day IS NULL)
  ORDER BY CASE WHEN b.day IS NULL THEN 2 ELSE 1 END
  LIMIT 1;

  -- Constrói início/fim do dia em timestamptz a partir do horário local
  v_day_start_ts := ((p_day::timestamp + v_day_start_local) AT TIME ZONE v_tz);
  v_day_end_ts   := ((p_day::timestamp + v_day_end_local)   AT TIME ZONE v_tz);

  RETURN QUERY
  WITH candidates AS (
    SELECT gs AS ts
    FROM generate_series(v_day_start_ts, v_day_end_ts, INTERVAL '15 minutes') AS gs
  ),
  labeled AS (
    SELECT 
      ts,
      ((ts AT TIME ZONE v_tz)::time) AS local_time,
      ((ts + make_interval(mins => p_duration_min)) AT TIME ZONE v_tz)::time AS local_time_end
    FROM candidates
  ),
  filtered_lunch AS (
    SELECT * FROM labeled
    -- Só aplica o filtro de almoço se ambos os horários forem não nulos
    WHERE (
      v_lunch_start IS NULL OR v_lunch_end IS NULL OR
      NOT (local_time >= v_lunch_start AND local_time < v_lunch_end)
    )
  ),
  filtered_block AS (
    SELECT * FROM filtered_lunch
    WHERE (
      v_block_start IS NULL OR v_block_end IS NULL OR
      NOT (local_time >= v_block_start AND local_time <= v_block_end)
    )
  ),
  without_overlap AS (
    SELECT f.*
    FROM filtered_block f
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.bookings bk
      WHERE bk.barber_id = p_barber_id
        AND DATE((bk.starts_at AT TIME ZONE v_tz)) = p_day
        -- IMPORTANTE: Exclui agendamentos cancelados da verificação de sobreposição
        -- Isso permite que horários cancelados voltem para disponibilidade
        AND (bk.status IS DISTINCT FROM 'canceled')
        AND tstzrange(bk.starts_at, bk.starts_at + make_interval(mins => COALESCE(bk.duration_min, p_duration_min)), '[)') &&
            tstzrange(f.ts, f.ts + make_interval(mins => p_duration_min), '[)')
    )
  )
  SELECT to_char(local_time, 'HH24:MI') AS slot
  FROM without_overlap
  -- Garante que o horário resultante caberá dentro do período de trabalho
  -- O serviço deve terminar antes ou no horário de fechamento
  WHERE (local_time + make_interval(mins => p_duration_min) <= v_day_end_local)
  GROUP BY slot
  ORDER BY slot;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.list_available_times IS 
'Lista horários disponíveis para agendamento. IMPORTANTE: Agendamentos com status "canceled" NÃO bloqueiam horários, permitindo que voltem para disponibilidade.';


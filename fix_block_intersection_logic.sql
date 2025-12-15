-- ============================================
-- Correção da lógica de interseção de bloqueios
-- ============================================
-- Problema: A lógica anterior bloqueava incorretamente horários que começavam
-- exatamente no fim de um bloqueio (ex: bloqueio 12:00-13:00 bloqueava serviço 13:00-13:45)
-- 
-- Solução: Usar a lógica correta de interseção de intervalos:
-- Dois intervalos se sobrepõem se: start1 < end2 AND start2 < end1
-- ============================================

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
    WHERE 
      -- Se não houver horário de almoço configurado, não filtramos nada
      v_lunch_start IS NULL OR v_lunch_end IS NULL OR
      -- Remove QUALQUER horário que tenha interseção com o intervalo de almoço
      -- (não apenas os que começam dentro do almoço)
      NOT (
        local_time < v_lunch_end
        AND local_time_end > v_lunch_start
      )
  ),
  filtered_block AS (
    SELECT f.*
    FROM filtered_lunch f
    WHERE NOT EXISTS (
      -- Verifica se o horário tem interseção com QUALQUER bloqueio (específico do dia ou global)
      -- Dois intervalos se sobrepõem se: start1 < end2 AND start2 < end1
      SELECT 1
      FROM public.barber_day_blocks bdb
      WHERE bdb.barber_id = p_barber_id
        AND (
          (bdb.day = p_day) OR
          (bdb.day IS NULL AND COALESCE(bdb.is_global, false) = true)
        )
        AND bdb.start_time IS NOT NULL
        AND bdb.end_time IS NOT NULL
        AND (
          -- Verifica interseção: os intervalos se sobrepõem se:
          -- serviço começa antes do bloqueio terminar E bloqueio começa antes do serviço terminar
          f.local_time < bdb.end_time
          AND bdb.start_time < f.local_time_end
        )
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
        AND (bk.status IS DISTINCT FROM 'canceled')
        AND tstzrange(bk.starts_at, bk.starts_at + make_interval(mins => COALESCE(bk.duration_min, p_duration_min)), '[)') && 
            tstzrange(f.ts, f.ts + make_interval(mins => p_duration_min), '[)')
    )
  )
  SELECT to_char(local_time, 'HH24:MI') AS slot
  FROM without_overlap
  -- Garante que o serviço cabe dentro do horário de funcionamento (não ultrapassa o fechamento)
  WHERE (local_time + make_interval(mins => p_duration_min)) <= v_day_end_local
  GROUP BY slot
  ORDER BY slot;
END;
$$;

COMMENT ON FUNCTION public.list_available_times IS 'Lista horários disponíveis para agendamento, considerando bloqueios e agendamentos existentes. Corrigida a lógica de interseção de bloqueios.';



-- ============================================
-- Função auxiliar: aplicar bloqueio em um PERÍODO de datas
-- ============================================
-- Esta função reutiliza a lógica e validações de set_barber_day_block,
-- aplicando o mesmo intervalo [p_start_hhmm, p_end_hhmm] para cada dia do
-- período informado, opcionalmente filtrando por dias da semana.
--
-- Uso típico (Supabase RPC):
--  select set_barber_day_block_range(
--    p_barber_id    := 'uuid-do-barbeiro',
--    p_start_date   := '2025-11-01',
--    p_end_date     := '2025-11-30',
--    p_start_hhmm   := '12:00',
--    p_end_hhmm     := '13:00',
--    p_weekdays     := ARRAY[1,2,3] -- opcional: 1=segunda ... 7=domingo (ISO)
--  );

CREATE OR REPLACE FUNCTION public.set_barber_day_block_range(
  p_barber_id   uuid,
  p_start_date  date,
  p_end_date    date,
  p_start_hhmm  time,
  p_end_hhmm    time,
  p_weekdays    int[] DEFAULT NULL  -- NULL => todos os dias
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  d date;
  v_dow int;
BEGIN
  IF p_barber_id IS NULL THEN
    RAISE EXCEPTION 'p_barber_id é obrigatório';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Período inválido: start_date=% e end_date=%', p_start_date, p_end_date;
  END IF;

  IF (p_start_hhmm IS NULL AND p_end_hhmm IS NOT NULL)
     OR (p_start_hhmm IS NOT NULL AND p_end_hhmm IS NULL) THEN
    RAISE EXCEPTION 'Ambos os horários (início e fim) devem ser preenchidos ou ambos vazios.';
  END IF;

  -- Se ambos são NULL, bloqueia o dia inteiro (00:00 até 23:59)
  IF p_start_hhmm IS NULL AND p_end_hhmm IS NULL THEN
    -- Define bloqueio de dia inteiro
    p_start_hhmm := TIME '00:00';
    p_end_hhmm := TIME '23:59';
  END IF;

  IF p_start_hhmm IS NOT NULL AND p_end_hhmm IS NOT NULL AND p_start_hhmm >= p_end_hhmm THEN
    RAISE EXCEPTION 'O horário de início deve ser menor que o horário de fim.';
  END IF;

  -- Se há dias da semana especificados, primeiro remove bloqueios de dias que NÃO estão na lista
  -- Isso garante que apenas os dias selecionados fiquem bloqueados
  IF p_weekdays IS NOT NULL AND array_length(p_weekdays, 1) > 0 THEN
    -- Remove bloqueios de dias específicos que não correspondem aos dias da semana selecionados
    -- dentro do período especificado
    DELETE FROM public.barber_day_blocks
    WHERE barber_id = p_barber_id
      AND day IS NOT NULL
      AND day >= p_start_date
      AND day <= p_end_date
      AND EXTRACT(ISODOW FROM day) != ALL(p_weekdays);
  END IF;

  d := p_start_date;
  WHILE d <= p_end_date LOOP
    v_dow := EXTRACT(ISODOW FROM d); -- 1=segunda ... 7=domingo

    -- Aplica bloqueio apenas nos dias selecionados (ou todos se p_weekdays for NULL)
    IF p_weekdays IS NULL OR v_dow = ANY(p_weekdays) THEN
      -- Reutiliza a função existente, que já faz validações e checa permissões
      PERFORM public.set_barber_day_block(
        p_barber_id   := p_barber_id,
        p_day         := d,
        p_start_hhmm  := p_start_hhmm,
        p_end_hhmm    := p_end_hhmm
      );
    END IF;

    d := d + INTERVAL '1 day';
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.set_barber_day_block_range IS
'Aplica bloqueio de horário para um barbeiro em um período de datas, opcionalmente filtrando por dias da semana (ISO 1=segunda..7=domingo). Reutiliza set_barber_day_block internamente.';



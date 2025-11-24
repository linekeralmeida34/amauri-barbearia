-- ============================================
-- Tabela para armazenar horário de funcionamento do estabelecimento
-- ============================================

CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_time TIME NOT NULL DEFAULT TIME '09:00', -- Horário de abertura (HH:MM)
  close_time TIME NOT NULL DEFAULT TIME '18:00', -- Horário de fechamento (HH:MM)
  lunch_start TIME DEFAULT TIME '12:00', -- Início do horário de almoço (opcional)
  lunch_end TIME DEFAULT TIME '13:00', -- Fim do horário de almoço (opcional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir valores padrão se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.business_hours) THEN
    INSERT INTO public.business_hours (open_time, close_time, lunch_start, lunch_end)
    VALUES (TIME '09:00', TIME '18:00', TIME '12:00', TIME '13:00');
  END IF;
END $$;

-- RLS (Row Level Security)
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins podem ler e modificar
DROP POLICY IF EXISTS "Allow admin access" ON public.business_hours;
CREATE POLICY "Allow admin access"
  ON public.business_hours
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR EXISTS (
      SELECT 1 FROM public.barbers
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR EXISTS (
      SELECT 1 FROM public.barbers
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_admin = true
    )
  );

-- ============================================
-- Função para obter horário de funcionamento
-- ============================================

CREATE OR REPLACE FUNCTION public.get_business_hours()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_open_time TIME;
  v_close_time TIME;
  v_lunch_start TIME;
  v_lunch_end TIME;
BEGIN
  SELECT open_time, close_time, lunch_start, lunch_end
  INTO v_open_time, v_close_time, v_lunch_start, v_lunch_end
  FROM public.business_hours
  LIMIT 1;

  -- Se não existir NENHUM registro, retorna valores padrão 09:00–18:00 e almoço 12–13
  IF v_open_time IS NULL AND v_close_time IS NULL AND v_lunch_start IS NULL AND v_lunch_end IS NULL THEN
    v_open_time := TIME '09:00';
    v_close_time := TIME '18:00';
    v_lunch_start := TIME '12:00';
    v_lunch_end := TIME '13:00';
  END IF;
 
  RETURN json_build_object(
    'open_time', COALESCE(v_open_time::text, '09:00'),
    'close_time', COALESCE(v_close_time::text, '18:00'),
    -- Para o almoço, se estiver NULL no banco queremos realmente retornar null (sem horário de almoço)
    'lunch_start', CASE WHEN v_lunch_start IS NOT NULL THEN v_lunch_start::text ELSE NULL END,
    'lunch_end',   CASE WHEN v_lunch_end   IS NOT NULL THEN v_lunch_end::text   ELSE NULL END
  );
END;
$$;

-- ============================================
-- Função para atualizar horário de funcionamento
-- ============================================

CREATE OR REPLACE FUNCTION public.set_business_hours(
  p_open_time TIME,
  p_close_time TIME,
  p_lunch_start TIME DEFAULT NULL,
  p_lunch_end TIME DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_is_admin BOOLEAN := false;
  v_barber_is_admin BOOLEAN := false;
BEGIN
  -- Obter email do usuário autenticado
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  -- Verificar se é admin na tabela admin_users
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ) INTO v_is_admin;
  
  -- Verificar se o barbeiro logado tem is_admin = true
  SELECT COALESCE(is_admin, false) INTO v_barber_is_admin
  FROM public.barbers
  WHERE email = v_user_email;
  
  -- Se não for admin, negar acesso
  IF NOT v_is_admin AND NOT v_barber_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o horário de funcionamento.';
  END IF;
  
  -- Validação: open_time deve ser menor que close_time
  IF p_open_time >= p_close_time THEN
    RAISE EXCEPTION 'O horário de abertura deve ser menor que o horário de fechamento.';
  END IF;
  
  -- Validação: se lunch_start ou lunch_end for fornecido, ambos devem ser fornecidos
  IF (p_lunch_start IS NOT NULL AND p_lunch_end IS NULL) OR 
     (p_lunch_start IS NULL AND p_lunch_end IS NOT NULL) THEN
    RAISE EXCEPTION 'Ambos os horários de almoço (início e fim) devem ser fornecidos ou ambos vazios.';
  END IF;
  
  -- Validação: lunch_start deve ser menor que lunch_end
  IF p_lunch_start IS NOT NULL AND p_lunch_end IS NOT NULL AND p_lunch_start >= p_lunch_end THEN
    RAISE EXCEPTION 'O horário de início do almoço deve ser menor que o horário de fim.';
  END IF;
  
  -- Upsert (insere se não existir, atualiza se existir)
  -- Como é singleton, sempre atualiza o primeiro registro ou insere se não existir
  IF EXISTS (SELECT 1 FROM public.business_hours) THEN
    -- Atualiza o primeiro registro
    UPDATE public.business_hours
    SET 
      open_time = p_open_time,
      close_time = p_close_time,
      lunch_start = p_lunch_start,
      lunch_end = p_lunch_end,
      updated_at = NOW()
    WHERE id = (SELECT id FROM public.business_hours LIMIT 1);
  ELSE
    -- Insere novo registro
    INSERT INTO public.business_hours (open_time, close_time, lunch_start, lunch_end, updated_at)
    VALUES (p_open_time, p_close_time, p_lunch_start, p_lunch_end, NOW());
  END IF;
END;
$$;

-- ============================================
-- Atualizar função list_available_times para usar horário de funcionamento dinâmico
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
    -- Para almoço, se estiver NULL não queremos forçar 12:00/13:00,
    -- pois isso significaria "sem horário de almoço"
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
    -- Só aplica o filtro de almoço se ambos os horários forem não nulos.
    -- Removemos QUALQUER horário que tenha interseção com o intervalo de almoço,
    -- não apenas os que começam dentro do almoço.
    WHERE (
      v_lunch_start IS NULL OR v_lunch_end IS NULL OR
      NOT (
        local_time < v_lunch_end
        AND local_time_end > v_lunch_start
      )
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
        AND (bk.status IS DISTINCT FROM 'canceled')
        AND tstzrange(bk.starts_at, bk.starts_at + make_interval(mins => COALESCE(bk.duration_min, p_duration_min)), '[)') &&
            tstzrange(f.ts, f.ts + make_interval(mins => p_duration_min), '[)')
    )
  )
  SELECT to_char(local_time, 'HH24:MI') AS slot
  FROM without_overlap
  -- Garante que o horário resultante caberá dentro do período de trabalho (não passar do fim ao somar a duração)
  -- Ajusta para considerar a duração do serviço: o serviço deve terminar antes ou no horário de fechamento
  WHERE (local_time + make_interval(mins => p_duration_min) <= v_day_end_local)
  GROUP BY slot
  ORDER BY slot;
END;
$$;

-- Comentários para documentação
COMMENT ON TABLE public.business_hours IS 'Armazena horário de funcionamento do estabelecimento (singleton)';
COMMENT ON FUNCTION public.get_business_hours IS 'Retorna horário de funcionamento do estabelecimento (JSON)';
COMMENT ON FUNCTION public.set_business_hours IS 'Atualiza horário de funcionamento do estabelecimento (apenas admins)';


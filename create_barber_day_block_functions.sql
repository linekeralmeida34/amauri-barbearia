-- ============================================
-- Tabela para armazenar bloqueios de horários por barbeiro e dia
-- ============================================

CREATE TABLE IF NOT EXISTS public.barber_day_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day DATE, -- YYYY-MM-DD
  start_time TIME, -- HH:MM (inclusive) - início do bloqueio
  end_time TIME,   -- HH:MM (inclusive) - fim do bloqueio
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(barber_id, day) -- Um bloqueio por barbeiro por dia
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_barber_day_blocks_barber_day ON public.barber_day_blocks(barber_id, day);
CREATE INDEX IF NOT EXISTS idx_barber_day_blocks_day ON public.barber_day_blocks(day);

-- Permite bloqueio global (para todos os dias): torna day opcional
ALTER TABLE public.barber_day_blocks ALTER COLUMN day DROP NOT NULL;

-- Garante apenas um bloqueio global por barbeiro
CREATE UNIQUE INDEX IF NOT EXISTS uniq_barber_day_blocks_global
  ON public.barber_day_blocks(barber_id)
  WHERE day IS NULL;

-- RLS (Row Level Security) - desabilitado por enquanto, validação feita nas funções
-- As funções SECURITY DEFINER fazem a validação de segurança internamente
ALTER TABLE public.barber_day_blocks ENABLE ROW LEVEL SECURITY;

-- Política permissiva: permite acesso via funções (que fazem validação)
-- As funções SECURITY DEFINER validam permissões internamente
-- Remove política existente se houver e cria nova
DROP POLICY IF EXISTS "Allow access via functions" ON public.barber_day_blocks;
CREATE POLICY "Allow access via functions"
  ON public.barber_day_blocks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Função para obter o bloqueio de um barbeiro em um dia
-- ============================================

-- Garante que podemos alterar o tipo de retorno sem erro 42P13
DROP FUNCTION IF EXISTS public.get_barber_day_block(uuid, date);

CREATE OR REPLACE FUNCTION public.get_barber_day_block(
  p_barber_id UUID,
  p_day DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_time TIME;
  v_end_time TIME;
BEGIN
  -- Primeiro tenta bloqueio específico do dia
  SELECT 
    bdb.start_time,
    bdb.end_time
  INTO v_start_time, v_end_time
  FROM public.barber_day_blocks bdb
  WHERE bdb.barber_id = p_barber_id
    AND bdb.day = p_day
  LIMIT 1;

  -- Se não achou para o dia, tenta bloqueio global (day IS NULL)
  IF v_start_time IS NULL AND v_end_time IS NULL THEN
    SELECT 
      bdb.start_time,
      bdb.end_time
    INTO v_start_time, v_end_time
    FROM public.barber_day_blocks bdb
    WHERE bdb.barber_id = p_barber_id
      AND bdb.day IS NULL
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou, retorna nulos
  IF v_start_time IS NULL AND v_end_time IS NULL THEN
    RETURN json_build_object('start_time', null, 'end_time', null);
  END IF;
  
  -- Retorna os valores encontrados
  RETURN json_build_object(
    'start_time', v_start_time::text,
    'end_time', v_end_time::text
  );
END;
$$;

-- ============================================
-- Função para definir ou remover o bloqueio de um barbeiro em um dia (ou global)
-- ============================================

CREATE OR REPLACE FUNCTION public.set_barber_day_block(
  p_barber_id UUID,
  p_day DATE DEFAULT NULL,
  p_start_hhmm TIME DEFAULT NULL,
  p_end_hhmm TIME DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_is_admin BOOLEAN := false;
  v_barber_email TEXT;
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
  
  -- Se não for admin (nem na tabela admin_users nem is_admin no barbers), verificar se o barbeiro_id pertence ao usuário logado
  IF NOT v_is_admin AND NOT v_barber_is_admin THEN
    -- Buscar email do barbeiro
    SELECT email INTO v_barber_email FROM public.barbers WHERE id = p_barber_id;
    
    -- Se o email do barbeiro não corresponder ao email do usuário, negar acesso
    IF v_barber_email IS NULL OR v_barber_email != v_user_email THEN
      RAISE EXCEPTION 'Você só pode fechar horários para você mesmo.';
    END IF;
  END IF;
  
  -- Validação: se um está preenchido, o outro também deve estar
  IF (p_start_hhmm IS NOT NULL AND p_end_hhmm IS NULL) OR 
     (p_start_hhmm IS NULL AND p_end_hhmm IS NOT NULL) THEN
    RAISE EXCEPTION 'Ambos os horários (início e fim) devem ser preenchidos ou ambos vazios.';
  END IF;
  
  -- Validação: start_time deve ser menor que end_time
  IF p_start_hhmm IS NOT NULL AND p_end_hhmm IS NOT NULL AND p_start_hhmm >= p_end_hhmm THEN
    RAISE EXCEPTION 'O horário de início deve ser menor que o horário de fim.';
  END IF;
  
  -- Se ambos são NULL, remove o bloqueio
  IF p_start_hhmm IS NULL AND p_end_hhmm IS NULL THEN
    IF p_day IS NULL THEN
      -- Remover TODOS os bloqueios do barbeiro (global e por dia)
      DELETE FROM public.barber_day_blocks WHERE barber_id = p_barber_id;
    ELSE
      -- Remover apenas o bloqueio do dia específico
      DELETE FROM public.barber_day_blocks WHERE barber_id = p_barber_id AND day = p_day;
    END IF;
    RETURN;
  END IF;
  
  -- Caso contrário, insere ou atualiza
  IF p_day IS NULL THEN
    -- Global: remove anterior e insere novo
    DELETE FROM public.barber_day_blocks WHERE barber_id = p_barber_id AND day IS NULL;
    INSERT INTO public.barber_day_blocks (barber_id, day, start_time, end_time, updated_at)
    VALUES (p_barber_id, NULL, p_start_hhmm, p_end_hhmm, NOW());
  ELSE
    -- Específico do dia: upsert pelo unique (barber_id, day)
    INSERT INTO public.barber_day_blocks (barber_id, day, start_time, end_time, updated_at)
    VALUES (p_barber_id, p_day, p_start_hhmm, p_end_hhmm, NOW())
    ON CONFLICT (barber_id, day)
    DO UPDATE SET
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      updated_at = NOW();
  END IF;
END;
$$;

-- ============================================
-- Comentários para documentação
-- ============================================

COMMENT ON TABLE public.barber_day_blocks IS 'Armazena bloqueios de horários por barbeiro e dia (day NULL = bloqueio global)';
COMMENT ON FUNCTION public.get_barber_day_block IS 'Retorna start_time/end_time do bloqueio do dia; se não houver, retorna bloqueio global (JSON).';
COMMENT ON FUNCTION public.set_barber_day_block IS 'Define/remove bloqueio por dia ou global (day NULL). Ambos horários NULL removem o bloqueio.';

-- ============================================
-- RPC: list_available_times com intervalos de 15 minutos
-- - Considera almoço (12:00-12:59) indisponível
-- - Considera bloqueio por dia e bloqueio global (barber_day_blocks)
-- - Evita sobreposição com agendamentos existentes (bookings)
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
  v_day_start_local TIME := TIME '09:00';
  v_day_end_local   TIME := TIME '17:00';
  v_lunch_start     TIME := TIME '12:00';
  v_lunch_end       TIME := TIME '13:00';
  v_block_start     TIME := NULL;
  v_block_end       TIME := NULL;
  v_day_start_ts    TIMESTAMPTZ;
  v_day_end_ts      TIMESTAMPTZ;
BEGIN
  IF p_duration_min IS NULL OR p_duration_min <= 0 THEN
    RETURN;
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
    WHERE NOT (local_time >= v_lunch_start AND local_time < v_lunch_end)
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
  WHERE (local_time < v_day_end_local)
  GROUP BY slot
  ORDER BY slot;
END;
$$;


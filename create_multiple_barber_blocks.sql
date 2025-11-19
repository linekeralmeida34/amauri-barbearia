-- ============================================
-- Suporte a Múltiplos Fechamentos por Barbeiro
-- Permite que um barbeiro tenha vários bloqueios no mesmo dia
-- ============================================

-- 1. Remove constraints que impedem múltiplos bloqueios
DROP INDEX IF EXISTS uniq_barber_day_blocks_global;
ALTER TABLE public.barber_day_blocks DROP CONSTRAINT IF EXISTS barber_day_blocks_barber_id_day_key;

-- 2. Adiciona campo "name" para identificar cada fechamento (opcional)
ALTER TABLE public.barber_day_blocks 
ADD COLUMN IF NOT EXISTS name TEXT;

-- 3. Adiciona campo "is_global" para identificar bloqueios globais (todos os dias)
ALTER TABLE public.barber_day_blocks 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- 4. Atualiza registros existentes para marcar como global se day IS NULL
UPDATE public.barber_day_blocks 
SET is_global = true 
WHERE day IS NULL;

-- ============================================
-- Função para listar TODOS os bloqueios de um barbeiro em um dia
-- ============================================

DROP FUNCTION IF EXISTS public.get_barber_day_blocks(uuid, date);
CREATE OR REPLACE FUNCTION public.get_barber_day_blocks(
  p_barber_id UUID,
  p_day DATE
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  start_time TIME,
  end_time TIME,
  day DATE,
  is_global BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bdb.id,
    bdb.name,
    bdb.start_time,
    bdb.end_time,
    bdb.day,
    COALESCE(bdb.is_global, false) as is_global,
    bdb.created_at
  FROM public.barber_day_blocks bdb
  WHERE bdb.barber_id = p_barber_id
    AND (
      -- Bloqueios específicos do dia
      bdb.day = p_day
      OR
      -- Bloqueios globais (aplicam a todos os dias)
      (bdb.day IS NULL AND COALESCE(bdb.is_global, false) = true)
    )
  ORDER BY 
    CASE WHEN bdb.day IS NULL THEN 0 ELSE 1 END, -- Globais primeiro
    bdb.start_time;
END;
$$;

-- ============================================
-- Função para adicionar um novo bloqueio
-- ============================================

DROP FUNCTION IF EXISTS public.add_barber_day_block(uuid, date, time, time, text, boolean);
CREATE OR REPLACE FUNCTION public.add_barber_day_block(
  p_barber_id UUID,
  p_day DATE DEFAULT NULL,
  p_start_hhmm TIME DEFAULT NULL,
  p_end_hhmm TIME DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_is_global BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_is_admin BOOLEAN := false;
  v_barber_email TEXT;
  v_barber_is_admin BOOLEAN := false;
  v_block_id UUID;
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
  
  -- Se não for admin, verificar se o barbeiro_id pertence ao usuário logado
  IF NOT v_is_admin AND NOT v_barber_is_admin THEN
    SELECT email INTO v_barber_email FROM public.barbers WHERE id = p_barber_id;
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
  
  -- Se ambos são NULL, não pode criar bloqueio
  IF p_start_hhmm IS NULL AND p_end_hhmm IS NULL THEN
    RAISE EXCEPTION 'É necessário informar horário de início e fim.';
  END IF;
  
  -- Se is_global = true, day deve ser NULL
  IF p_is_global = true AND p_day IS NOT NULL THEN
    RAISE EXCEPTION 'Bloqueios globais não podem ter dia específico.';
  END IF;
  
  -- Insere o novo bloqueio
  INSERT INTO public.barber_day_blocks (
    barber_id, 
    day, 
    start_time, 
    end_time, 
    name,
    is_global,
    updated_at
  )
  VALUES (
    p_barber_id, 
    CASE WHEN p_is_global THEN NULL ELSE p_day END, 
    p_start_hhmm, 
    p_end_hhmm,
    p_name,
    p_is_global,
    NOW()
  )
  RETURNING id INTO v_block_id;
  
  RETURN v_block_id;
END;
$$;

-- ============================================
-- Função para remover um bloqueio específico
-- ============================================

DROP FUNCTION IF EXISTS public.remove_barber_day_block(uuid);
CREATE OR REPLACE FUNCTION public.remove_barber_day_block(
  p_block_id UUID
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
  v_block_barber_id UUID;
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
  
  -- Buscar barber_id do bloqueio
  SELECT barber_id INTO v_block_barber_id
  FROM public.barber_day_blocks
  WHERE id = p_block_id;
  
  IF v_block_barber_id IS NULL THEN
    RAISE EXCEPTION 'Bloqueio não encontrado.';
  END IF;
  
  -- Se não for admin, verificar se o barbeiro_id pertence ao usuário logado
  IF NOT v_is_admin AND NOT v_barber_is_admin THEN
    SELECT email INTO v_barber_email FROM public.barbers WHERE id = v_block_barber_id;
    IF v_barber_email IS NULL OR v_barber_email != v_user_email THEN
      RAISE EXCEPTION 'Você só pode remover seus próprios bloqueios.';
    END IF;
  END IF;
  
  -- Remove o bloqueio
  DELETE FROM public.barber_day_blocks WHERE id = p_block_id;
END;
$$;

-- ============================================
-- Atualiza função set_barber_day_block para suportar múltiplos bloqueios
-- ============================================

DROP FUNCTION IF EXISTS public.set_barber_day_block(uuid, date, time, time);
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
      -- Remover TODOS os bloqueios globais do barbeiro
      DELETE FROM public.barber_day_blocks WHERE barber_id = p_barber_id AND day IS NULL;
    ELSE
      -- Remover TODOS os bloqueios do dia específico
      DELETE FROM public.barber_day_blocks WHERE barber_id = p_barber_id AND day = p_day;
    END IF;
    RETURN;
  END IF;
  
  -- Caso contrário, insere novo bloqueio (permite múltiplos)
  IF p_day IS NULL THEN
    -- Global: remove todos os globais anteriores e insere novo
    DELETE FROM public.barber_day_blocks WHERE barber_id = p_barber_id AND day IS NULL;
    INSERT INTO public.barber_day_blocks (barber_id, day, start_time, end_time, is_global, updated_at)
    VALUES (p_barber_id, NULL, p_start_hhmm, p_end_hhmm, true, NOW());
  ELSE
    -- Específico do dia: insere novo (permite múltiplos no mesmo dia)
    INSERT INTO public.barber_day_blocks (barber_id, day, start_time, end_time, is_global, updated_at)
    VALUES (p_barber_id, p_day, p_start_hhmm, p_end_hhmm, false, NOW());
  END IF;
END;
$$;

-- ============================================
-- Atualiza função get_barber_day_block para manter compatibilidade
-- (retorna o primeiro bloqueio encontrado, para não quebrar código existente)
-- ============================================

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
  ORDER BY bdb.start_time
  LIMIT 1;

  -- Se não achou para o dia, tenta bloqueio global (is_global = true)
  IF v_start_time IS NULL AND v_end_time IS NULL THEN
    SELECT 
      bdb.start_time,
      bdb.end_time
    INTO v_start_time, v_end_time
    FROM public.barber_day_blocks bdb
    WHERE bdb.barber_id = p_barber_id
      AND COALESCE(bdb.is_global, false) = true
      AND bdb.day IS NULL
    ORDER BY bdb.start_time
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
-- Atualiza função list_available_times para considerar TODOS os bloqueios
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
    WHERE NOT (local_time >= v_lunch_start AND local_time < v_lunch_end)
  ),
  filtered_block AS (
    SELECT f.*
    FROM filtered_lunch f
    WHERE NOT EXISTS (
      -- Verifica se o horário está dentro de QUALQUER bloqueio (específico do dia ou global)
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
          -- O horário de início está dentro do bloqueio
          (f.local_time >= bdb.start_time AND f.local_time <= bdb.end_time)
          OR
          -- O horário de fim está dentro do bloqueio
          (f.local_time_end >= bdb.start_time AND f.local_time_end <= bdb.end_time)
          OR
          -- O bloqueio está completamente dentro do horário do serviço
          (bdb.start_time >= f.local_time AND bdb.end_time <= f.local_time_end)
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

-- ============================================
-- Comentários para documentação
-- ============================================

COMMENT ON FUNCTION public.get_barber_day_blocks IS 'Retorna TODOS os bloqueios de um barbeiro em um dia (incluindo globais)';
COMMENT ON FUNCTION public.add_barber_day_block IS 'Adiciona um novo bloqueio para um barbeiro. Retorna o ID do bloqueio criado.';
COMMENT ON FUNCTION public.remove_barber_day_block IS 'Remove um bloqueio específico pelo ID.';


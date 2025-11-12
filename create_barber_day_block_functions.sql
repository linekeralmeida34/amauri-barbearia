-- ============================================
-- Tabela para armazenar bloqueios de horários por barbeiro e dia
-- ============================================

CREATE TABLE IF NOT EXISTS public.barber_day_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day DATE NOT NULL, -- YYYY-MM-DD
  start_time TIME, -- HH:MM (inclusive) - início do bloqueio
  end_time TIME,   -- HH:MM (inclusive) - fim do bloqueio
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(barber_id, day) -- Um bloqueio por barbeiro por dia
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_barber_day_blocks_barber_day ON public.barber_day_blocks(barber_id, day);
CREATE INDEX IF NOT EXISTS idx_barber_day_blocks_day ON public.barber_day_blocks(day);

-- RLS (Row Level Security) - permite que barbeiros vejam seus próprios bloqueios
ALTER TABLE public.barber_day_blocks ENABLE ROW LEVEL SECURITY;

-- Política: barbeiros podem ver seus próprios bloqueios
CREATE POLICY "Barbers can view their own blocks"
  ON public.barber_day_blocks
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.barbers WHERE id = barber_id
    )
  );

-- Política: admins podem ver todos os bloqueios
CREATE POLICY "Admins can view all blocks"
  ON public.barber_day_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Política: barbeiros podem inserir/atualizar seus próprios bloqueios
CREATE POLICY "Barbers can manage their own blocks"
  ON public.barber_day_blocks
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.barbers WHERE id = barber_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.barbers WHERE id = barber_id
    )
  );

-- Política: admins podem gerenciar todos os bloqueios
CREATE POLICY "Admins can manage all blocks"
  ON public.barber_day_blocks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Função para obter o bloqueio de um barbeiro em um dia
-- ============================================

CREATE OR REPLACE FUNCTION public.get_barber_day_block(
  p_barber_id UUID,
  p_day DATE
)
RETURNS TABLE (
  start_time TIME,
  end_time TIME
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bdb.start_time,
    bdb.end_time
  FROM public.barber_day_blocks bdb
  WHERE bdb.barber_id = p_barber_id
    AND bdb.day = p_day
  LIMIT 1;
  
  -- Se não encontrou, retorna NULL
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TIME, NULL::TIME;
  END IF;
END;
$$;

-- ============================================
-- Função para definir ou remover o bloqueio de um barbeiro em um dia
-- ============================================

CREATE OR REPLACE FUNCTION public.set_barber_day_block(
  p_barber_id UUID,
  p_day DATE,
  p_start_hhmm TIME DEFAULT NULL,
  p_end_hhmm TIME DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    DELETE FROM public.barber_day_blocks
    WHERE barber_id = p_barber_id AND day = p_day;
    RETURN;
  END IF;
  
  -- Caso contrário, insere ou atualiza (UPSERT)
  INSERT INTO public.barber_day_blocks (barber_id, day, start_time, end_time, updated_at)
  VALUES (p_barber_id, p_day, p_start_hhmm, p_end_hhmm, NOW())
  ON CONFLICT (barber_id, day)
  DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    updated_at = NOW();
END;
$$;

-- ============================================
-- Comentários para documentação
-- ============================================

COMMENT ON TABLE public.barber_day_blocks IS 'Armazena bloqueios de horários por barbeiro e dia';
COMMENT ON FUNCTION public.get_barber_day_block IS 'Retorna o intervalo de bloqueio (start_time, end_time) para um barbeiro em um dia específico';
COMMENT ON FUNCTION public.set_barber_day_block IS 'Define ou remove o bloqueio de horários para um barbeiro em um dia. Se ambos os horários forem NULL, remove o bloqueio.';


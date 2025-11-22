-- ============================================
-- Script para otimizar performance da função list_available_times
-- Adiciona índices nas tabelas consultadas para acelerar as queries
-- ============================================

-- 1. Índice na tabela bookings (usado para verificar sobreposição)
-- Índice composto para consultas por barbeiro e status
-- Nota: A data é calculada na query, então não podemos indexar diretamente
CREATE INDEX IF NOT EXISTS idx_bookings_barber_status 
ON public.bookings(barber_id, status)
WHERE status IS DISTINCT FROM 'canceled';

-- Índice para starts_at (usado nas queries de range)
CREATE INDEX IF NOT EXISTS idx_bookings_starts_at 
ON public.bookings(starts_at)
WHERE status IS DISTINCT FROM 'canceled';

-- Índice para duration_min (usado nas queries)
CREATE INDEX IF NOT EXISTS idx_bookings_duration_min 
ON public.bookings(duration_min)
WHERE status IS DISTINCT FROM 'canceled';

-- 2. Índice na tabela barber_day_blocks (usado para verificar bloqueios)
-- Índice composto para consultas por barbeiro e dia
CREATE INDEX IF NOT EXISTS idx_barber_day_blocks_barber_day 
ON public.barber_day_blocks(barber_id, day, is_global);

-- Índice para bloqueios globais (is_global = true)
CREATE INDEX IF NOT EXISTS idx_barber_day_blocks_global 
ON public.barber_day_blocks(barber_id, is_global)
WHERE is_global = true;

-- 3. Índice na tabela business_hours (usado para buscar horário de funcionamento)
-- Como geralmente há apenas 1 registro, não precisa de índice, mas vamos garantir
CREATE INDEX IF NOT EXISTS idx_business_hours_single 
ON public.business_hours(id)
WHERE id IS NOT NULL;

-- 4. Análise das tabelas para atualizar estatísticas do PostgreSQL
ANALYZE public.bookings;
ANALYZE public.barber_day_blocks;
ANALYZE public.business_hours;

-- Comentários explicativos
COMMENT ON INDEX idx_bookings_barber_status IS 
'Índice para acelerar consultas de agendamentos por barbeiro e status (exclui cancelados)';

COMMENT ON INDEX idx_bookings_starts_at IS 
'Índice para acelerar consultas por starts_at (usado para filtrar por data)';

COMMENT ON INDEX idx_bookings_duration_min IS 
'Índice para acelerar consultas por duração do serviço';

COMMENT ON INDEX idx_barber_day_blocks_barber_day IS 
'Índice para acelerar consultas de bloqueios por barbeiro e dia';

COMMENT ON INDEX idx_barber_day_blocks_global IS 
'Índice para acelerar consultas de bloqueios globais por barbeiro';


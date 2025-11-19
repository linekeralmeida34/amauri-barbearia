-- Script para testar e verificar bloqueios de um barbeiro em um dia específico

-- 1. Ver todos os bloqueios do barbeiro Ronaldo no dia 21/11/2025
-- Substitua o UUID do barbeiro e a data conforme necessário
SELECT 
  id,
  name,
  start_time,
  end_time,
  day,
  is_global,
  created_at
FROM public.barber_day_blocks
WHERE barber_id = (
  SELECT id FROM public.barbers WHERE name ILIKE '%ronaldo%' LIMIT 1
)
AND (
  day = '2025-11-21'::date
  OR (day IS NULL AND COALESCE(is_global, false) = true)
)
ORDER BY 
  CASE WHEN day IS NULL THEN 0 ELSE 1 END,
  start_time;

-- 2. Testar a função list_available_times para ver quais horários estão disponíveis
-- Substitua o UUID do barbeiro conforme necessário
SELECT slot
FROM public.list_available_times(
  (SELECT id FROM public.barbers WHERE name ILIKE '%ronaldo%' LIMIT 1),
  '2025-11-21'::date,
  30  -- duração em minutos (ajuste conforme necessário)
)
ORDER BY slot;


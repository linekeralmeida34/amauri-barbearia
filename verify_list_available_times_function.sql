-- ============================================
-- Script de Verificação: Verificar função list_available_times atual
-- ============================================
-- Este script verifica se a função list_available_times está corretamente
-- configurada para excluir agendamentos cancelados

-- Verifica se a função existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
      AND p.proname = 'list_available_times'
    ) THEN '✓ Função existe'
    ELSE '✗ Função NÃO existe'
  END AS status_funcao;

-- Mostra a definição da função (últimas linhas relevantes)
SELECT 
  pg_get_functiondef(oid) AS definicao_completa
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'list_available_times'
AND pg_get_function_arguments(oid) = 'p_barber_id uuid, p_day date, p_duration_min integer';

-- Verifica se a função contém o filtro de canceled
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
      AND p.proname = 'list_available_times'
      AND pg_get_functiondef(oid) LIKE '%status IS DISTINCT FROM ''canceled''%'
    ) THEN '✓ Filtro de canceled está presente'
    ELSE '✗ Filtro de canceled NÃO está presente - PRECISA CORRIGIR!'
  END AS status_filtro_canceled;

-- Verifica se usa horários dinâmicos (business_hours)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
      AND p.proname = 'list_available_times'
      AND pg_get_functiondef(oid) LIKE '%FROM public.business_hours%'
    ) THEN '✓ Usa horários dinâmicos (business_hours)'
    ELSE '⚠ Usa horários fixos (pode ser versão antiga)'
  END AS status_horarios;


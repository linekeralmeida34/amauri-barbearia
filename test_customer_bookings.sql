-- ============================================
-- Script de Teste: Verificar agendamentos e formato de telefones
-- Execute este script para diagnosticar o problema
-- ============================================

-- 1. Verifica quantos agendamentos existem no total
SELECT COUNT(*) as total_agendamentos FROM public.bookings;

-- 2. Mostra alguns exemplos de telefones no banco (primeiros 10)
SELECT 
  id,
  customer_name,
  phone,
  length(phone) as tamanho_telefone,
  regexp_replace(phone, '[^0-9]', '', 'g') as telefone_somente_numeros,
  length(regexp_replace(phone, '[^0-9]', '', 'g')) as tamanho_numeros,
  starts_at,
  status
FROM public.bookings
ORDER BY created_at DESC
LIMIT 10;

-- 3. Testa a função RPC com um telefone específico
-- Substitua '83987267814' pelo telefone que você quer testar
SELECT * FROM public.get_customer_bookings('83987267814');

-- 4. Verifica se há agendamentos com telefone similar (últimos 11 dígitos)
-- Substitua '83987267814' pelo telefone que você quer testar
SELECT 
  id,
  customer_name,
  phone,
  CASE 
    WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) > 11 
    THEN right(regexp_replace(phone, '[^0-9]', '', 'g'), 11)
    ELSE regexp_replace(phone, '[^0-9]', '', 'g')
  END as telefone_normalizado,
  starts_at,
  status
FROM public.bookings
WHERE 
  CASE 
    WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) > 11 
    THEN right(regexp_replace(phone, '[^0-9]', '', 'g'), 11)
    ELSE regexp_replace(phone, '[^0-9]', '', 'g')
  END = '83987267814'
ORDER BY starts_at DESC;


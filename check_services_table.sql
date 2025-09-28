-- Verificar se a tabela services existe
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_name = 'services'
) as services_table_exists;

-- Verificar estrutura da tabela services
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'services' 
ORDER BY ordinal_position;

-- Verificar se a coluna is_active existe
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'services' 
  AND column_name = 'is_active'
) as has_is_active_column;

-- Verificar dados da tabela services
SELECT id, name, duration_min, price, is_active, created_at 
FROM services 
ORDER BY name;

-- Contar serviços ativos
SELECT COUNT(*) as total_services,
       COUNT(CASE WHEN is_active = true THEN 1 END) as active_services
FROM services;

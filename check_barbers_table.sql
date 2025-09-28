-- Verificar estrutura da tabela barbers
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'barbers' 
ORDER BY ordinal_position;

-- Verificar se a coluna is_active existe
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'barbers' 
  AND column_name = 'is_active'
) as has_is_active_column;

-- Se não existir, criar a coluna is_active
-- ALTER TABLE barbers ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Verificar dados da tabela barbers
SELECT id, name, is_active, created_at 
FROM barbers 
LIMIT 5;

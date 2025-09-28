-- Adicionar coluna email na tabela barbers
-- Execute este script no Supabase SQL Editor

-- Adicionar coluna email na tabela barbers
ALTER TABLE barbers 
ADD COLUMN email TEXT UNIQUE;

-- Comentário para documentar a coluna
COMMENT ON COLUMN barbers.email IS 'E-mail do barbeiro para login';

-- Atualizar registros existentes com emails de exemplo (ajuste conforme necessário)
-- UPDATE barbers SET email = 'amauri@barbearia.com' WHERE name ILIKE '%amauri%';
-- UPDATE barbers SET email = 'carlos@barbearia.com' WHERE name ILIKE '%carlos%';
-- UPDATE barbers SET email = 'ronaldo@barbearia.com' WHERE name ILIKE '%ronaldo%';

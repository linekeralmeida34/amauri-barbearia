-- Inserir serviços de exemplo na tabela services
-- Primeiro, verificar se a tabela existe e criar se necessário

-- Criar tabela services se não existir
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL DEFAULT 30,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir serviços de exemplo (apenas se a tabela estiver vazia)
INSERT INTO services (name, description, duration_min, price, category, popular, is_active)
SELECT * FROM (VALUES
  ('Corte Tradicional', 'Corte clássico masculino com acabamento na navalha', 30, 35.00, 'Cortes', false, true),
  ('Corte + Barba', 'Corte completo com modelagem e acabamento da barba', 45, 55.00, 'Combos', true, true),
  ('Barba Completa', 'Modelagem, corte e hidratação da barba', 25, 25.00, 'Barba', false, true),
  ('Corte Premium', 'Corte premium com lavagem, massagem e acabamento', 60, 75.00, 'Premium', false, true),
  ('Tratamento Capilar', 'Hidratação e tratamento para couro cabeludo', 40, 45.00, 'Tratamentos', false, true),
  ('Pacote Noivo', 'Corte + barba + sobrancelha + tratamento facial', 90, 120.00, 'Especiais', false, true)
) AS new_services(name, description, duration_min, price, category, popular, is_active)
WHERE NOT EXISTS (SELECT 1 FROM services LIMIT 1);

-- Verificar os dados inseridos
SELECT id, name, duration_min, price, category, popular, is_active 
FROM services 
ORDER BY name;

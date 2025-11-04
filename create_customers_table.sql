-- Script para criar tabela de clientes (customers)
-- Execute este script no Supabase SQL Editor

-- Criar tabela customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  birth_date DATE,
  neighborhood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para busca rápida por telefone
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- Comentários para documentação
COMMENT ON TABLE public.customers IS 'Tabela de clientes cadastrados';
COMMENT ON COLUMN public.customers.phone IS 'Telefone do cliente (apenas números)';
COMMENT ON COLUMN public.customers.birth_date IS 'Data de nascimento do cliente';
COMMENT ON COLUMN public.customers.neighborhood IS 'Bairro do cliente em João Pessoa';

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura pública (necessário para buscar clientes)
CREATE POLICY "Allow public read access on customers"
  ON public.customers
  FOR SELECT
  USING (true);

-- Política para permitir inserção pública (necessário para criar novos clientes)
CREATE POLICY "Allow public insert on customers"
  ON public.customers
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir atualização pública (necessário para atualizar dados do cliente)
CREATE POLICY "Allow public update on customers"
  ON public.customers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);


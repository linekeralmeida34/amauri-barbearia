-- Adiciona coluna customer_id na tabela bookings
-- Execute este script no Supabase SQL Editor

-- Adicionar coluna customer_id na tabela bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS customer_id UUID;

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);

-- Criar foreign key constraint (opcional, mas recomendado para integridade)
-- Primeiro, verifique se a tabela customers existe antes de executar
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT fk_bookings_customer_id
    FOREIGN KEY (customer_id)
    REFERENCES public.customers(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Comentário para documentação
COMMENT ON COLUMN public.bookings.customer_id IS 'Referência ao cliente na tabela customers';


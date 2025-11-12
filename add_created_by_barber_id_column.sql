-- ============================================
-- Adiciona coluna para armazenar ID do barbeiro que criou o agendamento
-- ============================================

-- Adiciona coluna created_by_barber_id na tabela bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS created_by_barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL;

-- Índice para performance em consultas
CREATE INDEX IF NOT EXISTS idx_bookings_created_by_barber_id 
ON public.bookings(created_by_barber_id);

-- Comentário para documentação
COMMENT ON COLUMN public.bookings.created_by_barber_id IS 'ID do barbeiro que criou o agendamento (quando created_by = "barber")';


-- Add cancellation fields to credit_notes table
ALTER TABLE public.credit_notes
ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(2),
ADD COLUMN IF NOT EXISTS cancellation_uuid_sust UUID;

-- Add cancellation fields to credit_notes table (conditional: safe for shadow DB)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'credit_notes'
    ) THEN
        ALTER TABLE public.credit_notes
        ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(2),
        ADD COLUMN IF NOT EXISTS cancellation_uuid_sust UUID;
    END IF;
END $$;

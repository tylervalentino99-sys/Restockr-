DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'imei') THEN
        ALTER TABLE public.products ADD COLUMN imei TEXT;
    END IF;
END $$;
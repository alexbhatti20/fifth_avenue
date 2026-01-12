-- =============================================
-- ADD ONLINE PAYMENT FIELDS TO ORDERS TABLE
-- For storing transaction ID and online payment method details
-- RUN THIS MIGRATION FIRST before using online payment features
-- =============================================

-- Add transaction_id column to orders table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'transaction_id') THEN
        ALTER TABLE public.orders ADD COLUMN transaction_id TEXT;
        RAISE NOTICE 'Added transaction_id column to orders table';
    ELSE
        RAISE NOTICE 'transaction_id column already exists';
    END IF;
END $$;

-- Add online_payment_method_id column (references the payment_methods table)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'online_payment_method_id') THEN
        ALTER TABLE public.orders ADD COLUMN online_payment_method_id UUID;
        RAISE NOTICE 'Added online_payment_method_id column to orders table';
    ELSE
        RAISE NOTICE 'online_payment_method_id column already exists';
    END IF;
END $$;

-- Add foreign key constraint if payment_methods table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_orders_payment_method' 
            AND table_name = 'orders'
        ) THEN
            ALTER TABLE public.orders ADD CONSTRAINT fk_orders_payment_method 
                FOREIGN KEY (online_payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added foreign key constraint for online_payment_method_id';
        END IF;
    END IF;
END $$;

-- Add online_payment_details column for storing additional payment info as JSONB
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'online_payment_details') THEN
        ALTER TABLE public.orders ADD COLUMN online_payment_details JSONB;
        RAISE NOTICE 'Added online_payment_details column to orders table';
    ELSE
        RAISE NOTICE 'online_payment_details column already exists';
    END IF;
END $$;

-- Create index for transaction_id lookups (for payment verification)
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON public.orders(transaction_id) WHERE transaction_id IS NOT NULL;

-- Create index for online payment method lookups
CREATE INDEX IF NOT EXISTS idx_orders_online_payment_method ON public.orders(online_payment_method_id) WHERE online_payment_method_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.orders.transaction_id IS 'Transaction/Reference ID provided by customer for online payments';
COMMENT ON COLUMN public.orders.online_payment_method_id IS 'Reference to the payment method used (JazzCash, EasyPaisa, Bank)';
COMMENT ON COLUMN public.orders.online_payment_details IS 'Additional payment details stored as JSON (method name, account details shown, etc.)';

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '✅ Online payment columns migration completed successfully!';
    RAISE NOTICE 'Now run: payment-methods-rpc.sql, then customer-orders-rpc.sql';
END $$;

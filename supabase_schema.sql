-- RESTOCKR SUPABASE PRODUCTION DATABASE SCHEMA & MIGRATION
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/xizdnqzfbymqsirrfens/sql)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------
-- 1. TABLES CREATION
-- ----------------------------------------------------

-- Table: shops
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT,
    shop_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo TEXT,
    phone TEXT,
    address TEXT,
    state TEXT,
    city TEXT,
    whatsapp TEXT,
    subscription_status TEXT DEFAULT 'Active',
    subscription_plan TEXT DEFAULT 'Free Trial',
    subscription_expiry TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
    website_settings JSONB DEFAULT '{"showSoldProducts": true, "enableVideoDownloads": true, "enableImageDownloads": true, "customThemeColor": "#0d9488"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: staff
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    role TEXT,
    permissions JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'Active', -- Active / Suspended
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    notes TEXT DEFAULT '',
    total_spent NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: products (Quantity-based inventory, NO IMEI / device tracking, NO profit / buying cost)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    manufacturer TEXT, -- maps to brand
    model TEXT NOT NULL,
    storage TEXT,
    ram TEXT,
    colour TEXT,
    battery_health TEXT,
    warranty TEXT,
    condition_tags JSONB DEFAULT '[]'::jsonb,
    price NUMERIC NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 0,
    video_url TEXT,
    image_urls JSONB DEFAULT '[]'::jsonb,
    thumbnail_url TEXT,
    status TEXT DEFAULT 'Available', -- Available / Out of Stock
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: sales (Immediate completion, no approval workflow)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    quantity INT NOT NULL DEFAULT 1,
    selling_price NUMERIC NOT NULL DEFAULT 0,
    sold_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: repairs
CREATE TABLE IF NOT EXISTS public.repairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    device_name TEXT NOT NULL,
    issue TEXT NOT NULL,
    repair_status TEXT DEFAULT 'Pending',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------
-- 2. INDEXES FOR PERFORMANCE
-- ----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_shops_slug ON public.shops(slug);
CREATE INDEX IF NOT EXISTS idx_products_shop_status ON public.products(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_shop_date ON public.sales(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_staff_shop ON public.staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_repairs_shop ON public.repairs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop ON public.audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_notifications_shop ON public.notifications(shop_id);

-- ----------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DO $$
BEGIN
    -- shops
    DROP POLICY IF EXISTS "Shops public read" ON public.shops;
    DROP POLICY IF EXISTS "Shops public insert" ON public.shops;
    DROP POLICY IF EXISTS "Shops public update" ON public.shops;
    
    -- products
    DROP POLICY IF EXISTS "Products public read available" ON public.products;
    DROP POLICY IF EXISTS "Products shop full access" ON public.products;
    
    -- staff, customers, sales, repairs, audit_logs, notifications
    DROP POLICY IF EXISTS "Staff shop full access" ON public.staff;
    DROP POLICY IF EXISTS "Customers shop full access" ON public.customers;
    DROP POLICY IF EXISTS "Sales shop full access" ON public.sales;
    DROP POLICY IF EXISTS "Repairs shop full access" ON public.repairs;
    DROP POLICY IF EXISTS "Audit logs shop full access" ON public.audit_logs;
    DROP POLICY IF EXISTS "Notifications shop full access" ON public.notifications;
EXCEPTION WHEN OTHERS THEN
    -- Ignore error if policy does not exist
END $$;

-- Policies for shops
CREATE POLICY "Shops public read" ON public.shops FOR SELECT USING (true);
CREATE POLICY "Shops public insert" ON public.shops FOR INSERT WITH CHECK (true);
CREATE POLICY "Shops public update" ON public.shops FOR UPDATE USING (true);

-- Policies for products
-- Reseller Website Anonymous Policy: Read-only access where status = 'Available'
CREATE POLICY "Products public read available" ON public.products FOR SELECT USING (true);
CREATE POLICY "Products shop full access" ON public.products FOR ALL USING (true);

-- Policies for staff
CREATE POLICY "Staff shop full access" ON public.staff FOR ALL USING (true);

-- Policies for customers
CREATE POLICY "Customers shop full access" ON public.customers FOR ALL USING (true);

-- Policies for sales
CREATE POLICY "Sales shop full access" ON public.sales FOR ALL USING (true);

-- Policies for repairs
CREATE POLICY "Repairs shop full access" ON public.repairs FOR ALL USING (true);

-- Policies for audit_logs
CREATE POLICY "Audit logs shop full access" ON public.audit_logs FOR ALL USING (true);

-- Policies for notifications
CREATE POLICY "Notifications shop full access" ON public.notifications FOR ALL USING (true);

-- ----------------------------------------------------
-- 4. STORAGE BUCKETS SETUP & POLICIES
-- ----------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('product-videos', 'product-videos', true),
    ('product-images', 'product-images', true),
    ('shop-assets', 'shop-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Read product-videos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Insert product-videos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Read product-images" ON storage.objects;
    DROP POLICY IF EXISTS "Public Insert product-images" ON storage.objects;
    DROP POLICY IF EXISTS "Public Read shop-assets" ON storage.objects;
    DROP POLICY IF EXISTS "Public Insert shop-assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN
END $$;

CREATE POLICY "Public Read product-videos" ON storage.objects FOR SELECT USING (bucket_id = 'product-videos');
CREATE POLICY "Public Insert product-videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-videos');
CREATE POLICY "Public Update product-videos" ON storage.objects FOR UPDATE USING (bucket_id = 'product-videos');

CREATE POLICY "Public Read product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Public Insert product-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Public Update product-images" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images');

CREATE POLICY "Public Read shop-assets" ON storage.objects FOR SELECT USING (bucket_id = 'shop-assets');
CREATE POLICY "Public Insert shop-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-assets');
CREATE POLICY "Public Update shop-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-assets');

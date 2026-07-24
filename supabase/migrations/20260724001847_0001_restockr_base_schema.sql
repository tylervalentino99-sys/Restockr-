/*
# RESTOCKR Base Schema + Missing Columns

## Purpose
Establishes the full RESTOCKR database schema as a tracked migration. The tables
may already exist from a manual SQL editor run — this migration is idempotent and
will add any missing tables, columns, indexes, and policies without losing data.

## New Tables
1. `shops` — store owner accounts (id, shop_name, slug, owner_id, logo, phone, address, whatsapp, subscription_*, website_settings, created_at)
2. `staff` — shop employees (shop_id FK, full_name, phone_number, role, permissions JSONB, status)
3. `customers` — buyers (shop_id FK, full_name, phone_number, notes, total_spent, purchase_count, created_at)
4. `products` — inventory items (shop_id FK, category, manufacturer, model, storage, ram, colour, battery_health, warranty, condition_tags JSONB, price, quantity, video_url, image_urls JSONB, thumbnail_url, status, created_at)
5. `sales` — transaction records (shop_id FK, product_id FK, customer_id FK, quantity, selling_price, payment_method, split_details JSONB, status, sold_by, created_at)
6. `repairs` — repair tickets (shop_id FK, customer_id FK, device_name, issue, repair_status, notes, created_at)
7. `audit_logs` — activity log (shop_id FK, user_id, user_name, action, details, created_at)
8. `notifications` — in-app notifications (shop_id FK, title, message, type, read, created_at)

## New Columns Added (conditional, idempotent)
- `sales.payment_method` TEXT DEFAULT 'Transfer' — Cash / Transfer / POS / Split
- `sales.split_details` JSONB — { cash, transfer, pos } for split payments
- `sales.status` TEXT DEFAULT 'Completed' — Completed / Reversed
- `customers.purchase_count` INT DEFAULT 1 — tracks repeat purchases

## Security
- RLS enabled on all 8 tables.
- Policies use `TO anon, authenticated` because the app currently operates with the
  anon key (no Supabase Auth session yet). Real auth + ownership-scoped RLS is
  planned for Phase 3 of the roadmap. Until then, data is intentionally shared within
  the anon-key context.
- 4 policies per table (SELECT / INSERT / UPDATE / DELETE) — no `FOR ALL`.

## Storage
- 3 public buckets: product-videos, product-images, shop-assets
- Public read/insert/update policies on storage.objects for each bucket
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------
-- 1. TABLES (idempotent)
-- ----------------------------------------------------

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

CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    role TEXT,
    permissions JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    notes TEXT DEFAULT '',
    total_spent NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    manufacturer TEXT,
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
    status TEXT DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

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
-- 2. ADD MISSING COLUMNS (idempotent)
-- ----------------------------------------------------

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'payment_method') THEN
        ALTER TABLE public.sales ADD COLUMN payment_method TEXT DEFAULT 'Transfer';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'split_details') THEN
        ALTER TABLE public.sales ADD COLUMN split_details JSONB;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'status') THEN
        ALTER TABLE public.sales ADD COLUMN status TEXT DEFAULT 'Completed';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'purchase_count') THEN
        ALTER TABLE public.customers ADD COLUMN purchase_count INT DEFAULT 1;
    END IF;
END $$;

-- ----------------------------------------------------
-- 3. INDEXES
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
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (idempotent)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Shops public read" ON public.shops;
    DROP POLICY IF EXISTS "Shops public insert" ON public.shops;
    DROP POLICY IF EXISTS "Shops public update" ON public.shops;
    DROP POLICY IF EXISTS "Products public read available" ON public.products;
    DROP POLICY IF EXISTS "Products shop full access" ON public.products;
    DROP POLICY IF EXISTS "Staff shop full access" ON public.staff;
    DROP POLICY IF EXISTS "Customers shop full access" ON public.customers;
    DROP POLICY IF EXISTS "Sales shop full access" ON public.sales;
    DROP POLICY IF EXISTS "Repairs shop full access" ON public.repairs;
    DROP POLICY IF EXISTS "Audit logs shop full access" ON public.audit_logs;
    DROP POLICY IF EXISTS "Notifications shop full access" ON public.notifications;

    -- New per-verb policy names
    DROP POLICY IF EXISTS "shops_select" ON public.shops;
    DROP POLICY IF EXISTS "shops_insert" ON public.shops;
    DROP POLICY IF EXISTS "shops_update" ON public.shops;
    DROP POLICY IF EXISTS "shops_delete" ON public.shops;

    DROP POLICY IF EXISTS "staff_select" ON public.staff;
    DROP POLICY IF EXISTS "staff_insert" ON public.staff;
    DROP POLICY IF EXISTS "staff_update" ON public.staff;
    DROP POLICY IF EXISTS "staff_delete" ON public.staff;

    DROP POLICY IF EXISTS "customers_select" ON public.customers;
    DROP POLICY IF EXISTS "customers_insert" ON public.customers;
    DROP POLICY IF EXISTS "customers_update" ON public.customers;
    DROP POLICY IF EXISTS "customers_delete" ON public.customers;

    DROP POLICY IF EXISTS "products_select" ON public.products;
    DROP POLICY IF EXISTS "products_insert" ON public.products;
    DROP POLICY IF EXISTS "products_update" ON public.products;
    DROP POLICY IF EXISTS "products_delete" ON public.products;

    DROP POLICY IF EXISTS "sales_select" ON public.sales;
    DROP POLICY IF EXISTS "sales_insert" ON public.sales;
    DROP POLICY IF EXISTS "sales_update" ON public.sales;
    DROP POLICY IF EXISTS "sales_delete" ON public.sales;

    DROP POLICY IF EXISTS "repairs_select" ON public.repairs;
    DROP POLICY IF EXISTS "repairs_insert" ON public.repairs;
    DROP POLICY IF EXISTS "repairs_update" ON public.repairs;
    DROP POLICY IF EXISTS "repairs_delete" ON public.repairs;

    DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_update" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_delete" ON public.audit_logs;

    DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
    DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
    DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
    DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Shops: 4 policies
CREATE POLICY "shops_select" ON public.shops FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "shops_insert" ON public.shops FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "shops_update" ON public.shops FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shops_delete" ON public.shops FOR DELETE TO anon, authenticated USING (true);

-- Staff: 4 policies
CREATE POLICY "staff_select" ON public.staff FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff_insert" ON public.staff FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff_update" ON public.staff FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_delete" ON public.staff FOR DELETE TO anon, authenticated USING (true);

-- Customers: 4 policies
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO anon, authenticated USING (true);

-- Products: 4 policies
CREATE POLICY "products_select" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "products_insert" ON public.products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "products_update" ON public.products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_delete" ON public.products FOR DELETE TO anon, authenticated USING (true);

-- Sales: 4 policies
CREATE POLICY "sales_select" ON public.sales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sales_insert" ON public.sales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "sales_update" ON public.sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sales_delete" ON public.sales FOR DELETE TO anon, authenticated USING (true);

-- Repairs: 4 policies
CREATE POLICY "repairs_select" ON public.repairs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "repairs_insert" ON public.repairs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "repairs_update" ON public.repairs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "repairs_delete" ON public.repairs FOR DELETE TO anon, authenticated USING (true);

-- Audit logs: 4 policies
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "audit_logs_update" ON public.audit_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_delete" ON public.audit_logs FOR DELETE TO anon, authenticated USING (true);

-- Notifications: 4 policies
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO anon, authenticated USING (true);

-- ----------------------------------------------------
-- 5. STORAGE BUCKETS
-- ----------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES
    ('product-videos', 'product-videos', true),
    ('product-images', 'product-images', true),
    ('shop-assets', 'shop-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies (idempotent)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public Read product-videos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Insert product-videos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Update product-videos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Read product-images" ON storage.objects;
    DROP POLICY IF EXISTS "Public Insert product-images" ON storage.objects;
    DROP POLICY IF EXISTS "Public Update product-images" ON storage.objects;
    DROP POLICY IF EXISTS "Public Read shop-assets" ON storage.objects;
    DROP POLICY IF EXISTS "Public Insert shop-assets" ON storage.objects;
    DROP POLICY IF EXISTS "Public Update shop-assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN
    NULL;
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

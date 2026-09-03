-- ═══════════════════════════════════════════════════════════════════════════
-- V-TECH IDEMPOTENT FULL SCHEMA — FRESH + EXISTING Supabase project dono ke liye
-- Source: backups/supabase/baseline_schema.sql (pg_dump schema-only, PG 17)
--
-- MAQSAD (purpose):
--   Kisi bhi SAME-CODEBASE Supabase project ke `public` schema ko, bina data
--   khone (data-loss) ke, current LIVE state tak le jao — CHAHE wo project
--   bilkul FRESH ho (khaali), YA pehle se populated/partial ho.
--
-- Ye file FULLY IDEMPOTENT (dobaara chalao) aur ADDITIVE-ONLY hai:
--   • Har statement "already exists" ko guard karta hai (IF NOT EXISTS / DO-guard).
--   • Koi DELETE / TRUNCATE / DESTRUCTIVE ALTER NAHI — existing tables, columns
--     aur rows KOI touch nahi hote. Missing cheezein hi add hoti hain.
--   • FREQUENCY: safe hai har release/migration me re-run karna.
--
-- Notes:
--   • Is file me auth / storage SCHEMAS nahi hain — wo Supabase khud auto-create
--     karta hai har naye project me. Sirf `public` schema + storage buckets.
--   • Naye tables/columns add hote hain; pehle se maujood tables pe RLS enabled,
--     policies DROP+CREATE, triggers DROP+CREATE (data-safe).
--   • `storage.buckets` insert `on conflict (id) do nothing` se idempotent hai.
--
-- VALIDATED (2026-09-03) — local PostgreSQL 18 par dono main scenarios test kiye:
--   1. FRESH create  ➜ EXIT 0, koi error nahi (40 tables, 48 policies, 8 triggers,
--      2 enums, RLS sab tables pe enabled, get_dashboard_stats RPC chal raha hai).
--   2. RE-RUN ek ALREADY-populated DB par ➜ EXIT 0, koi error nahi, aur seeded rows
--      (client/product/transaction/profile) re-run ke BAAD bhi byte-identical mili —
--      ZERO data loss. (Isi liye har re-run safe hai.)
-- ═══════════════════════════════════════════════════════════════════════════

--
-- Required extension: moddatetime (fresh project par default INSTALLED NAHI hota)
-- — public.update_date_updated / extensions.moddatetime triggers isi par depend karte hain
--
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- ═══════════════════════════════════════════════════════════════════════════
-- ENUMS (2) — PostgreSQL me `CREATE TYPE IF NOT EXISTS` nahi hai,
-- isliye DO-block se guard kiya gaya hai (typname + public namespace check).
-- ═══════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_mode_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.payment_mode_type AS ENUM (
        'Cash',
        'UPI',
        'NEFT',
        'Cheque',
        'Bank Transfer',
        'PhonePe/GPay'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.payment_type_type AS ENUM (
        'Full',
        'Partial',
        'Advance',
        'On Account'
    );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES (40) — CREATE TABLE IF NOT EXISTS (columns + inline constraints verbatim).
-- Existing tables/data untouched. `ALTER TABLE ... OWNER` DROP kar diya hai.
-- Note: purchase_order_items / purchase_orders / push_subscriptions tables
-- hadiyaan (id) idhaar plain NOT NULL hain; identity step (g) me guard se lagti hai.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id bigint NOT NULL,
    user_id integer,
    action text,
    module text,
    meta_id text,
    details text,
    date_created timestamp with time zone DEFAULT now()
);



CREATE TABLE IF NOT EXISTS public.advance_payments (
    id integer NOT NULL,
    mechanic_id integer NOT NULL,
    amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    date_paid date NOT NULL,
    reason text,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



CREATE TABLE IF NOT EXISTS public.attendance_list (
    id integer NOT NULL,
    mechanic_id integer NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    curr_date date NOT NULL,
    time_in time without time zone,
    time_out time without time zone,
    lat_in double precision,
    lng_in double precision,
    lat_out double precision,
    lng_out double precision
);



CREATE TABLE IF NOT EXISTS public.client_list (
    id integer NOT NULL,
    firstname text NOT NULL,
    middlename text,
    lastname text NOT NULL,
    contact character varying(100) NOT NULL,
    email text,
    address text NOT NULL,
    image_path text,
    opening_balance numeric(15,2) DEFAULT 0.00,
    delete_flag smallint DEFAULT 0 NOT NULL,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp without time zone,
    payment_due_date date,
    payment_due_remarks text,
    login_allowed boolean DEFAULT false NOT NULL
);



CREATE TABLE IF NOT EXISTS public.client_loans (
    id integer NOT NULL,
    client_id integer NOT NULL,
    principal_amount numeric(12,2) NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0.00,
    loan_period integer NOT NULL,
    total_payable numeric(12,2) NOT NULL,
    emi_amount numeric(12,2) NOT NULL,
    remarks text,
    loan_date date NOT NULL,
    status smallint DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS public.client_payments (
    id integer NOT NULL,
    client_id integer NOT NULL,
    job_id character varying(50) DEFAULT NULL::character varying,
    loan_id integer,
    bill_no character varying(50) DEFAULT NULL::character varying,
    payment_date date DEFAULT CURRENT_DATE,
    amount numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0.00,
    net_amount numeric(10,2) GENERATED ALWAYS AS ((amount - discount)) STORED,
    payment_mode public.payment_mode_type DEFAULT 'Cash'::public.payment_mode_type,
    payment_type public.payment_type_type DEFAULT 'Full'::public.payment_type_type,
    remarks text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS public.direct_sale_items (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    product_id integer NOT NULL,
    qty integer NOT NULL,
    price numeric(15,2) NOT NULL
);



CREATE TABLE IF NOT EXISTS public.direct_sales (
    id integer NOT NULL,
    sale_code character varying(100) NOT NULL,
    client_id integer,
    mechanic_id integer,
    total_amount numeric(15,2) NOT NULL,
    payment_mode character varying(50) NOT NULL,
    remarks text,
    last_edited_by integer,
    last_edited_by_name character varying(100) DEFAULT NULL::character varying,
    last_edited_date timestamp without time zone,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



CREATE TABLE IF NOT EXISTS public.expense_list (
    id integer NOT NULL,
    category character varying(200) NOT NULL,
    amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    remarks text,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



CREATE TABLE IF NOT EXISTS public.inventory_list (
    id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    place text,
    stock_date date NOT NULL,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    supplier_id bigint,
    purchase_cost numeric(12,2) DEFAULT 0 NOT NULL,
    courier_charges numeric(12,2) DEFAULT 0 NOT NULL,
    place_zone text,
    place_rack text,
    place_bin text,
    place_box text,
    purchase_order_id integer
);



CREATE TABLE IF NOT EXISTS public.job_id_counter (
    id integer NOT NULL,
    last_job_id integer DEFAULT 0
);



CREATE TABLE IF NOT EXISTS public.lender_list (
    id integer NOT NULL,
    fullname character varying(250) NOT NULL,
    contact character varying(20) NOT NULL,
    loan_amount numeric(12,2) DEFAULT 0 NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0.00 NOT NULL,
    tenure_months integer DEFAULT 0 NOT NULL,
    reason text,
    emi_amount numeric(12,2) DEFAULT 0 NOT NULL,
    start_date date NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



CREATE TABLE IF NOT EXISTS public.loan_payments (
    id integer NOT NULL,
    lender_id integer NOT NULL,
    amount_paid double precision DEFAULT 0 NOT NULL,
    payment_date date NOT NULL,
    remarks text
);



CREATE TABLE IF NOT EXISTS public.login_throttle (
    id bigint NOT NULL,
    email text NOT NULL,
    ip_address text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    lock_repeats integer DEFAULT 0 NOT NULL,
    first_attempt_at timestamp with time zone,
    lockout_until timestamp with time zone,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE IF NOT EXISTS public.mechanic_commission_history (
    id integer NOT NULL,
    mechanic_id integer NOT NULL,
    commission_percent numeric(5,2) NOT NULL,
    effective_date date NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



CREATE TABLE IF NOT EXISTS public.mechanic_list (
    id integer NOT NULL,
    firstname character varying(250) NOT NULL,
    middlename text,
    lastname character varying(250) NOT NULL,
    contact character varying(50) NOT NULL,
    designation character varying(100) DEFAULT 'Mechanic'::character varying,
    daily_salary numeric(12,2) DEFAULT 0.00,
    avatar character varying(255) DEFAULT 'default-avatar.jpg'::character varying,
    commission_percent numeric(5,2) DEFAULT 0.00,
    status smallint DEFAULT 1 NOT NULL,
    delete_flag smallint DEFAULT 0 NOT NULL,
    date_added timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    salary_per_day numeric(10,2) DEFAULT 0.00 NOT NULL,
    image_path text,
    CONSTRAINT chk_commission CHECK (((commission_percent >= (0)::numeric) AND (commission_percent <= (100)::numeric))),
    CONSTRAINT chk_salary CHECK ((daily_salary >= (0)::numeric)),
    CONSTRAINT chk_salary_per_day CHECK ((salary_per_day >= (0)::numeric))
);



CREATE TABLE IF NOT EXISTS public.mechanic_salary_history (
    id integer NOT NULL,
    mechanic_id integer NOT NULL,
    salary numeric(12,2) DEFAULT 0.00 NOT NULL,
    effective_date date NOT NULL,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



CREATE TABLE IF NOT EXISTS public.message_list (
    id integer NOT NULL,
    fullname text NOT NULL,
    contact text NOT NULL,
    email text NOT NULL,
    message text NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



CREATE TABLE IF NOT EXISTS public.payment_reminders (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    amount_due numeric(15,2) DEFAULT 0 NOT NULL,
    reminder_date timestamp with time zone DEFAULT now() NOT NULL,
    channel character varying(50) DEFAULT 'System Alert'::character varying,
    status character varying(50) DEFAULT 'Sent'::character varying,
    remarks text
);



CREATE TABLE IF NOT EXISTS public.product_list (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    cost_price numeric(15,2) DEFAULT 0 NOT NULL,
    price numeric(15,2) DEFAULT 0 NOT NULL,
    image_path text,
    status smallint DEFAULT 1 NOT NULL,
    delete_flag smallint DEFAULT 0 NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hsn character varying(20) DEFAULT ''::character varying NOT NULL,
    alert_quantity integer DEFAULT 0 NOT NULL,
    barcode character varying(100) DEFAULT NULL::character varying,
    place_zone text,
    place_rack text,
    place_bin text,
    place_box text,
    CONSTRAINT positive_price CHECK ((price >= cost_price)),
    CONSTRAINT product_list_cost_price_check CHECK ((cost_price >= (0)::numeric)),
    CONSTRAINT product_list_delete_flag_check CHECK ((delete_flag = ANY (ARRAY[0, 1]))),
    CONSTRAINT product_list_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT product_list_status_check CHECK ((status = ANY (ARRAY[0, 1, 2])))
);



CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    full_name text,
    role text DEFAULT 'staff'::text,
    avatar_url text,
    updated_at timestamp with time zone DEFAULT now(),
    mechanic_id bigint,
    email text,
    date_updated timestamp with time zone DEFAULT now(),
    client_id bigint,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'client'::text, 'developer'::text])))
);

-- ── Messenger: user_presence + messages (20260901_messenger_presence.sql) ──
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'offline'::text,
    last_seen timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_presence_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text])))
);

CREATE TABLE IF NOT EXISTS public.messages (
    id bigint NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    content text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    media_url text,
    media_type text,
    media_name text,
    deleted_at timestamptz,
    CONSTRAINT messages_no_self CHECK ((sender_id <> recipient_id)),
    CONSTRAINT messages_content_check CHECK ((char_length(btrim(content)) > 0))
);

CREATE TABLE IF NOT EXISTS public.service_list (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    price numeric(12,2) DEFAULT 0.00 NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    delete_flag smallint DEFAULT 0 NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hsn character varying(20) DEFAULT ''::character varying NOT NULL,
    CONSTRAINT service_list_delete_flag_check CHECK ((delete_flag = ANY (ARRAY[0, 1]))),
    CONSTRAINT service_list_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT service_list_status_check CHECK ((status = ANY (ARRAY[0, 1, 2])))
);



CREATE TABLE IF NOT EXISTS public.spare_supplier (
    spare_id bigint NOT NULL,
    supplier_id bigint NOT NULL
);



CREATE TABLE IF NOT EXISTS public.suppliers (
    id bigint NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    contact text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    status bigint DEFAULT 1 NOT NULL,
    delete_flag bigint DEFAULT 0 NOT NULL,
    date_created timestamp with time zone DEFAULT now() NOT NULL,
    date_updated timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE IF NOT EXISTS public.system_info (
    id integer NOT NULL,
    meta_field text NOT NULL,
    meta_value text NOT NULL
);



CREATE TABLE IF NOT EXISTS public.transaction_images (
    id integer NOT NULL,
    transaction_id integer NOT NULL,
    image_path character varying(255) NOT NULL,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



CREATE TABLE IF NOT EXISTS public.transaction_list (
    id integer NOT NULL,
    user_id integer NOT NULL,
    mechanic_id integer,
    code character varying(100) NOT NULL,
    job_id character varying(20) DEFAULT NULL::character varying,
    client_name text,
    fault text NOT NULL,
    remark text NOT NULL,
    item text NOT NULL,
    uniq_id text NOT NULL,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    mechanic_amount numeric(12,2) DEFAULT 0 NOT NULL,
    mechanic_commission_amount numeric(12,2) DEFAULT 0,
    del_status smallint DEFAULT 0 NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_completed timestamp with time zone,
    location_id integer,
    CONSTRAINT transaction_list_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT transaction_list_del_status_check CHECK ((del_status = ANY (ARRAY[0, 1]))),
    CONSTRAINT transaction_list_mechanic_amount_check CHECK ((mechanic_amount >= (0)::numeric)),
    CONSTRAINT transaction_list_mechanic_commission_amount_check CHECK ((mechanic_commission_amount >= (0)::numeric)),
    CONSTRAINT transaction_list_status_check CHECK ((status = ANY (ARRAY[0, 1, 2, 3, 4, 5]))),
    CONSTRAINT valid_del_status CHECK (((del_status >= 0) AND (del_status <= 1))),
    CONSTRAINT valid_transaction_status CHECK (((status >= 0) AND (status <= 5)))
);



CREATE TABLE IF NOT EXISTS public.transaction_products (
    transaction_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name text,
    qty integer DEFAULT 0 NOT NULL,
    price numeric(12,2) DEFAULT 0.00 NOT NULL
);



CREATE TABLE IF NOT EXISTS public.transaction_services (
    transaction_id integer NOT NULL,
    service_id integer NOT NULL,
    service_name text,
    price numeric(12,2) DEFAULT 0.00 NOT NULL
);



CREATE TABLE IF NOT EXISTS public.users (
    id integer NOT NULL,
    firstname character varying(250) NOT NULL,
    lastname character varying(250) NOT NULL,
    username character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    avatar text,
    last_login timestamp with time zone,
    type smallint DEFAULT 0 NOT NULL,
    mechanic_id integer,
    date_added timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_type_check CHECK ((type = ANY (ARRAY[0, 1, 2, 3])))
);



CREATE TABLE IF NOT EXISTS public.wp_template_history (
    id bigint NOT NULL,
    template_key text DEFAULT ''::text NOT NULL,
    action text DEFAULT ''::text NOT NULL,
    old_value text,
    new_value text,
    changed_by text DEFAULT ''::text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE IF NOT EXISTS public.location_zones (
    id serial PRIMARY KEY,
    name text NOT NULL UNIQUE,
    status int NOT NULL DEFAULT 1,
    delete_flag int NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.location_racks (
    id serial PRIMARY KEY,
    zone_id integer NOT NULL,
    name text NOT NULL,
    status int NOT NULL DEFAULT 1,
    delete_flag int NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(zone_id, name)
);

CREATE TABLE IF NOT EXISTS public.location_bins (
    id serial PRIMARY KEY,
    rack_id integer NOT NULL,
    name text NOT NULL,
    status int NOT NULL DEFAULT 1,
    delete_flag int NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(rack_id, name)
);

CREATE TABLE IF NOT EXISTS public.location_boxes (
    id serial PRIMARY KEY,
    bin_id integer NOT NULL,
    name text NOT NULL,
    status int NOT NULL DEFAULT 1,
    delete_flag int NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(bin_id, name)
);

CREATE TABLE IF NOT EXISTS public.locations (
    id serial PRIMARY KEY,
    zone text NOT NULL,
    rack text NOT NULL DEFAULT ''::text,
    bin text NOT NULL DEFAULT ''::text,
    box text NOT NULL DEFAULT ''::text,
    label text,
    status int NOT NULL DEFAULT 1,
    delete_flag int NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    code text,
    zone_id integer,
    rack_id integer,
    bin_id integer,
    box_id integer,
    kind text NOT NULL DEFAULT 'inventory'::text,
    UNIQUE(zone, rack, bin, box)
);

CREATE TABLE IF NOT EXISTS public.product_locations (
    product_id integer NOT NULL,
    location_id integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (product_id, location_id)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id bigint NOT NULL,
    purchase_order_id bigint NOT NULL,
    product_id bigint NOT NULL,
    qty_ordered integer DEFAULT 0 NOT NULL,
    qty_received integer DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    date_created timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id bigint NOT NULL,
    po_code text NOT NULL,
    supplier_id bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    expected_date date,
    notes text DEFAULT ''::text,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    received_date date,
    date_created timestamp with time zone DEFAULT now() NOT NULL,
    date_updated timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ordered'::text, 'received'::text, 'cancelled'::text])))
);



CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id bigint NOT NULL,
    user_id uuid,
    endpoint text NOT NULL,
    p256dh text DEFAULT ''::text NOT NULL,
    auth text DEFAULT ''::text NOT NULL,
    device_name text DEFAULT ''::text,
    enabled boolean DEFAULT true NOT NULL,
    date_created timestamp with time zone DEFAULT now() NOT NULL,
    date_updated timestamp with time zone DEFAULT now() NOT NULL
);



-- ═══════════════════════════════════════════════════════════════════════════
-- COLUMN-ADD GUARDS (step 6) — idempotent + DATA-SAFE:
--   har table ke liye ek DO-block, har missing column ko add karta hai.
--   NULLABLE-SAFETY RULE: jo column `NOT NULL` + NO DEFAULT tha, usko yahaan
--   sirf `<type>` (nullable) add karte hain — taaki populated table pe
--   "column contains null values" ERROR na aaye. Fresh-create path upar
--   CREATE TABLE me hi NOT NULL/constraints laga deta hai.
--   (Table-level CHECK/FK/REFERENCES/UNIQUE constraints yahaan nahi daalte —
--    wo alag guarded sections me hain.)
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  alter table public.activity_logs add column if not exists id bigint;
  alter table public.activity_logs add column if not exists user_id integer;
  alter table public.activity_logs add column if not exists action text;
  alter table public.activity_logs add column if not exists module text;
  alter table public.activity_logs add column if not exists meta_id text;
  alter table public.activity_logs add column if not exists details text;
  alter table public.activity_logs add column if not exists date_created timestamp with time zone DEFAULT now();
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.advance_payments add column if not exists id integer;
  alter table public.advance_payments add column if not exists mechanic_id integer;
  alter table public.advance_payments add column if not exists amount numeric(12,2) DEFAULT 0.00 NOT NULL;
  alter table public.advance_payments add column if not exists date_paid date;
  alter table public.advance_payments add column if not exists reason text;
  alter table public.advance_payments add column if not exists date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.attendance_list add column if not exists id integer;
  alter table public.attendance_list add column if not exists mechanic_id integer;
  alter table public.attendance_list add column if not exists status smallint DEFAULT 0 NOT NULL;
  alter table public.attendance_list add column if not exists curr_date date;
  alter table public.attendance_list add column if not exists time_in time without time zone;
  alter table public.attendance_list add column if not exists time_out time without time zone;
  alter table public.attendance_list add column if not exists lat_in double precision;
  alter table public.attendance_list add column if not exists lng_in double precision;
  alter table public.attendance_list add column if not exists lat_out double precision;
  alter table public.attendance_list add column if not exists lng_out double precision;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.client_list add column if not exists id integer;
  alter table public.client_list add column if not exists firstname text;
  alter table public.client_list add column if not exists middlename text;
  alter table public.client_list add column if not exists lastname text;
  alter table public.client_list add column if not exists contact character varying(100);
  alter table public.client_list add column if not exists email text;
  alter table public.client_list add column if not exists address text;
  alter table public.client_list add column if not exists image_path text;
  alter table public.client_list add column if not exists opening_balance numeric(15,2) DEFAULT 0.00;
  alter table public.client_list add column if not exists delete_flag smallint DEFAULT 0 NOT NULL;
  alter table public.client_list add column if not exists date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.client_list add column if not exists date_updated timestamp without time zone;
  alter table public.client_list add column if not exists payment_due_date date;
  alter table public.client_list add column if not exists payment_due_remarks text;
  alter table public.client_list add column if not exists login_allowed boolean DEFAULT false NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.client_loans add column if not exists id integer;
  alter table public.client_loans add column if not exists client_id integer;
  alter table public.client_loans add column if not exists principal_amount numeric(12,2);
  alter table public.client_loans add column if not exists interest_rate numeric(5,2) DEFAULT 0.00;
  alter table public.client_loans add column if not exists loan_period integer;
  alter table public.client_loans add column if not exists total_payable numeric(12,2);
  alter table public.client_loans add column if not exists emi_amount numeric(12,2);
  alter table public.client_loans add column if not exists remarks text;
  alter table public.client_loans add column if not exists loan_date date;
  alter table public.client_loans add column if not exists status smallint DEFAULT 1;
  alter table public.client_loans add column if not exists created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.client_payments add column if not exists id integer;
  alter table public.client_payments add column if not exists client_id integer;
  alter table public.client_payments add column if not exists job_id character varying(50) DEFAULT NULL::character varying;
  alter table public.client_payments add column if not exists loan_id integer;
  alter table public.client_payments add column if not exists bill_no character varying(50) DEFAULT NULL::character varying;
  alter table public.client_payments add column if not exists payment_date date DEFAULT CURRENT_DATE;
  alter table public.client_payments add column if not exists amount numeric(10,2);
  alter table public.client_payments add column if not exists discount numeric(10,2) DEFAULT 0.00;
  alter table public.client_payments add column if not exists net_amount numeric(10,2);
  alter table public.client_payments add column if not exists payment_mode public.payment_mode_type DEFAULT 'Cash'::public.payment_mode_type;
  alter table public.client_payments add column if not exists payment_type public.payment_type_type DEFAULT 'Full'::public.payment_type_type;
  alter table public.client_payments add column if not exists remarks text;
  alter table public.client_payments add column if not exists created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.direct_sale_items add column if not exists id integer;
  alter table public.direct_sale_items add column if not exists sale_id integer;
  alter table public.direct_sale_items add column if not exists product_id integer;
  alter table public.direct_sale_items add column if not exists qty integer;
  alter table public.direct_sale_items add column if not exists price numeric(15,2);
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.direct_sales add column if not exists id integer;
  alter table public.direct_sales add column if not exists sale_code character varying(100);
  alter table public.direct_sales add column if not exists client_id integer;
  alter table public.direct_sales add column if not exists mechanic_id integer;
  alter table public.direct_sales add column if not exists total_amount numeric(15,2);
  alter table public.direct_sales add column if not exists payment_mode character varying(50);
  alter table public.direct_sales add column if not exists remarks text;
  alter table public.direct_sales add column if not exists last_edited_by integer;
  alter table public.direct_sales add column if not exists last_edited_by_name character varying(100) DEFAULT NULL::character varying;
  alter table public.direct_sales add column if not exists last_edited_date timestamp without time zone;
  alter table public.direct_sales add column if not exists date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.expense_list add column if not exists id integer;
  alter table public.expense_list add column if not exists category character varying(200);
  alter table public.expense_list add column if not exists amount numeric(15,2) DEFAULT 0.00 NOT NULL;
  alter table public.expense_list add column if not exists remarks text;
  alter table public.expense_list add column if not exists date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.inventory_list add column if not exists id integer;
  alter table public.inventory_list add column if not exists product_id integer;
  alter table public.inventory_list add column if not exists quantity integer DEFAULT 0 NOT NULL;
  alter table public.inventory_list add column if not exists place text;
  alter table public.inventory_list add column if not exists stock_date date;
  alter table public.inventory_list add column if not exists date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.inventory_list add column if not exists date_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.inventory_list add column if not exists supplier_id bigint;
  alter table public.inventory_list add column if not exists purchase_cost numeric(12,2) DEFAULT 0 NOT NULL;
  alter table public.inventory_list add column if not exists courier_charges numeric(12,2) DEFAULT 0 NOT NULL;
  alter table public.inventory_list add column if not exists place_zone text;
  alter table public.inventory_list add column if not exists place_rack text;
  alter table public.inventory_list add column if not exists place_bin text;
  alter table public.inventory_list add column if not exists place_box text;
  alter table public.inventory_list add column if not exists purchase_order_id integer;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.job_id_counter add column if not exists id integer;
  alter table public.job_id_counter add column if not exists last_job_id integer DEFAULT 0;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.lender_list add column if not exists id integer;
  alter table public.lender_list add column if not exists fullname character varying(250);
  alter table public.lender_list add column if not exists contact character varying(20);
  alter table public.lender_list add column if not exists loan_amount numeric(12,2) DEFAULT 0 NOT NULL;
  alter table public.lender_list add column if not exists interest_rate numeric(5,2) DEFAULT 0.00 NOT NULL;
  alter table public.lender_list add column if not exists tenure_months integer DEFAULT 0 NOT NULL;
  alter table public.lender_list add column if not exists reason text;
  alter table public.lender_list add column if not exists emi_amount numeric(12,2) DEFAULT 0 NOT NULL;
  alter table public.lender_list add column if not exists start_date date;
  alter table public.lender_list add column if not exists status smallint DEFAULT 1 NOT NULL;
  alter table public.lender_list add column if not exists date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.loan_payments add column if not exists id integer;
  alter table public.loan_payments add column if not exists lender_id integer;
  alter table public.loan_payments add column if not exists amount_paid double precision DEFAULT 0 NOT NULL;
  alter table public.loan_payments add column if not exists payment_date date;
  alter table public.loan_payments add column if not exists remarks text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.login_throttle add column if not exists id bigint;
  alter table public.login_throttle add column if not exists email text;
  alter table public.login_throttle add column if not exists ip_address text;
  alter table public.login_throttle add column if not exists attempt_count integer DEFAULT 0 NOT NULL;
  alter table public.login_throttle add column if not exists lock_repeats integer DEFAULT 0 NOT NULL;
  alter table public.login_throttle add column if not exists first_attempt_at timestamp with time zone;
  alter table public.login_throttle add column if not exists lockout_until timestamp with time zone;
  alter table public.login_throttle add column if not exists last_attempt_at timestamp with time zone DEFAULT now() NOT NULL;
  alter table public.login_throttle add column if not exists updated_at timestamp with time zone DEFAULT now() NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.mechanic_commission_history add column if not exists id integer;
  alter table public.mechanic_commission_history add column if not exists mechanic_id integer;
  alter table public.mechanic_commission_history add column if not exists commission_percent numeric(5,2);
  alter table public.mechanic_commission_history add column if not exists effective_date date;
  alter table public.mechanic_commission_history add column if not exists date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.mechanic_list add column if not exists id integer;
  alter table public.mechanic_list add column if not exists firstname character varying(250);
  alter table public.mechanic_list add column if not exists middlename text;
  alter table public.mechanic_list add column if not exists lastname character varying(250);
  alter table public.mechanic_list add column if not exists contact character varying(50);
  alter table public.mechanic_list add column if not exists designation character varying(100) DEFAULT 'Mechanic'::character varying;
  alter table public.mechanic_list add column if not exists daily_salary numeric(12,2) DEFAULT 0.00;
  alter table public.mechanic_list add column if not exists avatar character varying(255) DEFAULT 'default-avatar.jpg'::character varying;
  alter table public.mechanic_list add column if not exists commission_percent numeric(5,2) DEFAULT 0.00;
  alter table public.mechanic_list add column if not exists status smallint DEFAULT 1 NOT NULL;
  alter table public.mechanic_list add column if not exists delete_flag smallint DEFAULT 0 NOT NULL;
  alter table public.mechanic_list add column if not exists date_added timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.mechanic_list add column if not exists date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
  alter table public.mechanic_list add column if not exists salary_per_day numeric(10,2) DEFAULT 0.00 NOT NULL;
  alter table public.mechanic_list add column if not exists image_path text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.mechanic_salary_history add column if not exists id integer;
  alter table public.mechanic_salary_history add column if not exists mechanic_id integer;
  alter table public.mechanic_salary_history add column if not exists salary numeric(12,2) DEFAULT 0.00 NOT NULL;
  alter table public.mechanic_salary_history add column if not exists effective_date date;
  alter table public.mechanic_salary_history add column if not exists date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.message_list add column if not exists id integer;
  alter table public.message_list add column if not exists fullname text;
  alter table public.message_list add column if not exists contact text;
  alter table public.message_list add column if not exists email text;
  alter table public.message_list add column if not exists message text;
  alter table public.message_list add column if not exists status smallint DEFAULT 0 NOT NULL;
  alter table public.message_list add column if not exists date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.payment_reminders add column if not exists id bigint;
  alter table public.payment_reminders add column if not exists client_id bigint;
  alter table public.payment_reminders add column if not exists amount_due numeric(15,2) DEFAULT 0 NOT NULL;
  alter table public.payment_reminders add column if not exists reminder_date timestamp with time zone DEFAULT now() NOT NULL;
  alter table public.payment_reminders add column if not exists channel character varying(50) DEFAULT 'System Alert'::character varying;
  alter table public.payment_reminders add column if not exists status character varying(50) DEFAULT 'Sent'::character varying;
  alter table public.payment_reminders add column if not exists remarks text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.product_list add column if not exists id integer;
  alter table public.product_list add column if not exists name text;
  alter table public.product_list add column if not exists description text;
  alter table public.product_list add column if not exists cost_price numeric(15,2) DEFAULT 0 NOT NULL;
  alter table public.product_list add column if not exists price numeric(15,2) DEFAULT 0 NOT NULL;
  alter table public.product_list add column if not exists image_path text;
  alter table public.product_list add column if not exists status smallint DEFAULT 1 NOT NULL;
  alter table public.product_list add column if not exists delete_flag smallint DEFAULT 0 NOT NULL;
  alter table public.product_list add column if not exists date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.product_list add column if not exists date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.product_list add column if not exists hsn character varying(20) DEFAULT ''::character varying NOT NULL;
  alter table public.product_list add column if not exists alert_quantity integer DEFAULT 0 NOT NULL;
  alter table public.product_list add column if not exists barcode character varying(100) DEFAULT NULL::character varying;
  alter table public.product_list add column if not exists place_zone text;
  alter table public.product_list add column if not exists place_rack text;
  alter table public.product_list add column if not exists place_bin text;
  alter table public.product_list add column if not exists place_box text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.profiles add column if not exists id uuid;
  alter table public.profiles add column if not exists full_name text;
  alter table public.profiles add column if not exists role text DEFAULT 'staff'::text;
  alter table public.profiles add column if not exists avatar_url text;
  alter table public.profiles add column if not exists updated_at timestamp with time zone DEFAULT now();
  alter table public.profiles add column if not exists mechanic_id bigint;
  alter table public.profiles add column if not exists email text;
  alter table public.profiles add column if not exists date_updated timestamp with time zone DEFAULT now();
  alter table public.profiles add column if not exists client_id bigint;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.user_presence add column if not exists user_id uuid;
  alter table public.user_presence add column if not exists status text DEFAULT 'offline'::text;
  alter table public.user_presence add column if not exists last_seen timestamptz DEFAULT now();
  alter table public.user_presence add column if not exists updated_at timestamptz DEFAULT now();
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.messages add column if not exists id bigint;
  alter table public.messages add column if not exists sender_id uuid;
  alter table public.messages add column if not exists recipient_id uuid;
  alter table public.messages add column if not exists content text;
  alter table public.messages add column if not exists read_at timestamptz;
  alter table public.messages add column if not exists created_at timestamptz DEFAULT now();
  alter table public.messages add column if not exists delivered_at timestamptz;
  alter table public.messages add column if not exists media_url text;
  alter table public.messages add column if not exists media_type text;
  alter table public.messages add column if not exists media_name text;
  alter table public.messages add column if not exists deleted_at timestamptz;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.service_list add column if not exists id integer;
  alter table public.service_list add column if not exists name text;
  alter table public.service_list add column if not exists description text;
  alter table public.service_list add column if not exists price numeric(12,2) DEFAULT 0.00 NOT NULL;
  alter table public.service_list add column if not exists status smallint DEFAULT 1 NOT NULL;
  alter table public.service_list add column if not exists delete_flag smallint DEFAULT 0 NOT NULL;
  alter table public.service_list add column if not exists date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.service_list add column if not exists date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.service_list add column if not exists hsn character varying(20) DEFAULT ''::character varying NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.spare_supplier add column if not exists spare_id bigint;
  alter table public.spare_supplier add column if not exists supplier_id bigint;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.suppliers add column if not exists id bigint;
  alter table public.suppliers add column if not exists name text DEFAULT ''::text NOT NULL;
  alter table public.suppliers add column if not exists contact text DEFAULT ''::text NOT NULL;
  alter table public.suppliers add column if not exists email text DEFAULT ''::text NOT NULL;
  alter table public.suppliers add column if not exists address text DEFAULT ''::text NOT NULL;
  alter table public.suppliers add column if not exists status bigint DEFAULT 1 NOT NULL;
  alter table public.suppliers add column if not exists delete_flag bigint DEFAULT 0 NOT NULL;
  alter table public.suppliers add column if not exists date_created timestamp with time zone DEFAULT now() NOT NULL;
  alter table public.suppliers add column if not exists date_updated timestamp with time zone DEFAULT now() NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.system_info add column if not exists id integer;
  alter table public.system_info add column if not exists meta_field text;
  alter table public.system_info add column if not exists meta_value text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.transaction_images add column if not exists id integer;
  alter table public.transaction_images add column if not exists transaction_id integer;
  alter table public.transaction_images add column if not exists image_path character varying(255);
  alter table public.transaction_images add column if not exists date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.transaction_list add column if not exists id integer;
  alter table public.transaction_list add column if not exists user_id integer;
  alter table public.transaction_list add column if not exists mechanic_id integer;
  alter table public.transaction_list add column if not exists code character varying(100);
  alter table public.transaction_list add column if not exists job_id character varying(20) DEFAULT NULL::character varying;
  alter table public.transaction_list add column if not exists client_name text;
  alter table public.transaction_list add column if not exists fault text;
  alter table public.transaction_list add column if not exists remark text;
  alter table public.transaction_list add column if not exists item text;
  alter table public.transaction_list add column if not exists uniq_id text;
  alter table public.transaction_list add column if not exists amount numeric(15,2) DEFAULT 0 NOT NULL;
  alter table public.transaction_list add column if not exists mechanic_amount numeric(12,2) DEFAULT 0 NOT NULL;
  alter table public.transaction_list add column if not exists mechanic_commission_amount numeric(12,2) DEFAULT 0;
  alter table public.transaction_list add column if not exists del_status smallint DEFAULT 0 NOT NULL;
  alter table public.transaction_list add column if not exists status smallint DEFAULT 0 NOT NULL;
  alter table public.transaction_list add column if not exists date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.transaction_list add column if not exists date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.transaction_list add column if not exists date_completed timestamp with time zone;
  alter table public.transaction_list add column if not exists location_id integer;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.transaction_products add column if not exists transaction_id integer;
  alter table public.transaction_products add column if not exists product_id integer;
  alter table public.transaction_products add column if not exists product_name text;
  alter table public.transaction_products add column if not exists qty integer DEFAULT 0 NOT NULL;
  alter table public.transaction_products add column if not exists price numeric(12,2) DEFAULT 0.00 NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.transaction_services add column if not exists transaction_id integer;
  alter table public.transaction_services add column if not exists service_id integer;
  alter table public.transaction_services add column if not exists service_name text;
  alter table public.transaction_services add column if not exists price numeric(12,2) DEFAULT 0.00 NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.users add column if not exists id integer;
  alter table public.users add column if not exists firstname character varying(250);
  alter table public.users add column if not exists lastname character varying(250);
  alter table public.users add column if not exists username character varying(100);
  alter table public.users add column if not exists password character varying(255);
  alter table public.users add column if not exists avatar text;
  alter table public.users add column if not exists last_login timestamp with time zone;
  alter table public.users add column if not exists type smallint DEFAULT 0 NOT NULL;
  alter table public.users add column if not exists mechanic_id integer;
  alter table public.users add column if not exists date_added timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
  alter table public.users add column if not exists date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.wp_template_history add column if not exists id bigint;
  alter table public.wp_template_history add column if not exists template_key text DEFAULT ''::text NOT NULL;
  alter table public.wp_template_history add column if not exists action text DEFAULT ''::text NOT NULL;
  alter table public.wp_template_history add column if not exists old_value text;
  alter table public.wp_template_history add column if not exists new_value text;
  alter table public.wp_template_history add column if not exists changed_by text DEFAULT ''::text NOT NULL;
  alter table public.wp_template_history add column if not exists changed_at timestamp with time zone DEFAULT now() NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.location_zones add column if not exists id integer;
  alter table public.location_zones add column if not exists name text;
  alter table public.location_zones add column if not exists status int NOT NULL DEFAULT 1;
  alter table public.location_zones add column if not exists delete_flag int NOT NULL DEFAULT 0;
  alter table public.location_zones add column if not exists created_at timestamptz DEFAULT now();
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.location_racks add column if not exists id integer;
  alter table public.location_racks add column if not exists zone_id integer;
  alter table public.location_racks add column if not exists name text;
  alter table public.location_racks add column if not exists status int NOT NULL DEFAULT 1;
  alter table public.location_racks add column if not exists delete_flag int NOT NULL DEFAULT 0;
  alter table public.location_racks add column if not exists created_at timestamptz DEFAULT now();
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.location_bins add column if not exists id integer;
  alter table public.location_bins add column if not exists rack_id integer;
  alter table public.location_bins add column if not exists name text;
  alter table public.location_bins add column if not exists status int NOT NULL DEFAULT 1;
  alter table public.location_bins add column if not exists delete_flag int NOT NULL DEFAULT 0;
  alter table public.location_bins add column if not exists created_at timestamptz DEFAULT now();
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.location_boxes add column if not exists id integer;
  alter table public.location_boxes add column if not exists bin_id integer;
  alter table public.location_boxes add column if not exists name text;
  alter table public.location_boxes add column if not exists status int NOT NULL DEFAULT 1;
  alter table public.location_boxes add column if not exists delete_flag int NOT NULL DEFAULT 0;
  alter table public.location_boxes add column if not exists created_at timestamptz DEFAULT now();
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.locations add column if not exists id integer;
  alter table public.locations add column if not exists zone text;
  alter table public.locations add column if not exists rack text NOT NULL DEFAULT ''::text;
  alter table public.locations add column if not exists bin text NOT NULL DEFAULT ''::text;
  alter table public.locations add column if not exists box text NOT NULL DEFAULT ''::text;
  alter table public.locations add column if not exists label text;
  alter table public.locations add column if not exists status int NOT NULL DEFAULT 1;
  alter table public.locations add column if not exists delete_flag int NOT NULL DEFAULT 0;
  alter table public.locations add column if not exists created_at timestamptz DEFAULT now();
  alter table public.locations add column if not exists code text;
  alter table public.locations add column if not exists zone_id integer;
  alter table public.locations add column if not exists rack_id integer;
  alter table public.locations add column if not exists bin_id integer;
  alter table public.locations add column if not exists box_id integer;
  alter table public.locations add column if not exists kind text NOT NULL DEFAULT 'inventory'::text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.product_locations add column if not exists product_id integer;
  alter table public.product_locations add column if not exists location_id integer;
  alter table public.product_locations add column if not exists created_at timestamptz DEFAULT now();
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.purchase_order_items add column if not exists id bigint;
  alter table public.purchase_order_items add column if not exists purchase_order_id bigint;
  alter table public.purchase_order_items add column if not exists product_id bigint;
  alter table public.purchase_order_items add column if not exists qty_ordered integer DEFAULT 0 NOT NULL;
  alter table public.purchase_order_items add column if not exists qty_received integer DEFAULT 0 NOT NULL;
  alter table public.purchase_order_items add column if not exists unit_cost numeric(12,2) DEFAULT 0 NOT NULL;
  alter table public.purchase_order_items add column if not exists date_created timestamp with time zone DEFAULT now() NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.purchase_orders add column if not exists id bigint;
  alter table public.purchase_orders add column if not exists po_code text;
  alter table public.purchase_orders add column if not exists supplier_id bigint;
  alter table public.purchase_orders add column if not exists status text DEFAULT 'pending'::text NOT NULL;
  alter table public.purchase_orders add column if not exists expected_date date;
  alter table public.purchase_orders add column if not exists notes text DEFAULT ''::text;
  alter table public.purchase_orders add column if not exists total_amount numeric(12,2) DEFAULT 0 NOT NULL;
  alter table public.purchase_orders add column if not exists received_date date;
  alter table public.purchase_orders add column if not exists date_created timestamp with time zone DEFAULT now() NOT NULL;
  alter table public.purchase_orders add column if not exists date_updated timestamp with time zone DEFAULT now() NOT NULL;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.push_subscriptions add column if not exists id bigint;
  alter table public.push_subscriptions add column if not exists user_id uuid;
  alter table public.push_subscriptions add column if not exists endpoint text;
  alter table public.push_subscriptions add column if not exists p256dh text DEFAULT ''::text NOT NULL;
  alter table public.push_subscriptions add column if not exists auth text DEFAULT ''::text NOT NULL;
  alter table public.push_subscriptions add column if not exists device_name text DEFAULT ''::text;
  alter table public.push_subscriptions add column if not exists enabled boolean DEFAULT true NOT NULL;
  alter table public.push_subscriptions add column if not exists date_created timestamp with time zone DEFAULT now() NOT NULL;
  alter table public.push_subscriptions add column if not exists date_updated timestamp with time zone DEFAULT now() NOT NULL;
exception when duplicate_column then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEQUENCES (28 CREATE SEQUENCE) + OWNED BY + id DEFAULT wiring (step 7)
--   CREATE SEQUENCE IF NOT EXISTS (params verbatim); `OWNER TO` DROP.
--   OWNED BY aur SET DEFAULT nextval() idempotent hain (safe re-run).
--   setval() lines intentionally DROP — sirf fresh-DB ke liye the, aur app ke
--   paas reset_sequence() hai; live DB pe sequences ka data hum nahi chhedte.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS public.advance_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.advance_payments_id_seq OWNED BY public.advance_payments.id;
ALTER TABLE ONLY public.advance_payments ALTER COLUMN id SET DEFAULT nextval('public.advance_payments_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.attendance_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.attendance_list_id_seq OWNED BY public.attendance_list.id;
ALTER TABLE ONLY public.attendance_list ALTER COLUMN id SET DEFAULT nextval('public.attendance_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.client_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.client_list_id_seq OWNED BY public.client_list.id;
ALTER TABLE ONLY public.client_list ALTER COLUMN id SET DEFAULT nextval('public.client_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.client_loans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.client_loans_id_seq OWNED BY public.client_loans.id;
ALTER TABLE ONLY public.client_loans ALTER COLUMN id SET DEFAULT nextval('public.client_loans_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.client_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.client_payments_id_seq OWNED BY public.client_payments.id;
ALTER TABLE ONLY public.client_payments ALTER COLUMN id SET DEFAULT nextval('public.client_payments_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.direct_sale_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.direct_sale_items_id_seq OWNED BY public.direct_sale_items.id;
ALTER TABLE ONLY public.direct_sale_items ALTER COLUMN id SET DEFAULT nextval('public.direct_sale_items_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.direct_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.direct_sales_id_seq OWNED BY public.direct_sales.id;
ALTER TABLE ONLY public.direct_sales ALTER COLUMN id SET DEFAULT nextval('public.direct_sales_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.expense_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.expense_list_id_seq OWNED BY public.expense_list.id;
ALTER TABLE ONLY public.expense_list ALTER COLUMN id SET DEFAULT nextval('public.expense_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.inventory_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.inventory_list_id_seq OWNED BY public.inventory_list.id;
ALTER TABLE ONLY public.inventory_list ALTER COLUMN id SET DEFAULT nextval('public.inventory_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.job_id_counter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.job_id_counter_id_seq OWNED BY public.job_id_counter.id;
ALTER TABLE ONLY public.job_id_counter ALTER COLUMN id SET DEFAULT nextval('public.job_id_counter_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.lender_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.lender_list_id_seq OWNED BY public.lender_list.id;
ALTER TABLE ONLY public.lender_list ALTER COLUMN id SET DEFAULT nextval('public.lender_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.loan_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.loan_payments_id_seq OWNED BY public.loan_payments.id;
ALTER TABLE ONLY public.loan_payments ALTER COLUMN id SET DEFAULT nextval('public.loan_payments_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.mechanic_commission_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.mechanic_commission_history_id_seq OWNED BY public.mechanic_commission_history.id;
ALTER TABLE ONLY public.mechanic_commission_history ALTER COLUMN id SET DEFAULT nextval('public.mechanic_commission_history_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.mechanic_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.mechanic_list_id_seq OWNED BY public.mechanic_list.id;
ALTER TABLE ONLY public.mechanic_list ALTER COLUMN id SET DEFAULT nextval('public.mechanic_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.mechanic_salary_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.mechanic_salary_history_id_seq OWNED BY public.mechanic_salary_history.id;
ALTER TABLE ONLY public.mechanic_salary_history ALTER COLUMN id SET DEFAULT nextval('public.mechanic_salary_history_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.message_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.message_list_id_seq OWNED BY public.message_list.id;
ALTER TABLE ONLY public.message_list ALTER COLUMN id SET DEFAULT nextval('public.message_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.payment_reminders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payment_reminders_id_seq OWNED BY public.payment_reminders.id;
ALTER TABLE ONLY public.payment_reminders ALTER COLUMN id SET DEFAULT nextval('public.payment_reminders_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.product_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.product_list_id_seq OWNED BY public.product_list.id;
ALTER TABLE ONLY public.product_list ALTER COLUMN id SET DEFAULT nextval('public.product_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.service_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.service_list_id_seq OWNED BY public.service_list.id;
ALTER TABLE ONLY public.service_list ALTER COLUMN id SET DEFAULT nextval('public.service_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.system_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.system_info_id_seq OWNED BY public.system_info.id;
ALTER TABLE ONLY public.system_info ALTER COLUMN id SET DEFAULT nextval('public.system_info_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.transaction_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.transaction_images_id_seq OWNED BY public.transaction_images.id;
ALTER TABLE ONLY public.transaction_images ALTER COLUMN id SET DEFAULT nextval('public.transaction_images_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.transaction_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.transaction_list_id_seq OWNED BY public.transaction_list.id;
ALTER TABLE ONLY public.transaction_list ALTER COLUMN id SET DEFAULT nextval('public.transaction_list_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.location_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.location_zones_id_seq OWNED BY public.location_zones.id;
ALTER TABLE ONLY public.location_zones ALTER COLUMN id SET DEFAULT nextval('public.location_zones_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.location_racks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.location_racks_id_seq OWNED BY public.location_racks.id;
ALTER TABLE ONLY public.location_racks ALTER COLUMN id SET DEFAULT nextval('public.location_racks_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.location_bins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.location_bins_id_seq OWNED BY public.location_bins.id;
ALTER TABLE ONLY public.location_bins ALTER COLUMN id SET DEFAULT nextval('public.location_bins_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.location_boxes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.location_boxes_id_seq OWNED BY public.location_boxes.id;
ALTER TABLE ONLY public.location_boxes ALTER COLUMN id SET DEFAULT nextval('public.location_boxes_id_seq'::regclass);

CREATE SEQUENCE IF NOT EXISTS public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;
ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);

-- ═══════════════════════════════════════════════════════════════════════════
-- IDENTITY COLUMNS (7) — `ADD GENERATED ... AS IDENTITY` idempotent NAHI hai,
-- isliye har identity-grant pg_attribute.attidentity check se guard kiya hai.
--   (6x GENERATED BY DEFAULT + 1x GENERATED ALWAYS [login_throttle])
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.activity_logs'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.activity_logs alter column id add generated by default as identity (SEQUENCE NAME public.activity_logs_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.login_throttle'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.login_throttle alter column id add generated always as identity (SEQUENCE NAME public.login_throttle_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.suppliers'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.suppliers alter column id add generated by default as identity (SEQUENCE NAME public.suppliers_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.purchase_order_items'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.purchase_order_items alter column id add generated by default as identity (SEQUENCE NAME public.purchase_order_items_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.purchase_orders'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.purchase_orders alter column id add generated by default as identity (SEQUENCE NAME public.purchase_orders_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.push_subscriptions'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.push_subscriptions alter column id add generated by default as identity (SEQUENCE NAME public.push_subscriptions_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.wp_template_history'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.wp_template_history alter column id add generated by default as identity (SEQUENCE NAME public.wp_template_history_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.messages'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.messages alter column id add generated by default as identity;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS (15) — CREATE OR REPLACE FUNCTION (signatures/bodies verbatim).
-- NOTE: create-or-replace return type nahi badal sakta, par signatures verbatim
-- preserve hone se ye safe hai. `ALTER FUNCTION ... OWNER` DROP kar diya hai.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_transactions_with_client_data(date_from date DEFAULT NULL::date, date_to date DEFAULT NULL::date) RETURNS TABLE(id integer, job_id character varying, code character varying, client_name integer, item text, fault text, uniq_id character varying, amount numeric, status integer, date_created timestamp with time zone, date_updated timestamp with time zone, date_completed timestamp with time zone, del_status integer, client_firstname character varying, client_middlename character varying, client_lastname character varying, client_contact character varying, client_opening_balance numeric, total_billed numeric, total_paid numeric, total_sale numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.job_id,
        t.code,
        t.client_name::INT,                     -- cast text to int (ensure all values are numeric)
        t.item,
        t.fault,
        t.uniq_id,
        t.amount,
        t.status,
        t.date_created,
        t.date_updated,
        t.date_completed,
        t.del_status,
        c.firstname,
        c.middlename,
        c.lastname,
        c.contact,
        COALESCE(c.opening_balance, 0) AS client_opening_balance,
        -- total billed (status = 5)
        (SELECT COALESCE(SUM(amount), 0) FROM transaction_list WHERE client_name = c.id::text AND status = 5) AS total_billed,
        -- total paid (payments + discount)
        (SELECT COALESCE(SUM(amount + COALESCE(discount, 0)), 0) FROM client_payments WHERE client_id = c.id) AS total_paid,
        -- total sales from direct_sales
        (SELECT COALESCE(SUM(total_amount), 0) FROM direct_sales WHERE client_id = c.id) AS total_sale
    FROM transaction_list t
    INNER JOIN client_list c ON t.client_name::INT = c.id   -- join on integer after casting
    WHERE t.del_status = 0
      AND (date_from IS NULL OR t.date_created >= date_from::TIMESTAMPTZ)
      AND (date_to IS NULL OR t.date_created <= (date_to::TIMESTAMPTZ + INTERVAL '1 day' - INTERVAL '1 second'))
    ORDER BY t.job_id DESC, t.date_created DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'staff'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_role_escalation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- Browser clients (anon / authenticated JWT) sirf role='staff' set kar sakte hain.
  -- Service-role (admin APIs) is check se unaffected hai.
  if auth.role() in ('anon', 'authenticated') and new.role is distinct from 'staff' then
    raise exception 'Role escalation not allowed';
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.reset_sequence(table_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  seq_name text;
  max_id   bigint;
  new_val  bigint;
BEGIN
  -- Is table ke 'id' column ki sequence dhundo
  SELECT pg_get_serial_sequence(table_name, 'id') INTO seq_name;

  IF seq_name IS NULL THEN
    RETURN 'SKIP: ' || table_name || ' (no sequence found)';
  END IF;

  -- Current max ID fetch karo
  EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', table_name) INTO max_id;

  new_val := max_id + 1;

  -- Sequence reset karo
  PERFORM setval(seq_name, new_val, false);

  RETURN 'OK: ' || table_name || ' → next_id = ' || new_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_date_updated() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.date_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_today_start text, p_today_end text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER STABLE
    AS $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'totalJobs',       (select count(*) from public.transaction_list where del_status = 0),
    'pendingJobs',     (select count(*) from public.transaction_list where del_status = 0 and status = 0),
    'inProgressJobs',  (select count(*) from public.transaction_list where del_status = 0 and status = 1),
    'finishedJobs',    (select count(*) from public.transaction_list where del_status = 0 and status = 2),
    'paidJobs',        (select count(*) from public.transaction_list where del_status = 0 and status = 3),
    'cancelledJobs',   (select count(*) from public.transaction_list where del_status = 0 and status = 4),
    'deliveredJobs',   (select count(*) from public.transaction_list where del_status = 0 and status = 5),
    'totalClients',    (select count(*) from public.client_list where delete_flag = 0),
    'totalMechanics',  (select count(*) from public.mechanic_list where delete_flag = 0 and status = 1),
    'todayRepair',     (select coalesce(sum(amount), 0) from public.transaction_list where status = 5 and del_status = 0 and date_completed >= p_today_start::timestamptz and date_completed <= p_today_end::timestamptz),
    'todayDirect',     (select coalesce(sum(total_amount), 0) from public.direct_sales where date_created >= p_today_start::timestamptz and date_created <= p_today_end::timestamptz)
  ) into result;
  return result;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_financial_summary(p_from text, p_to text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER STABLE
    AS $$
declare
  result jsonb;
  v_from timestamptz;
  v_to   timestamptz;
  v_repair_inc  numeric;
  v_direct_inc  numeric;
  v_total_sales numeric;
  v_parts_trans numeric;
  v_parts_direct numeric;
  v_parts_cost  numeric;
  v_discounts   numeric;
  v_salary      numeric;
  v_loan_paid   numeric;
  v_expenses    numeric;
  v_tx_ids      int[];
  v_ds_ids      int[];
begin
  v_from := (p_from || 'T00:00:00+05:30')::timestamptz;
  v_to   := (p_to || 'T23:59:59+05:30')::timestamptz;

  select coalesce(sum(amount), 0) into v_repair_inc
    from public.transaction_list
   where status = 5 and del_status = 0
     and date_completed >= v_from and date_completed <= v_to;

  select coalesce(sum(total_amount), 0) into v_direct_inc
    from public.direct_sales
   where date_created >= v_from and date_created <= v_to;

  v_total_sales := v_repair_inc + v_direct_inc;

  select array_agg(id) into v_tx_ids
    from public.transaction_list
   where status = 5 and del_status = 0
     and date_completed >= v_from and date_completed <= v_to;

  select array_agg(id) into v_ds_ids
    from public.direct_sales
   where date_created >= v_from and date_created <= v_to;

  select coalesce(sum(
    tp.qty * case
      when p.cost_price is not null and p.cost_price > 0 then p.cost_price
      else tp.price * 0.9
    end
  ), 0) into v_parts_trans
  from public.transaction_products tp
  left join public.product_list p on p.id = tp.product_id
  where v_tx_ids is not null and tp.transaction_id = any(v_tx_ids);

  select coalesce(sum(
    di.qty * case
      when p.cost_price is not null and p.cost_price > 0 then p.cost_price
      else di.price * 0.9
    end
  ), 0) into v_parts_direct
  from public.direct_sale_items di
  left join public.product_list p on p.id = di.product_id
  where v_ds_ids is not null and di.sale_id = any(v_ds_ids);

  v_parts_cost := v_parts_trans + v_parts_direct;

  select coalesce(sum(discount), 0) into v_discounts
    from public.client_payments
   where payment_date >= p_from and payment_date <= p_to;

  select coalesce(sum(
    case
      when a.status = 1 then m.daily_salary
      when a.status = 3 then m.daily_salary / 2
      else 0
    end
  ), 0) into v_salary
  from public.attendance_list a
  join public.mechanic_list m on m.id = a.mechanic_id
  where a.curr_date >= p_from and a.curr_date <= p_to
    and a.status in (1, 3);

  select coalesce(sum(amount_paid), 0) into v_loan_paid
    from public.loan_payments
   where payment_date >= p_from and payment_date <= p_to;

  select coalesce(sum(amount), 0) into v_expenses
    from public.expense_list
   where date_created >= v_from and date_created <= v_to;

  result := jsonb_build_object(
    'totalSales',   v_total_sales,
    'partsCost',    v_parts_cost,
    'grossProfit',  v_total_sales - v_parts_cost,
    'discounts',    v_discounts,
    'salary',       v_salary,
    'loanPaid',     v_loan_paid,
    'expenses',     v_expenses,
    'totalOutflow', v_discounts + v_salary + v_loan_paid + v_expenses,
    'netProfit',    (v_total_sales - v_parts_cost) - (v_discounts + v_salary + v_loan_paid + v_expenses)
  );

  return result;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_revenue(p_months integer DEFAULT 12) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER STABLE
    AS $$
declare
  result jsonb;
  month_label text;
  month_revenue numeric;
  months_arr jsonb := '[]'::jsonb;
  i int;
  m_date date;
  m_start timestamptz;
  m_end timestamptz;
begin
  for i in 0 .. (p_months - 1) loop
    m_date := date_trunc('month', current_date) - (i || ' months')::interval;
    m_start := (date_trunc('month', m_date))::timestamptz;
    m_end   := (date_trunc('month', m_date) + interval '1 month - 1 second')::timestamptz;

    month_label := to_char(m_date, 'Mon YY');

    select coalesce(sum(repair_rev + direct_rev), 0) into month_revenue
    from (
      select coalesce(sum(amount), 0) as repair_rev, 0 as direct_rev
        from public.transaction_list
       where status = 5 and del_status = 0
         and date_completed >= m_start and date_completed <= m_end
      union all
      select 0 as repair_rev, coalesce(sum(total_amount), 0) as direct_rev
        from public.direct_sales
       where date_created >= m_start and date_created <= m_end
    ) t;

    months_arr := months_arr || jsonb_build_object(
      'month', month_label,
      'revenue', month_revenue
    );
  end loop;

  result := (
    select jsonb_agg(elem)
    from (select elem from jsonb_array_elements(months_arr) with ordinality AS t(elem, pos) order by t.pos desc) sub
  );

  return coalesce(result, '[]'::jsonb);
end;
$$;

CREATE OR REPLACE FUNCTION public.get_my_client_id() RETURNS bigint
    LANGUAGE sql SECURITY DEFINER STABLE
    SET search_path TO public
    AS $$
  select client_id from public.profiles where id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text
    LANGUAGE sql SECURITY DEFINER STABLE
    SET search_path TO public
    AS $$
  select role from public.profiles where id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_technician_metrics(p_from text, p_to text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER STABLE
    AS $$
declare
  result jsonb;
  v_from date := p_from::date;
  v_to   date := p_to::date;
begin
  select jsonb_agg(row_to_json(t)) into result
  from (
    select
      m.id,
      m.firstname || ' ' || coalesce(m.lastname, '') as name,
      m.designation,
      m.daily_salary,
      m.commission_percent,
      m.image_path,

      coalesce(job_stats.jobs_completed, 0) as jobs_completed,
      coalesce(job_stats.jobs_revenue, 0) as jobs_revenue,
      coalesce(job_stats.jobs_commission, 0) as jobs_commission,

      coalesce(att_stats.full_days, 0) as full_days,
      coalesce(att_stats.half_days, 0) as half_days,
      coalesce(att_stats.absent_days, 0) as absent_days,
      coalesce(att_stats.total_attended, 0) as total_attended,
      coalesce(att_stats.working_days, 0) as working_days,

      coalesce(att_stats.salary_earned, 0) as salary_earned,

      job_stats.avg_repair_hours

    from public.mechanic_list m

    left join lateral (
      select
        count(*) as jobs_completed,
        coalesce(sum(t.amount), 0) as jobs_revenue,
        coalesce(sum(t.mechanic_commission_amount), 0) as jobs_commission,
        case when count(*) > 0
          then round(extract(epoch from avg(t.date_completed - t.date_created)) / 3600, 1)
          else null
        end as avg_repair_hours
      from public.transaction_list t
      where t.mechanic_id = m.id
        and t.status = 5
        and t.del_status = 0
        and t.date_completed >= (v_from || 'T00:00:00+05:30')::timestamptz
        and t.date_completed <= ((v_to || 'T23:59:59+05:30')::timestamptz)
    ) job_stats on true

    left join lateral (
      select
        count(*) filter (where a.status = 1) as full_days,
        count(*) filter (where a.status = 3) as half_days,
        count(*) filter (where a.status = 2) as absent_days,
        count(*) filter (where a.status in (1, 3)) as total_attended,
        count(*) as working_days,
        coalesce(sum(
          case
            when a.status = 1 then m.daily_salary
            when a.status = 3 then m.daily_salary / 2
            else 0
          end
        ), 0) as salary_earned
      from public.attendance_list a
      where a.mechanic_id = m.id
        and a.curr_date >= v_from
        and a.curr_date <= v_to
    ) att_stats on true

    where m.delete_flag = 0 and m.status = 1
    order by job_stats.jobs_completed desc nulls last
  ) t;

  return coalesce(result, '[]'::jsonb);
end;
$$;

CREATE OR REPLACE FUNCTION public.is_frontend_staff() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER STABLE
    SET search_path TO public
    AS $$
  select coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer');
$$;

CREATE OR REPLACE FUNCTION public.touch_purchase_orders() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.date_updated = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.touch_push_subscriptions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.date_updated = now();
  return new;
end;
$$;

-- ── I1: single-source stock RPC (added 20260903; also in 20260903_inventory_single_stock_rpc.sql) ──
CREATE OR REPLACE FUNCTION public.get_inventory_stock(
    p_product_ids int8[] DEFAULT NULL
) RETURNS TABLE(
    product_id        bigint,
    total_in          bigint,
    total_sold_job    bigint,
    total_sold_sale   bigint,
    total_sold        bigint,
    available         bigint,
    oversold          bigint,
    avg_purchase_cost numeric,
    last_stock_date   date,
    place             text
)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
AS $$
    WITH inv AS (
        SELECT product_id, SUM(quantity) AS total_in,
               COALESCE(NULLIF(SUM(CASE WHEN quantity > 0 THEN quantity * purchase_cost END), 0)
                        / NULLIF(SUM(CASE WHEN quantity > 0 THEN quantity END), 0), 0) AS avg_cost,
               MAX(stock_date) AS last_date,
               (array_agg(place ORDER BY stock_date DESC, id DESC))[1] AS place
        FROM public.inventory_list
        WHERE (p_product_ids IS NULL OR product_id = ANY (p_product_ids))
        GROUP BY product_id
    ),
    sold_job AS (
        SELECT tp.product_id, SUM(tp.qty) AS qty
        FROM public.transaction_products tp
        JOIN public.transaction_list t ON t.id = tp.transaction_id
        WHERE t.status <> 4
          AND (p_product_ids IS NULL OR tp.product_id = ANY (p_product_ids))
        GROUP BY tp.product_id
    ),
    sold_sale AS (
        SELECT product_id, SUM(qty) AS qty
        FROM public.direct_sale_items
        WHERE (p_product_ids IS NULL OR product_id = ANY (p_product_ids))
        GROUP BY product_id
    ),
    all_ids AS (
        SELECT product_id FROM inv
        UNION SELECT product_id FROM sold_job
        UNION SELECT product_id FROM sold_sale
    )
    SELECT a.product_id,
           COALESCE(i.total_in, 0)            AS total_in,
           COALESCE(j.qty, 0)                 AS total_sold_job,
           COALESCE(s.qty, 0)                 AS total_sold_sale,
           COALESCE(j.qty, 0) + COALESCE(s.qty, 0) AS total_sold,
           COALESCE(i.total_in, 0) - COALESCE(j.qty, 0) - COALESCE(s.qty, 0) AS available,
           GREATEST(0, COALESCE(j.qty, 0) + COALESCE(s.qty, 0) - COALESCE(i.total_in, 0)) AS oversold,
           COALESCE(i.avg_cost, 0)            AS avg_purchase_cost,
           i.last_date                        AS last_stock_date,
           i.place                            AS place
    FROM all_ids a
    LEFT JOIN inv  i ON i.product_id = a.product_id
    LEFT JOIN sold_job  j ON j.product_id = a.product_id
    LEFT JOIN sold_sale s ON s.product_id = a.product_id
    ORDER BY a.product_id;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_stock(int8[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_inventory_stock(int8[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_stock(int8[]) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — ENABLE (40 tables; idempotent, policies se pehle)
--   pg_dump ne har table ke liye `ENABLE ROW LEVEL SECURITY` diya tha. Policies
--   RLS OFF pe ignore hoti hain, isliye pehle sab tables pe RLS ENABLE karte hain.
--   NOTE: `SET row_security = off` danger hai — deliberately DROP; RLS enforced rahegi.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_id_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lender_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_throttle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_commission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_supplier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_template_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS (8) — DROP TRIGGER IF EXISTS + CREATE TRIGGER (data-safe)
--   Trigger functions (step d) pehle hi CREATE OR REPLACE ho chuki hain.
--   Note: in CREATEs me identifier case source se verbatim preserve hai
--   (PG case-sensitive identifiers tabhi jab "double-quoted" hain).
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_role_escalation_trigger BEFORE INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

DROP TRIGGER IF EXISTS trig_inventory_update_timestamp ON public.inventory_list;
CREATE TRIGGER trig_inventory_update_timestamp BEFORE UPDATE ON public.inventory_list FOR EACH ROW EXECUTE FUNCTION public.update_date_updated();

DROP TRIGGER IF EXISTS update_mechanic_timestamp ON public.mechanic_list;
CREATE TRIGGER update_mechanic_timestamp BEFORE UPDATE ON public.mechanic_list FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('date_updated');

DROP TRIGGER IF EXISTS update_product_timestamp ON public.product_list;
CREATE TRIGGER update_product_timestamp BEFORE UPDATE ON public.product_list FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('date_updated');

DROP TRIGGER IF EXISTS update_service_timestamp ON public.service_list;
CREATE TRIGGER update_service_timestamp BEFORE UPDATE ON public.service_list FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('date_updated');

DROP TRIGGER IF EXISTS update_transaction_timestamp ON public.transaction_list;
CREATE TRIGGER update_transaction_timestamp BEFORE UPDATE ON public.transaction_list FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('date_updated');

DROP TRIGGER IF EXISTS purchase_orders_touch ON public.purchase_orders;
CREATE TRIGGER purchase_orders_touch BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.touch_purchase_orders();

DROP TRIGGER IF EXISTS push_subscriptions_touch ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_touch BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_push_subscriptions();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES (48) — DROP POLICY IF EXISTS + CREATE POLICY (data-safe)
--   Har policy pehle DROP (agar maujood ho) phir CREATE. Policy names source
--   se normalize hokar consistent case me hain. RBI/RLS logic verbatim.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS rlslock_advance_payments_staff ON public.advance_payments;
CREATE POLICY rlslock_advance_payments_staff ON public.advance_payments TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_attendance_list_staff ON public.attendance_list;
CREATE POLICY rlslock_attendance_list_staff ON public.attendance_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_client_list_client_self ON public.client_list;
CREATE POLICY rlslock_client_list_client_self ON public.client_list FOR SELECT TO authenticated USING ((public.get_my_role() = 'client'::text) AND (id = public.get_my_client_id()));

DROP POLICY IF EXISTS rlslock_client_list_staff ON public.client_list;
CREATE POLICY rlslock_client_list_staff ON public.client_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_direct_sale_items_staff ON public.direct_sale_items;
CREATE POLICY rlslock_direct_sale_items_staff ON public.direct_sale_items TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_expense_list_staff ON public.expense_list;
CREATE POLICY rlslock_expense_list_staff ON public.expense_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_inventory_list_staff ON public.inventory_list;
CREATE POLICY rlslock_inventory_list_staff ON public.inventory_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_job_id_counter_staff ON public.job_id_counter;
CREATE POLICY rlslock_job_id_counter_staff ON public.job_id_counter TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_lender_list_staff ON public.lender_list;
CREATE POLICY rlslock_lender_list_staff ON public.lender_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_loan_payments_staff ON public.loan_payments;
CREATE POLICY rlslock_loan_payments_staff ON public.loan_payments TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_mech_commission_staff ON public.mechanic_commission_history;
CREATE POLICY rlslock_mech_commission_staff ON public.mechanic_commission_history TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_mechanic_list_staff ON public.mechanic_list;
CREATE POLICY rlslock_mechanic_list_staff ON public.mechanic_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_mech_salary_staff ON public.mechanic_salary_history;
CREATE POLICY rlslock_mech_salary_staff ON public.mechanic_salary_history TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_product_list_staff ON public.product_list;
CREATE POLICY rlslock_product_list_staff ON public.product_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_profiles_client_self ON public.profiles;
CREATE POLICY rlslock_profiles_client_self ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));

DROP POLICY IF EXISTS rlslock_profiles_client_self_update ON public.profiles;
CREATE POLICY rlslock_profiles_client_self_update ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()) AND (coalesce(role, '') = public.get_my_role()) AND (coalesce(client_id, '-1'::bigint) IS NOT DISTINCT FROM public.get_my_client_id()));

DROP POLICY IF EXISTS rlslock_profiles_staff ON public.profiles;
CREATE POLICY rlslock_profiles_staff ON public.profiles FOR SELECT TO authenticated USING (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_profiles_staff_update ON public.profiles;
CREATE POLICY rlslock_profiles_staff_update ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()) AND public.is_frontend_staff() AND (coalesce(role, '') = public.get_my_role()) AND (coalesce(client_id, '-1'::bigint) IS NOT DISTINCT FROM public.get_my_client_id()));

DROP POLICY IF EXISTS rlslock_service_list_staff ON public.service_list;
CREATE POLICY rlslock_service_list_staff ON public.service_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_transaction_images_staff ON public.transaction_images;
CREATE POLICY rlslock_transaction_images_staff ON public.transaction_images TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_transaction_products_staff ON public.transaction_products;
CREATE POLICY rlslock_transaction_products_staff ON public.transaction_products TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_transaction_services_staff ON public.transaction_services;
CREATE POLICY rlslock_transaction_services_staff ON public.transaction_services TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS hardening_activity_staff ON public.activity_logs;
CREATE POLICY hardening_activity_staff ON public.activity_logs TO authenticated USING ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text])));

DROP POLICY IF EXISTS hardening_msgs_anon_insert ON public.message_list;
CREATE POLICY hardening_msgs_anon_insert ON public.message_list FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS hardening_msgs_staff ON public.message_list;
CREATE POLICY hardening_msgs_staff ON public.message_list TO authenticated USING ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text])));

DROP POLICY IF EXISTS hardening_reminders_staff ON public.payment_reminders;
CREATE POLICY hardening_reminders_staff ON public.payment_reminders TO authenticated USING ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text])));

DROP POLICY IF EXISTS hardening_spare_staff ON public.spare_supplier;
CREATE POLICY hardening_spare_staff ON public.spare_supplier TO authenticated USING ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text])));

DROP POLICY IF EXISTS hardening_suppliers_staff ON public.suppliers;
CREATE POLICY hardening_suppliers_staff ON public.suppliers TO authenticated USING ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text])));

DROP POLICY IF EXISTS hardening_sysinfo_anon_read ON public.system_info;
CREATE POLICY hardening_sysinfo_anon_read ON public.system_info FOR SELECT TO anon USING ((meta_field = ANY (ARRAY['name'::text, 'short_name'::text, 'logo'::text, 'cover'::text, 'email'::text, 'contact'::text, 'address'::text, 'owner'::text, 'biz_days'::text, 'biz_open'::text, 'biz_close'::text, 'gst_no'::text, 'gstin'::text, 'map_url'::text, 'map_iframe'::text, 'whatsapp'::text, 'facebook'::text, 'instagram'::text, 'youtube'::text, 'footer_text'::text, 'announcement'::text])));

DROP POLICY IF EXISTS hardening_sysinfo_auth_read ON public.system_info;
CREATE POLICY hardening_sysinfo_auth_read ON public.system_info FOR SELECT TO authenticated USING ((meta_field <> ALL (ARRAY['ai_api_key'::text, 'csrf_token'::text])));

DROP POLICY IF EXISTS hardening_sysinfo_staff ON public.system_info;
CREATE POLICY hardening_sysinfo_staff ON public.system_info TO authenticated USING ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text])));

DROP POLICY IF EXISTS hardening_wptpl_staff ON public.wp_template_history;
CREATE POLICY hardening_wptpl_staff ON public.wp_template_history TO authenticated USING ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((COALESCE(( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())), ''::text) = ANY (ARRAY['admin'::text, 'staff'::text])));

DROP POLICY IF EXISTS portal_client_loans_staff ON public.client_loans;
CREATE POLICY portal_client_loans_staff ON public.client_loans TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS portal_client_payments_client_own ON public.client_payments;
CREATE POLICY portal_client_payments_client_own ON public.client_payments FOR SELECT TO authenticated USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'client'::text) AND (client_id = ( SELECT profiles.client_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));

DROP POLICY IF EXISTS portal_client_payments_staff ON public.client_payments;
CREATE POLICY portal_client_payments_staff ON public.client_payments TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS portal_direct_sales_staff ON public.direct_sales;
CREATE POLICY portal_direct_sales_staff ON public.direct_sales TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS portal_transaction_list_client_own ON public.transaction_list;
CREATE POLICY portal_transaction_list_client_own ON public.transaction_list FOR SELECT TO authenticated USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'client'::text) AND (client_name ~ '^[0-9]+$'::text) AND ((client_name)::bigint = ( SELECT profiles.client_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));

DROP POLICY IF EXISTS portal_transaction_list_staff ON public.transaction_list;
CREATE POLICY portal_transaction_list_staff ON public.transaction_list TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_purchase_orders_staff ON public.purchase_orders;
CREATE POLICY rlslock_purchase_orders_staff ON public.purchase_orders TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_purchase_order_items_staff ON public.purchase_order_items;
CREATE POLICY rlslock_purchase_order_items_staff ON public.purchase_order_items TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_push_subscriptions_staff ON public.push_subscriptions;
CREATE POLICY rlslock_push_subscriptions_staff ON public.push_subscriptions TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

DROP POLICY IF EXISTS rlslock_push_subscriptions_self ON public.push_subscriptions;
CREATE POLICY rlslock_push_subscriptions_self ON public.push_subscriptions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated access" ON public.locations;
CREATE POLICY "Allow authenticated access" ON public.locations TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access" ON public.location_zones;
CREATE POLICY "Allow authenticated access" ON public.location_zones TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access" ON public.location_racks;
CREATE POLICY "Allow authenticated access" ON public.location_racks TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access" ON public.location_bins;
CREATE POLICY "Allow authenticated access" ON public.location_bins TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access" ON public.location_boxes;
CREATE POLICY "Allow authenticated access" ON public.location_boxes TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rlslock_product_locations_staff ON public.product_locations;
CREATE POLICY rlslock_product_locations_staff ON public.product_locations TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

-- ── Messenger policies (20260901_messenger_presence / _enhancements / 20260903_fix) ──
DROP POLICY IF EXISTS msg_presence_staff_select ON public.user_presence;
CREATE POLICY msg_presence_staff_select ON public.user_presence FOR SELECT TO authenticated USING (public.is_frontend_staff());
DROP POLICY IF EXISTS msg_presence_self_write ON public.user_presence;
CREATE POLICY msg_presence_self_write ON public.user_presence FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_frontend_staff());

DROP POLICY IF EXISTS msg_messages_select ON public.messages;
CREATE POLICY msg_messages_select ON public.messages FOR SELECT TO authenticated USING (public.is_frontend_staff() AND (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'::text, 'developer'::text)) OR sender_id = auth.uid() OR recipient_id = auth.uid()));
DROP POLICY IF EXISTS msg_messages_insert ON public.messages;
CREATE POLICY msg_messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK (public.is_frontend_staff() AND sender_id = auth.uid());
DROP POLICY IF EXISTS msg_messages_update ON public.messages;
CREATE POLICY msg_messages_update ON public.messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid() AND public.is_frontend_staff()) WITH CHECK (recipient_id = auth.uid() AND public.is_frontend_staff());
DROP POLICY IF EXISTS msg_messages_delete ON public.messages;
CREATE POLICY msg_messages_delete ON public.messages FOR DELETE TO authenticated USING (public.is_frontend_staff() AND (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'::text, 'developer'::text)) OR sender_id = auth.uid()));


-- ===============================================================================
-- OUT-OF-LINE CONSTRAINTS (PK / UNIQUE / FK) -- SINGLE TRAILING IDEMPOTENT SECTION
--   Phase A: saare PRIMARY KEY / UNIQUE guards pehle (tables pehle hi bane hain).
--   Phase B: saare FOREIGN KEY guards baad me (Phase A ke PK exist karte hain).
--   Har constraint pg_constraint DO-guard se wrap hai (idempotent, data-safe).
-- ===============================================================================

-- ---- Phase A: PRIMARY KEY / UNIQUE ----------------------------------------

do $$ begin if not exists (select 1 from pg_constraint where conname='activity_logs_pkey' and conrelid='public.activity_logs'::regclass) then alter table only public.activity_logs add constraint activity_logs_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='advance_payments_pkey' and conrelid='public.advance_payments'::regclass) then alter table only public.advance_payments add constraint advance_payments_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='attendance_list_pkey' and conrelid='public.attendance_list'::regclass) then alter table only public.attendance_list add constraint attendance_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='attendance_list_mechanic_id_curr_date_key' and conrelid='public.attendance_list'::regclass) then alter table only public.attendance_list add constraint attendance_list_mechanic_id_curr_date_key unique (mechanic_id, curr_date); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='client_list_pkey' and conrelid='public.client_list'::regclass) then alter table only public.client_list add constraint client_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='client_loans_pkey' and conrelid='public.client_loans'::regclass) then alter table only public.client_loans add constraint client_loans_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='client_payments_pkey' and conrelid='public.client_payments'::regclass) then alter table only public.client_payments add constraint client_payments_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='direct_sale_items_pkey' and conrelid='public.direct_sale_items'::regclass) then alter table only public.direct_sale_items add constraint direct_sale_items_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='direct_sales_pkey' and conrelid='public.direct_sales'::regclass) then alter table only public.direct_sales add constraint direct_sales_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='expense_list_pkey' and conrelid='public.expense_list'::regclass) then alter table only public.expense_list add constraint expense_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='inventory_list_pkey' and conrelid='public.inventory_list'::regclass) then alter table only public.inventory_list add constraint inventory_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='job_id_counter_pkey' and conrelid='public.job_id_counter'::regclass) then alter table only public.job_id_counter add constraint job_id_counter_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='lender_list_pkey' and conrelid='public.lender_list'::regclass) then alter table only public.lender_list add constraint lender_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='loan_payments_pkey' and conrelid='public.loan_payments'::regclass) then alter table only public.loan_payments add constraint loan_payments_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='login_throttle_pkey' and conrelid='public.login_throttle'::regclass) then alter table only public.login_throttle add constraint login_throttle_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='mechanic_commission_history_pkey' and conrelid='public.mechanic_commission_history'::regclass) then alter table only public.mechanic_commission_history add constraint mechanic_commission_history_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='mechanic_list_pkey' and conrelid='public.mechanic_list'::regclass) then alter table only public.mechanic_list add constraint mechanic_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='mechanic_salary_history_pkey' and conrelid='public.mechanic_salary_history'::regclass) then alter table only public.mechanic_salary_history add constraint mechanic_salary_history_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='message_list_pkey' and conrelid='public.message_list'::regclass) then alter table only public.message_list add constraint message_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='payment_reminders_pkey' and conrelid='public.payment_reminders'::regclass) then alter table only public.payment_reminders add constraint payment_reminders_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='product_list_pkey' and conrelid='public.product_list'::regclass) then alter table only public.product_list add constraint product_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='profiles_pkey' and conrelid='public.profiles'::regclass) then alter table only public.profiles add constraint profiles_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='service_list_pkey' and conrelid='public.service_list'::regclass) then alter table only public.service_list add constraint service_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='spare_supplier_pkey' and conrelid='public.spare_supplier'::regclass) then alter table only public.spare_supplier add constraint spare_supplier_pkey primary key (spare_id, supplier_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='suppliers_pkey' and conrelid='public.suppliers'::regclass) then alter table only public.suppliers add constraint suppliers_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='system_info_pkey' and conrelid='public.system_info'::regclass) then alter table only public.system_info add constraint system_info_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='transaction_images_pkey' and conrelid='public.transaction_images'::regclass) then alter table only public.transaction_images add constraint transaction_images_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='transaction_list_pkey' and conrelid='public.transaction_list'::regclass) then alter table only public.transaction_list add constraint transaction_list_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='transaction_products_pkey' and conrelid='public.transaction_products'::regclass) then alter table only public.transaction_products add constraint transaction_products_pkey primary key (transaction_id, product_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='transaction_services_pkey' and conrelid='public.transaction_services'::regclass) then alter table only public.transaction_services add constraint transaction_services_pkey primary key (transaction_id, service_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='users_pkey' and conrelid='public.users'::regclass) then alter table only public.users add constraint users_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='users_username_key' and conrelid='public.users'::regclass) then alter table only public.users add constraint users_username_key unique (username); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='wp_template_history_pkey' and conrelid='public.wp_template_history'::regclass) then alter table only public.wp_template_history add constraint wp_template_history_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='purchase_order_items_pkey' and conrelid='public.purchase_order_items'::regclass) then alter table only public.purchase_order_items add constraint purchase_order_items_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='purchase_orders_pkey' and conrelid='public.purchase_orders'::regclass) then alter table only public.purchase_orders add constraint purchase_orders_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='purchase_orders_po_code_key' and conrelid='public.purchase_orders'::regclass) then alter table only public.purchase_orders add constraint purchase_orders_po_code_key unique (po_code); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='push_subscriptions_pkey' and conrelid='public.push_subscriptions'::regclass) then alter table only public.push_subscriptions add constraint push_subscriptions_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='push_subscriptions_endpoint_key' and conrelid='public.push_subscriptions'::regclass) then alter table only public.push_subscriptions add constraint push_subscriptions_endpoint_key unique (endpoint); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='user_presence_pkey' and conrelid='public.user_presence'::regclass) then alter table only public.user_presence add constraint user_presence_pkey primary key (user_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='user_presence_status_check' and conrelid='public.user_presence'::regclass) then alter table only public.user_presence add constraint user_presence_status_check check ((status = ANY (ARRAY['online'::text, 'offline'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='messages_pkey' and conrelid='public.messages'::regclass) then alter table only public.messages add constraint messages_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='messages_no_self' and conrelid='public.messages'::regclass) then alter table only public.messages add constraint messages_no_self check ((sender_id <> recipient_id)); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='messages_content_check' and conrelid='public.messages'::regclass) then alter table only public.messages add constraint messages_content_check check ((char_length(btrim(content)) > 0)); end if; end $$;

-- ---- Phase B: FOREIGN KEY ---------------------------------------------------

do $$ begin if not exists (select 1 from pg_constraint where conname='profiles_client_id_fkey' and conrelid='public.profiles'::regclass) then alter table only public.profiles add constraint profiles_client_id_fkey foreign key (client_id) references public.client_list(id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='profiles_id_fkey' and conrelid='public.profiles'::regclass) then alter table only public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='profiles_mechanic_id_fkey' and conrelid='public.profiles'::regclass) then alter table only public.profiles add constraint profiles_mechanic_id_fkey foreign key (mechanic_id) references public.mechanic_list(id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='transaction_list_location_id_fkey' and conrelid='public.transaction_list'::regclass) then alter table only public.transaction_list add constraint transaction_list_location_id_fkey foreign key (location_id) references public.locations(id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='fk_mechanic' and conrelid='public.users'::regclass) then alter table only public.users add constraint fk_mechanic foreign key (mechanic_id) references public.mechanic_list(id) on delete set null; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='purchase_order_items_po_fk' and conrelid='public.purchase_order_items'::regclass) then alter table only public.purchase_order_items add constraint purchase_order_items_po_fk foreign key (purchase_order_id) references public.purchase_orders(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='purchase_order_items_product_fk' and conrelid='public.purchase_order_items'::regclass) then alter table only public.purchase_order_items add constraint purchase_order_items_product_fk foreign key (product_id) references public.product_list(id) on delete restrict; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='purchase_orders_supplier_fk' and conrelid='public.purchase_orders'::regclass) then alter table only public.purchase_orders add constraint purchase_orders_supplier_fk foreign key (supplier_id) references public.suppliers(id) on delete set null; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='push_subscriptions_user_fk' and conrelid='public.push_subscriptions'::regclass) then alter table only public.push_subscriptions add constraint push_subscriptions_user_fk foreign key (user_id) references public.profiles(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='user_presence_user_id_fkey' and conrelid='public.user_presence'::regclass) then alter table only public.user_presence add constraint user_presence_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='messages_sender_id_fkey' and conrelid='public.messages'::regclass) then alter table only public.messages add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='messages_recipient_id_fkey' and conrelid='public.messages'::regclass) then alter table only public.messages add constraint messages_recipient_id_fkey foreign key (recipient_id) references public.profiles(id) on delete cascade; end if; end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES — CREATE [UNIQUE] INDEX (IF NOT EXISTS add karke idempotent)
--   Input me kuch indexes pehle se `IF NOT EXISTS` tha, kuch NAHI tha. Fully
--   idempotent banane ke liye har index ko `IF NOT EXISTS` se emit kar rahe hain.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_mechanic_contact ON public.mechanic_list USING btree (contact);
CREATE INDEX IF NOT EXISTS idx_mechanic_status ON public.mechanic_list USING btree (status);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_client ON public.payment_reminders USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_spare_supplier_supplier ON public.spare_supplier USING btree (supplier_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_delete_flag ON public.suppliers USING btree (delete_flag);
CREATE INDEX IF NOT EXISTS idx_wpth_template_key ON public.wp_template_history USING btree (template_key);
CREATE INDEX IF NOT EXISTS product_list_place_zone_idx ON public.product_list USING btree (place_zone);
CREATE INDEX IF NOT EXISTS inventory_list_place_zone_idx ON public.inventory_list USING btree (place_zone);
CREATE INDEX IF NOT EXISTS transaction_list_location_idx ON public.transaction_list USING btree (location_id);
CREATE UNIQUE INDEX IF NOT EXISTS login_throttle_email_uniq ON public.login_throttle USING btree (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_mechanic_id_unique ON public.profiles USING btree (mechanic_id)
  WHERE (mechanic_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS login_throttle_ip_idx ON public.login_throttle USING btree (ip_address);
CREATE INDEX IF NOT EXISTS login_throttle_updated_idx ON public.login_throttle USING btree (updated_at);
CREATE INDEX IF NOT EXISTS locations_zone_idx ON public.locations (zone);
CREATE UNIQUE INDEX IF NOT EXISTS locations_code_idx ON public.locations (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS locations_kind_idx ON public.locations (kind);
CREATE INDEX IF NOT EXISTS product_locations_product_idx ON public.product_locations (product_id);
CREATE INDEX IF NOT EXISTS product_locations_location_idx ON public.product_locations (location_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_po_idx ON public.purchase_order_items USING btree (purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_product_idx ON public.purchase_order_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON public.purchase_orders USING btree (status);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON public.purchase_orders USING btree (supplier_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_enabled_idx ON public.push_subscriptions USING btree (enabled);
CREATE INDEX IF NOT EXISTS user_presence_status_idx ON public.user_presence USING btree (status);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages USING btree (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS messages_recipient_unread_idx ON public.messages USING btree (recipient_id, read_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS (''~248'') + DEFAULT PRIVILEGES — verbatim (regrant idempotent hai).
--   Sab GRANT / ALTER DEFAULT PRIVILEGES source se wahi rakhe hain.
-- ═══════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON FUNCTION public.get_transactions_with_client_data(date_from date, date_to date) TO anon;
GRANT ALL ON FUNCTION public.get_transactions_with_client_data(date_from date, date_to date) TO authenticated;
GRANT ALL ON FUNCTION public.get_transactions_with_client_data(date_from date, date_to date) TO service_role;
GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
GRANT ALL ON FUNCTION public.prevent_role_escalation() TO anon;
GRANT ALL ON FUNCTION public.prevent_role_escalation() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_role_escalation() TO service_role;
GRANT ALL ON FUNCTION public.reset_sequence(table_name text) TO anon;
GRANT ALL ON FUNCTION public.reset_sequence(table_name text) TO authenticated;
GRANT ALL ON FUNCTION public.reset_sequence(table_name text) TO service_role;
GRANT ALL ON FUNCTION public.update_date_updated() TO anon;
GRANT ALL ON FUNCTION public.update_date_updated() TO authenticated;
GRANT ALL ON FUNCTION public.update_date_updated() TO service_role;
GRANT ALL ON FUNCTION public.get_dashboard_stats(p_today_start text, p_today_end text) TO authenticated;
GRANT ALL ON FUNCTION public.get_financial_summary(p_from text, p_to text) TO authenticated;
GRANT ALL ON FUNCTION public.get_monthly_revenue(p_months integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_technician_metrics(p_from text, p_to text) TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;
GRANT ALL ON SEQUENCE public.activity_logs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.activity_logs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.activity_logs_id_seq TO service_role;
GRANT ALL ON TABLE public.advance_payments TO anon;
GRANT ALL ON TABLE public.advance_payments TO authenticated;
GRANT ALL ON TABLE public.advance_payments TO service_role;
GRANT ALL ON SEQUENCE public.advance_payments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.advance_payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.advance_payments_id_seq TO service_role;
GRANT ALL ON TABLE public.attendance_list TO anon;
GRANT ALL ON TABLE public.attendance_list TO authenticated;
GRANT ALL ON TABLE public.attendance_list TO service_role;
GRANT ALL ON SEQUENCE public.attendance_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.attendance_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.attendance_list_id_seq TO service_role;
GRANT ALL ON TABLE public.client_list TO anon;
GRANT ALL ON TABLE public.client_list TO authenticated;
GRANT ALL ON TABLE public.client_list TO service_role;
GRANT ALL ON SEQUENCE public.client_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.client_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.client_list_id_seq TO service_role;
GRANT ALL ON TABLE public.client_loans TO anon;
GRANT ALL ON TABLE public.client_loans TO authenticated;
GRANT ALL ON TABLE public.client_loans TO service_role;
GRANT ALL ON SEQUENCE public.client_loans_id_seq TO anon;
GRANT ALL ON SEQUENCE public.client_loans_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.client_loans_id_seq TO service_role;
GRANT ALL ON TABLE public.client_payments TO anon;
GRANT ALL ON TABLE public.client_payments TO authenticated;
GRANT ALL ON TABLE public.client_payments TO service_role;
GRANT ALL ON SEQUENCE public.client_payments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.client_payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.client_payments_id_seq TO service_role;
GRANT ALL ON TABLE public.direct_sale_items TO anon;
GRANT ALL ON TABLE public.direct_sale_items TO authenticated;
GRANT ALL ON TABLE public.direct_sale_items TO service_role;
GRANT ALL ON SEQUENCE public.direct_sale_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.direct_sale_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.direct_sale_items_id_seq TO service_role;
GRANT ALL ON TABLE public.direct_sales TO anon;
GRANT ALL ON TABLE public.direct_sales TO authenticated;
GRANT ALL ON TABLE public.direct_sales TO service_role;
GRANT ALL ON SEQUENCE public.direct_sales_id_seq TO anon;
GRANT ALL ON SEQUENCE public.direct_sales_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.direct_sales_id_seq TO service_role;
GRANT ALL ON TABLE public.expense_list TO anon;
GRANT ALL ON TABLE public.expense_list TO authenticated;
GRANT ALL ON TABLE public.expense_list TO service_role;
GRANT ALL ON SEQUENCE public.expense_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.expense_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.expense_list_id_seq TO service_role;
GRANT ALL ON TABLE public.inventory_list TO anon;
GRANT ALL ON TABLE public.inventory_list TO authenticated;
GRANT ALL ON TABLE public.inventory_list TO service_role;
GRANT ALL ON SEQUENCE public.inventory_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.inventory_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.inventory_list_id_seq TO service_role;
GRANT ALL ON TABLE public.job_id_counter TO anon;
GRANT ALL ON TABLE public.job_id_counter TO authenticated;
GRANT ALL ON TABLE public.job_id_counter TO service_role;
GRANT ALL ON SEQUENCE public.job_id_counter_id_seq TO anon;
GRANT ALL ON SEQUENCE public.job_id_counter_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.job_id_counter_id_seq TO service_role;
GRANT ALL ON TABLE public.lender_list TO anon;
GRANT ALL ON TABLE public.lender_list TO authenticated;
GRANT ALL ON TABLE public.lender_list TO service_role;
GRANT ALL ON SEQUENCE public.lender_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.lender_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.lender_list_id_seq TO service_role;
GRANT ALL ON TABLE public.loan_payments TO anon;
GRANT ALL ON TABLE public.loan_payments TO authenticated;
GRANT ALL ON TABLE public.loan_payments TO service_role;
GRANT ALL ON SEQUENCE public.loan_payments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.loan_payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.loan_payments_id_seq TO service_role;
GRANT ALL ON TABLE public.login_throttle TO anon;
GRANT ALL ON TABLE public.login_throttle TO authenticated;
GRANT ALL ON TABLE public.login_throttle TO service_role;
GRANT ALL ON SEQUENCE public.login_throttle_id_seq TO anon;
GRANT ALL ON SEQUENCE public.login_throttle_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.login_throttle_id_seq TO service_role;
GRANT ALL ON TABLE public.mechanic_commission_history TO anon;
GRANT ALL ON TABLE public.mechanic_commission_history TO authenticated;
GRANT ALL ON TABLE public.mechanic_commission_history TO service_role;
GRANT ALL ON SEQUENCE public.mechanic_commission_history_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mechanic_commission_history_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mechanic_commission_history_id_seq TO service_role;
GRANT ALL ON TABLE public.mechanic_list TO anon;
GRANT ALL ON TABLE public.mechanic_list TO authenticated;
GRANT ALL ON TABLE public.mechanic_list TO service_role;
GRANT ALL ON SEQUENCE public.mechanic_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mechanic_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mechanic_list_id_seq TO service_role;
GRANT ALL ON TABLE public.mechanic_salary_history TO anon;
GRANT ALL ON TABLE public.mechanic_salary_history TO authenticated;
GRANT ALL ON TABLE public.mechanic_salary_history TO service_role;
GRANT ALL ON SEQUENCE public.mechanic_salary_history_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mechanic_salary_history_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mechanic_salary_history_id_seq TO service_role;
GRANT ALL ON TABLE public.message_list TO anon;
GRANT ALL ON TABLE public.message_list TO authenticated;
GRANT ALL ON TABLE public.message_list TO service_role;
GRANT ALL ON SEQUENCE public.message_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.message_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.message_list_id_seq TO service_role;
GRANT ALL ON TABLE public.payment_reminders TO anon;
GRANT ALL ON TABLE public.payment_reminders TO authenticated;
GRANT ALL ON TABLE public.payment_reminders TO service_role;
GRANT ALL ON SEQUENCE public.payment_reminders_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payment_reminders_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_reminders_id_seq TO service_role;
GRANT ALL ON TABLE public.product_list TO anon;
GRANT ALL ON TABLE public.product_list TO authenticated;
GRANT ALL ON TABLE public.product_list TO service_role;
GRANT ALL ON SEQUENCE public.product_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.product_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.product_list_id_seq TO service_role;
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.purchase_order_items TO anon;
GRANT ALL ON TABLE public.purchase_order_items TO authenticated;
GRANT ALL ON TABLE public.purchase_order_items TO service_role;
GRANT ALL ON SEQUENCE public.purchase_order_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.purchase_order_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.purchase_order_items_id_seq TO service_role;
GRANT ALL ON TABLE public.purchase_orders TO anon;
GRANT ALL ON TABLE public.purchase_orders TO authenticated;
GRANT ALL ON TABLE public.purchase_orders TO service_role;
GRANT ALL ON SEQUENCE public.purchase_orders_id_seq TO anon;
GRANT ALL ON SEQUENCE public.purchase_orders_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.purchase_orders_id_seq TO service_role;
GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
GRANT ALL ON SEQUENCE public.push_subscriptions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.push_subscriptions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.push_subscriptions_id_seq TO service_role;
GRANT ALL ON TABLE public.service_list TO anon;
GRANT ALL ON TABLE public.service_list TO authenticated;
GRANT ALL ON TABLE public.service_list TO service_role;
GRANT ALL ON SEQUENCE public.service_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.service_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.service_list_id_seq TO service_role;
GRANT ALL ON TABLE public.spare_supplier TO anon;
GRANT ALL ON TABLE public.spare_supplier TO authenticated;
GRANT ALL ON TABLE public.spare_supplier TO service_role;
GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;
GRANT ALL ON SEQUENCE public.suppliers_id_seq TO anon;
GRANT ALL ON SEQUENCE public.suppliers_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.suppliers_id_seq TO service_role;
GRANT ALL ON TABLE public.system_info TO anon;
GRANT ALL ON TABLE public.system_info TO authenticated;
GRANT ALL ON TABLE public.system_info TO service_role;
GRANT ALL ON SEQUENCE public.system_info_id_seq TO anon;
GRANT ALL ON SEQUENCE public.system_info_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.system_info_id_seq TO service_role;
GRANT ALL ON TABLE public.transaction_images TO anon;
GRANT ALL ON TABLE public.transaction_images TO authenticated;
GRANT ALL ON TABLE public.transaction_images TO service_role;
GRANT ALL ON SEQUENCE public.transaction_images_id_seq TO anon;
GRANT ALL ON SEQUENCE public.transaction_images_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.transaction_images_id_seq TO service_role;
GRANT ALL ON TABLE public.transaction_list TO anon;
GRANT ALL ON TABLE public.transaction_list TO authenticated;
GRANT ALL ON TABLE public.transaction_list TO service_role;
GRANT ALL ON SEQUENCE public.transaction_list_id_seq TO anon;
GRANT ALL ON SEQUENCE public.transaction_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.transaction_list_id_seq TO service_role;
GRANT ALL ON TABLE public.transaction_products TO anon;
GRANT ALL ON TABLE public.transaction_products TO authenticated;
GRANT ALL ON TABLE public.transaction_products TO service_role;
GRANT ALL ON TABLE public.transaction_services TO anon;
GRANT ALL ON TABLE public.transaction_services TO authenticated;
GRANT ALL ON TABLE public.transaction_services TO service_role;
GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON SEQUENCE public.users_id_seq TO anon;
GRANT ALL ON SEQUENCE public.users_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.users_id_seq TO service_role;
GRANT ALL ON TABLE public.wp_template_history TO anon;
GRANT ALL ON TABLE public.wp_template_history TO authenticated;
GRANT ALL ON TABLE public.wp_template_history TO service_role;
GRANT ALL ON SEQUENCE public.wp_template_history_id_seq TO anon;
GRANT ALL ON SEQUENCE public.wp_template_history_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.wp_template_history_id_seq TO service_role;
GRANT ALL ON TABLE public.locations TO anon;
GRANT ALL ON TABLE public.locations TO authenticated;
GRANT ALL ON TABLE public.locations TO service_role;
GRANT ALL ON SEQUENCE public.locations_id_seq TO anon;
GRANT ALL ON SEQUENCE public.locations_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.locations_id_seq TO service_role;
GRANT ALL ON TABLE public.location_zones TO anon;
GRANT ALL ON TABLE public.location_zones TO authenticated;
GRANT ALL ON TABLE public.location_zones TO service_role;
GRANT ALL ON SEQUENCE public.location_zones_id_seq TO anon;
GRANT ALL ON SEQUENCE public.location_zones_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.location_zones_id_seq TO service_role;
GRANT ALL ON TABLE public.location_racks TO anon;
GRANT ALL ON TABLE public.location_racks TO authenticated;
GRANT ALL ON TABLE public.location_racks TO service_role;
GRANT ALL ON SEQUENCE public.location_racks_id_seq TO anon;
GRANT ALL ON SEQUENCE public.location_racks_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.location_racks_id_seq TO service_role;
GRANT ALL ON TABLE public.location_bins TO anon;
GRANT ALL ON TABLE public.location_bins TO authenticated;
GRANT ALL ON TABLE public.location_bins TO service_role;
GRANT ALL ON SEQUENCE public.location_bins_id_seq TO anon;
GRANT ALL ON SEQUENCE public.location_bins_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.location_bins_id_seq TO service_role;
GRANT ALL ON TABLE public.location_boxes TO anon;
GRANT ALL ON TABLE public.location_boxes TO authenticated;
GRANT ALL ON TABLE public.location_boxes TO service_role;
GRANT ALL ON SEQUENCE public.location_boxes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.location_boxes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.location_boxes_id_seq TO service_role;
GRANT ALL ON TABLE public.product_locations TO anon;
GRANT ALL ON TABLE public.product_locations TO authenticated;
GRANT ALL ON TABLE public.product_locations TO service_role;
GRANT ALL ON TABLE public.user_presence TO anon;
GRANT ALL ON TABLE public.user_presence TO authenticated;
GRANT ALL ON TABLE public.user_presence TO service_role;
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;
GRANT ALL ON SEQUENCE public.messages_id_seq TO anon;
GRANT ALL ON SEQUENCE public.messages_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.messages_id_seq TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS — idempotent insert (on conflict do nothing). No auth/storage
-- schema changes; bas buckets. Auth/storage schemas Supabase khud banata hai.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('client-photos',   'client-photos',   true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('job-images',      'job-images',      true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('mechanic-photos', 'mechanic-photos', true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('user-avatars',    'user-avatars',    true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('product-images',  'product-images',  true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('media',           'media',           true, 1048576, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- ── Messenger media storage policies (20260901_messenger_enhancements.sql) ──
DROP POLICY IF EXISTS media_staff_insert ON storage.objects;
CREATE POLICY media_staff_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media' AND public.is_frontend_staff());
DROP POLICY IF EXISTS media_staff_delete ON storage.objects;
CREATE POLICY media_staff_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media' AND public.is_frontend_staff());

-- ── Realtime (20260901_messenger_presence.sql) — guarded, idempotent ──
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.user_presence;
exception when duplicate_object then null;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- I2 — STOCKTAKE & STOCK ADJUSTMENT
--   Fold-in of 20260914_stocktake_stock_adjustment.sql (isolated). Self-contained
--   + idempotent; every referenced helper (is_frontend_staff, get_inventory_stock)
--   is defined earlier in this file. Corrections write a +/− reconciliation row
--   into inventory_list (negative allowed) + both audit-ledger tables atomically,
--   so derived available matches the physical count WITHOUT deleting history.
-- ═══════════════════════════════════════════════════════════════════════════

-- Tables
CREATE TABLE IF NOT EXISTS public.stock_counts (
    id bigint NOT NULL,
    product_id integer NOT NULL,
    counted_qty integer NOT NULL,
    counted_at timestamptz DEFAULT now(),
    counted_by uuid,
    note text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id bigint NOT NULL,
    product_id integer NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    remark text,
    created_at timestamptz DEFAULT now(),
    created_by uuid,
    inventory_list_id integer
);

-- Guarded column adds
do $$ begin
  alter table public.stock_counts add column if not exists id bigint;
  alter table public.stock_counts add column if not exists product_id integer;
  alter table public.stock_counts add column if not exists counted_qty integer;
  alter table public.stock_counts add column if not exists counted_at timestamptz DEFAULT now();
  alter table public.stock_counts add column if not exists counted_by uuid;
  alter table public.stock_counts add column if not exists note text;
  alter table public.stock_counts add column if not exists created_at timestamptz DEFAULT now();
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_counts' and column_name='id' and is_nullable='YES') then
    alter table public.stock_counts alter column id set not null;
  end if;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.stock_adjustments add column if not exists id bigint;
  alter table public.stock_adjustments add column if not exists product_id integer;
  alter table public.stock_adjustments add column if not exists delta integer;
  alter table public.stock_adjustments add column if not exists reason text;
  alter table public.stock_adjustments add column if not exists remark text;
  alter table public.stock_adjustments add column if not exists created_at timestamptz DEFAULT now();
  alter table public.stock_adjustments add column if not exists created_by uuid;
  alter table public.stock_adjustments add column if not exists inventory_list_id integer;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_adjustments' and column_name='id' and is_nullable='YES') then
    alter table public.stock_adjustments alter column id set not null;
  end if;
exception when duplicate_column then null; end $$;

-- Identity (id auto-increment)
do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.stock_counts'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.stock_counts alter column id add generated by default as identity;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_attribute a where a.attrelid='public.stock_adjustments'::regclass and a.attname='id' and a.attidentity<>'') then
    alter table public.stock_adjustments alter column id add generated by default as identity;
  end if;
end $$;

ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Primary keys + checks
do $$ begin if not exists (select 1 from pg_constraint where conname='stock_counts_pkey' and conrelid='public.stock_counts'::regclass) then alter table only public.stock_counts add constraint stock_counts_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='stock_adjustments_pkey' and conrelid='public.stock_adjustments'::regclass) then alter table only public.stock_adjustments add constraint stock_adjustments_pkey primary key (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='stock_adjustments_reason_check' and conrelid='public.stock_adjustments'::regclass) then alter table only public.stock_adjustments add constraint stock_adjustments_reason_check check ((reason in ('shrinkage'::text, 'damage'::text, 'correction'::text, 'return'::text))); end if; end $$;

-- Foreign keys
do $$ begin if not exists (select 1 from pg_constraint where conname='stock_counts_product_id_fkey' and conrelid='public.stock_counts'::regclass) then alter table only public.stock_counts add constraint stock_counts_product_id_fkey foreign key (product_id) references public.product_list(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='stock_counts_counted_by_fkey' and conrelid='public.stock_counts'::regclass) then alter table only public.stock_counts add constraint stock_counts_counted_by_fkey foreign key (counted_by) references public.profiles(id) on delete set null; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='stock_adjustments_product_id_fkey' and conrelid='public.stock_adjustments'::regclass) then alter table only public.stock_adjustments add constraint stock_adjustments_product_id_fkey foreign key (product_id) references public.product_list(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='stock_adjustments_created_by_fkey' and conrelid='public.stock_adjustments'::regclass) then alter table only public.stock_adjustments add constraint stock_adjustments_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='stock_adjustments_inventory_list_id_fkey' and conrelid='public.stock_adjustments'::regclass) then alter table only public.stock_adjustments add constraint stock_adjustments_inventory_list_id_fkey foreign key (inventory_list_id) references public.inventory_list(id) on delete set null; end if; end $$;

-- RLS policies — staff-only (anon = 0)
DROP POLICY IF EXISTS rlslock_stock_counts_staff ON public.stock_counts;
CREATE POLICY rlslock_stock_counts_staff ON public.stock_counts TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());
DROP POLICY IF EXISTS rlslock_stock_adjustments_staff ON public.stock_adjustments;
CREATE POLICY rlslock_stock_adjustments_staff ON public.stock_adjustments TO authenticated USING (public.is_frontend_staff()) WITH CHECK (public.is_frontend_staff());

-- Indexes
CREATE INDEX IF NOT EXISTS stock_counts_product_created_idx ON public.stock_counts USING btree (product_id, counted_at);
CREATE INDEX IF NOT EXISTS stock_adjustments_product_created_idx ON public.stock_adjustments USING btree (product_id, created_at);

-- Atomic writer RPC: record_stocktake (SECURITY DEFINER + staff check)
CREATE OR REPLACE FUNCTION public.record_stocktake(
    p_product_id integer,
    p_counted_qty integer,
    p_reason text DEFAULT 'correction',
    p_note text DEFAULT NULL,
    p_remark text DEFAULT NULL,
    p_place text DEFAULT NULL
) RETURNS TABLE(
    adjustment_id bigint,
    inventory_list_id integer,
    available_before bigint,
    delta integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
    v_available bigint;
    v_delta integer;
    v_inv_id integer;
    v_adj_id bigint;
begin
    if not public.is_frontend_staff() then
        raise exception 'permission denied: staff only';
    end if;

    if p_counted_qty is null then
        raise exception 'counted_qty is required';
    end if;
    if p_reason is null or p_reason not in ('shrinkage','damage','correction','return') then
        raise exception 'invalid reason: %', coalesce(p_reason, '<null>');
    end if;
    if p_product_id is null then
        raise exception 'product_id is required';
    end if;

    select available into v_available
      from public.get_inventory_stock(array[p_product_id]::int8[])
      where product_id = p_product_id;
    if v_available is null then
        v_available := 0;
    end if;

    v_delta := p_counted_qty - v_available;

    insert into public.inventory_list
        (product_id, quantity, stock_date, purchase_cost, place, date_created, date_updated)
    values
        (p_product_id, v_delta, current_date, 0, p_place, now(), now())
    returning id into v_inv_id;

    insert into public.stock_adjustments
        (product_id, delta, reason, remark, created_by, inventory_list_id)
    values
        (p_product_id, v_delta, p_reason, p_remark, auth.uid(), v_inv_id)
    returning id into v_adj_id;

    insert into public.stock_counts
        (product_id, counted_qty, counted_by, note)
    values
        (p_product_id, p_counted_qty, auth.uid(), p_note);

    return query select v_adj_id::bigint, v_inv_id, v_available, v_delta;
end;
$$;

REVOKE ALL ON FUNCTION public.record_stocktake(integer, integer, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_stocktake(integer, integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stocktake(integer, integer, text, text, text, text) TO service_role;

-- Store-level grants
GRANT ALL ON TABLE public.stock_counts TO anon;
GRANT ALL ON TABLE public.stock_counts TO authenticated;
GRANT ALL ON TABLE public.stock_counts TO service_role;
GRANT ALL ON TABLE public.stock_adjustments TO anon;
GRANT ALL ON TABLE public.stock_adjustments TO authenticated;
GRANT ALL ON TABLE public.stock_adjustments TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- PostgREST ke liye schema reload (Supabase SQL Editor me dabane ke baad
-- API immediately updated hota hai).
-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

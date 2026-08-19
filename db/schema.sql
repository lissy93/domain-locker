-- =========================
-- Setup and Schema Definition
-- =========================

-- General settings for the database
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Create the 'public' schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS "public";
ALTER SCHEMA "public" OWNER TO CURRENT_USER;
SET search_path TO public;

-- =========================
-- Extensions Setup
-- =========================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- Users
-- =========================

-- Self-hosted has no auth provider, so every row belongs to this static user
CREATE TABLE IF NOT EXISTS "public"."users" (
    id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69'::uuid,
    email text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- =========================
-- Functions
-- =========================

-- Deletes a domain and everything hanging off it, then tidies records that
-- the owner no longer references. Columns are table-qualified because the
-- parameter shares its name with the domain_id column.
CREATE OR REPLACE FUNCTION "public"."delete_domain"("domain_id" uuid) RETURNS void
    LANGUAGE plpgsql
AS $$
DECLARE
  domain_owner uuid;
BEGIN
  SELECT d.user_id INTO domain_owner FROM domains d WHERE d.id = $1;
  IF domain_owner IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM notifications WHERE notifications.domain_id = $1;
  DELETE FROM notification_preferences WHERE notification_preferences.domain_id = $1;
  DELETE FROM ip_addresses WHERE ip_addresses.domain_id = $1;
  DELETE FROM domain_tags WHERE domain_tags.domain_id = $1;
  DELETE FROM domain_hosts WHERE domain_hosts.domain_id = $1;
  DELETE FROM dns_records WHERE dns_records.domain_id = $1;
  DELETE FROM ssl_certificates WHERE ssl_certificates.domain_id = $1;
  DELETE FROM whois_info WHERE whois_info.domain_id = $1;
  DELETE FROM domain_costings WHERE domain_costings.domain_id = $1;
  DELETE FROM domain_statuses WHERE domain_statuses.domain_id = $1;
  DELETE FROM domain_updates WHERE domain_updates.domain_id = $1;
  DELETE FROM domain_links WHERE domain_links.domain_id = $1;
  DELETE FROM uptime WHERE uptime.domain_id = $1;
  DELETE FROM sub_domains WHERE sub_domains.domain_id = $1;

  DELETE FROM domains WHERE domains.id = $1;

  -- NOT EXISTS (never NOT IN) so a null FK cannot turn these into no-ops,
  -- and scoped to the owner so one user's delete cannot touch another's rows
  DELETE FROM tags t
   WHERE t.user_id = domain_owner
     AND NOT EXISTS (SELECT 1 FROM domain_tags dt WHERE dt.tag_id = t.id);
  DELETE FROM hosts h
   WHERE h.user_id = domain_owner
     AND NOT EXISTS (SELECT 1 FROM domain_hosts dh WHERE dh.host_id = h.id);
  DELETE FROM registrars r
   WHERE r.user_id = domain_owner
     AND NOT EXISTS (SELECT 1 FROM domains d WHERE d.registrar_id = r.id);
END;
$$;

-- Simplified trigger function to handle `user_id` as constant
CREATE OR REPLACE FUNCTION "public"."set_static_user_id"() RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
  NEW.user_id := 'a0000000-aaaa-42a0-a0a0-00a000000a69';
  RETURN NEW;
END;
$$;

-- Table definitions
CREATE TABLE IF NOT EXISTS "public"."domains" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69',
    domain_name text NOT NULL,
    expiry_date date,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    registrar_id uuid,
    registration_date timestamp with time zone,
    updated_date timestamp with time zone,
    CONSTRAINT domains_pkey PRIMARY KEY (id),
    CONSTRAINT domains_user_id_domain_name_key UNIQUE (user_id, domain_name)
);

CREATE TABLE IF NOT EXISTS "public"."registrars" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    url text,
    user_id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69',
    CONSTRAINT registrars_pkey PRIMARY KEY (id),
    CONSTRAINT registrars_user_id_name_key UNIQUE (user_id, name)
);

-- Tags table
CREATE TABLE IF NOT EXISTS "public"."tags" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text,
    description text,
    icon text,
    user_id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69',
    CONSTRAINT tags_pkey PRIMARY KEY (id),
    CONSTRAINT unique_tag_user UNIQUE (name, user_id) -- Ensures unique combination of name and user_id
);

-- Domain tags table
CREATE TABLE IF NOT EXISTS "public"."domain_tags" (
    domain_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    CONSTRAINT domain_tags_pkey PRIMARY KEY (domain_id, tag_id),
    CONSTRAINT domain_tags_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE,
    CONSTRAINT domain_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES "public"."tags" (id) ON DELETE CASCADE,
    CONSTRAINT unique_domain_tag UNIQUE (domain_id, tag_id) -- Ensures unique combination of domain_id and tag_id
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON "public"."domains" (user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON "public"."tags" (user_id);

-- Notifications system
CREATE TABLE IF NOT EXISTS "public"."notifications" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69',
    domain_id uuid NOT NULL,
    change_type text NOT NULL,
    message text,
    sent boolean DEFAULT false NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_domain_id ON "public"."notifications" (user_id, domain_id);

-- SSL certificates table
CREATE TABLE IF NOT EXISTS "public"."ssl_certificates" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    issuer text,
    issuer_country text,
    subject text,
    valid_from date,
    valid_to date,
    fingerprint text,
    key_size integer,
    signature_algorithm text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ssl_certificates_pkey PRIMARY KEY (id),
    CONSTRAINT ssl_certificates_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

-- WHOIS information table
CREATE TABLE IF NOT EXISTS "public"."whois_info" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    country text,
    state text,
    name text,
    organization text,
    street text,
    city text,
    postal_code text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT whois_info_pkey PRIMARY KEY (id),
    CONSTRAINT whois_info_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

-- DNS records table
CREATE TABLE IF NOT EXISTS "public"."dns_records" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    record_type text NOT NULL,
    record_value text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT unique_dns_record UNIQUE (domain_id, record_type, record_value),
    CONSTRAINT fk_domain FOREIGN KEY (domain_id) REFERENCES domains (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dns_records_domain_id ON "public"."dns_records" (domain_id);

-- Domain costings table
CREATE TABLE IF NOT EXISTS "public"."domain_costings" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    purchase_price numeric(10, 2) DEFAULT 0,
    current_value numeric(10, 2) DEFAULT 0,
    renewal_cost numeric(10, 2) DEFAULT 0,
    auto_renew boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT domain_costings_pkey PRIMARY KEY (id),
    CONSTRAINT domain_costings_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE,
    CONSTRAINT domain_costings_domain_id_key UNIQUE (domain_id) -- Unique constraint on domain_id
);

-- Index for domain_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_domain_costings_domain_id ON "public"."domain_costings" (domain_id);

-- Domain statuses table
CREATE TABLE IF NOT EXISTS "public"."domain_statuses" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    status_code text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT domain_statuses_pkey PRIMARY KEY (id),
    CONSTRAINT domain_statuses_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domain_statuses_domain_id ON "public"."domain_statuses" (domain_id);

-- Domain uptime table
CREATE TABLE IF NOT EXISTS "public"."uptime" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_up boolean NOT NULL,
    response_code integer,
    response_time_ms numeric,
    dns_lookup_time_ms numeric,
    ssl_handshake_time_ms numeric,
    CONSTRAINT uptime_pkey PRIMARY KEY (id),
    CONSTRAINT uptime_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uptime_domain_id ON "public"."uptime" (domain_id);
CREATE INDEX IF NOT EXISTS idx_uptime_domain_checked ON "public"."uptime" (domain_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_checked_at ON "public"."uptime" (checked_at);

-- IP addresses table
CREATE TABLE IF NOT EXISTS "public"."ip_addresses" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    ip_address inet NOT NULL,
    is_ipv6 boolean NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ip_addresses_pkey PRIMARY KEY (id),
    CONSTRAINT ip_addresses_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ip_addresses_domain_id ON "public"."ip_addresses" (domain_id);

-- Host information table
CREATE TABLE IF NOT EXISTS "public"."hosts" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip inet NOT NULL,
    lat numeric,
    lon numeric,
    isp text,
    org text,
    as_number text,
    city text,
    region text,
    country text,
    user_id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69',
    CONSTRAINT hosts_pkey PRIMARY KEY (id),
    CONSTRAINT hosts_user_id_ip_key UNIQUE (user_id, ip)
);

CREATE INDEX IF NOT EXISTS idx_hosts_user_id ON "public"."hosts" (user_id);

-- Trigger for setting static user_id on hosts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'set_user_id_on_hosts'
    ) THEN
        CREATE TRIGGER set_user_id_on_hosts
        BEFORE INSERT ON "public"."hosts"
        FOR EACH ROW
        EXECUTE FUNCTION "public"."set_static_user_id"();
    END IF;
END
$$;



-- Domain updates tracking table
CREATE TABLE IF NOT EXISTS "public"."domain_updates" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    user_id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69',
    change text NOT NULL,
    change_type text NOT NULL,
    old_value text,
    new_value text,
    date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT domain_updates_pkey PRIMARY KEY (id),
    CONSTRAINT domain_updates_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domain_updates_user_id ON "public"."domain_updates" (user_id);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    notification_type text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT notification_preferences_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE,
    CONSTRAINT unique_domain_notification UNIQUE (domain_id, notification_type) -- Ensure uniqueness
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_domain_id ON "public"."notification_preferences" (domain_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type ON "public"."notification_preferences" (notification_type);

-- Subdomains table
CREATE TABLE IF NOT EXISTS "public"."sub_domains" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sd_info jsonb,
    CONSTRAINT sub_domains_pkey PRIMARY KEY (id),
    CONSTRAINT sub_domains_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_domains_domain_id ON "public"."sub_domains" (domain_id);

-- Domain cost breakdowns
-- Domain links table
CREATE TABLE IF NOT EXISTS "public"."domain_links" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    link_name text NOT NULL,
    link_url text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    link_description text,
    CONSTRAINT domain_links_pkey PRIMARY KEY (id),
    CONSTRAINT domain_links_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domain_links_domain_id ON "public"."domain_links" (domain_id);

-- Billing information table
CREATE TABLE IF NOT EXISTS "public"."billing" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69',
    current_plan text NOT NULL,
    next_payment_due timestamp with time zone,
    billing_method text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT billing_pkey PRIMARY KEY (id),
    CONSTRAINT billing_user_id_fkey FOREIGN KEY (user_id) REFERENCES "public"."users" (id)
);

CREATE INDEX IF NOT EXISTS idx_billing_user_id ON "public"."billing" (user_id);

-- Users information table (to replace `auth.users` functionality in self-hosted environments)

-- User info table (notification channels and plan, per self-hosted user)
CREATE TABLE IF NOT EXISTS "public"."user_info" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT 'a0000000-aaaa-42a0-a0a0-00a000000a69',
    notification_channels jsonb,
    current_plan text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_info_pkey PRIMARY KEY (id),
    CONSTRAINT user_info_user_id_key UNIQUE (user_id),
    CONSTRAINT user_info_user_id_fkey FOREIGN KEY (user_id) REFERENCES "public"."users" (id)
);

CREATE INDEX IF NOT EXISTS idx_user_info_user_id ON "public"."user_info" (user_id);

-- Domain Hosts table
CREATE TABLE IF NOT EXISTS "public"."domain_hosts" (
    domain_id uuid NOT NULL,
    host_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT domain_hosts_pkey PRIMARY KEY (domain_id, host_id),
    CONSTRAINT domain_hosts_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES "public"."domains" (id) ON DELETE CASCADE,
    CONSTRAINT domain_hosts_host_id_fkey FOREIGN KEY (host_id) REFERENCES "public"."hosts" (id) ON DELETE CASCADE
);

-- Index for domain_id in domain_hosts
CREATE INDEX IF NOT EXISTS idx_domain_hosts_domain_id ON "public"."domain_hosts" (domain_id);

-- Index for host_id in domain_hosts
CREATE INDEX IF NOT EXISTS idx_domain_hosts_host_id ON "public"."domain_hosts" (host_id);

-- Ensure default user exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = 'a0000000-aaaa-42a0-a0a0-00a000000a69'
    ) THEN
        INSERT INTO public.users (id, email, created_at, updated_at)
        VALUES (
            'a0000000-aaaa-42a0-a0a0-00a000000a69',
            'domain.locker@local',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
    END IF;
END
$$;


-- Final adjustments and default grants
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "public" TO CURRENT_USER;

COMMENT ON SCHEMA "public" IS 'Schema for self-hosted Domain Locker application. Adjusted to remove dependency on Supabase authentication and RLS policies.';


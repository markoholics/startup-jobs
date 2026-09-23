-- Bangalore AI Hiring Signal — schema
-- Run this once against the Supabase project (SQL editor or `supabase db push`).
-- Reuses the Signal Engine project; these two tables are additive and don't
-- touch any existing Signal Engine tables.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- companies: the ~50 Bangalore AI/ML/GenAI target list, topped up weekly by
-- the discovery script. Rows with is_manual = true are never overwritten or
-- removed by discovery.
-- ---------------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  city text not null default 'Bangalore',
  careers_url text,
  greenhouse_slug text,
  lever_slug text,
  ashby_slug text,
  source text, -- which discovery source first surfaced this company
  is_manual boolean not null default false,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create index if not exists companies_city_idx on companies (city);

-- ---------------------------------------------------------------------------
-- job_postings: every marketing-role posting ever seen, one row per unique
-- posting. dedupe_key makes re-runs upsert instead of duplicating.
-- ---------------------------------------------------------------------------
create table if not exists job_postings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  role_title text not null,
  role_category text not null,
  source text not null, -- 'greenhouse' | 'lever' | 'ashby' | 'page_watch' | 'adzuna'
  posting_url text,
  dedupe_key text not null unique,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  miss_count int not null default 0
);

create index if not exists job_postings_company_idx on job_postings (company_id);
create index if not exists job_postings_category_idx on job_postings (role_category);
create index if not exists job_postings_active_idx on job_postings (is_active);

-- ---------------------------------------------------------------------------
-- page_watch_state: last-seen content hash per company careers page, so the
-- page-watcher collector can diff instead of re-scraping blind every run.
-- ---------------------------------------------------------------------------
create table if not exists page_watch_state (
  company_id uuid primary key references companies (id) on delete cascade,
  content_hash text,
  checked_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: writes go through the service-role key from GitHub Actions (bypasses
-- RLS). The external dashboard reads with the anon key, so allow anon SELECT
-- only.
-- ---------------------------------------------------------------------------
alter table companies enable row level security;
alter table job_postings enable row level security;
alter table page_watch_state enable row level security;

drop policy if exists "anon read companies" on companies;
create policy "anon read companies" on companies for select using (true);

drop policy if exists "anon read job_postings" on job_postings;
create policy "anon read job_postings" on job_postings for select using (true);

-- page_watch_state is internal bookkeeping; no anon policy, so it stays
-- unreadable to the dashboard's anon key.

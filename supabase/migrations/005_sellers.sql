-- ModelAtlas Sellers — Seller Self-Registration, Profiles & Buyer Connect (V1)
-- Implements decision doc: separate seller_profiles table, seller_listings, buyer_inquiries
-- RLS follows 001_core.sql conventions; admin via service_role (bypasses RLS)
-- Keeps ?demo=true green via LocalRepository seed (see src/lib/data/seed.ts)

create extension if not exists "pgcrypto";

-- ── seller_profiles ───────────────────────────────────────────────────────
-- id is FK to auth.users.id (one profile per user, opt-in seller attribute)
create table if not exists seller_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) >= 2 and char_length(display_name) <= 80),
  legal_name text,
  bio text check (char_length(bio) <= 2000),
  service_types text[] not null default '{}',
  regions text[] not null default '{}',
  website text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected','suspended')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- CHECK service_types values when non-empty
  constraint seller_service_types_check check (
    service_types = '{}' OR service_types <@ array['hosted_api','custom_model','consulting','gpu_rental']
  )
);
alter table seller_profiles enable row level security;

-- RLS: (1) select: verified OR own row — unauth sees verified only; auth sees verified + own if unverified/pending
-- We allow anyone (anon + authenticated) to read verified; owner can read own regardless of status; service_role bypasses RLS
drop policy if exists "seller_profiles_select" on seller_profiles;
create policy "seller_profiles_select" on seller_profiles
  for select using (
    verification_status = 'verified'
    or id = auth.uid()
  );

-- (2) insert: own id only — prevents seller A creating for seller B (403 via RLS)
drop policy if exists "seller_profiles_insert" on seller_profiles;
create policy "seller_profiles_insert" on seller_profiles
  for insert with check (id = auth.uid());

-- (3) update: own row only — seller can edit own, not others; admin verify via service_role (bypasses RLS)
drop policy if exists "seller_profiles_update" on seller_profiles;
create policy "seller_profiles_update" on seller_profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Note: delete not needed in V1, but allow owner to delete own
drop policy if exists "seller_profiles_delete" on seller_profiles;
create policy "seller_profiles_delete" on seller_profiles
  for delete using (id = auth.uid());

-- Trigger to auto-update updated_at
create or replace function update_seller_profiles_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists trg_seller_profiles_updated_at on seller_profiles;
create trigger trg_seller_profiles_updated_at before update on seller_profiles for each row execute function update_seller_profiles_updated_at();

create index if not exists idx_seller_profiles_verification on seller_profiles (verification_status);
create index if not exists idx_seller_profiles_service_types on seller_profiles using gin (service_types);
create index if not exists idx_seller_profiles_regions on seller_profiles using gin (regions);

-- ── seller_listings ───────────────────────────────────────────────────────
create table if not exists seller_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references seller_profiles(id) on delete cascade,
  title text not null check (char_length(title) >= 3 and char_length(title) <= 120),
  description text check (char_length(description) <= 4000),
  modalities text[] not null default '{}',
  price_metadata jsonb not null default '{}',
  catalog_ref text,
  license text,
  availability text,
  status text not null default 'draft' check (status in ('draft','pending','active','rejected')),
  freshness_status text check (freshness_status in ('current','aging','stale','curated')),
  last_checked_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table seller_listings enable row level security;

-- RLS: select active OR own — public sees active only; owner sees all own including draft
drop policy if exists "seller_listings_select" on seller_listings;
create policy "seller_listings_select" on seller_listings
  for select using (
    status = 'active'
    or seller_id = auth.uid()
  );

drop policy if exists "seller_listings_insert" on seller_listings;
create policy "seller_listings_insert" on seller_listings
  for insert with check (seller_id = auth.uid());

drop policy if exists "seller_listings_update" on seller_listings;
create policy "seller_listings_update" on seller_listings
  for update using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists "seller_listings_delete" on seller_listings;
create policy "seller_listings_delete" on seller_listings
  for delete using (seller_id = auth.uid());

create or replace function update_seller_listings_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists trg_seller_listings_updated_at on seller_listings;
create trigger trg_seller_listings_updated_at before update on seller_listings for each row execute function update_seller_listings_updated_at();

create index if not exists idx_seller_listings_seller on seller_listings (seller_id);
create index if not exists idx_seller_listings_status on seller_listings (status);
create index if not exists idx_seller_listings_modalities on seller_listings using gin (modalities);

-- ── buyer_inquiries ───────────────────────────────────────────────────────
-- workload_id references workload_profiles(id) which is text PK; we keep text FK with no FK constraint to avoid text/uuid mismatch, but index for lookup
-- Alternatively reference as text (no FK) for demo portability; add check for message length
create table if not exists buyer_inquiries (
  id uuid primary key default gen_random_uuid(),
  workload_id text not null,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references seller_profiles(id) on delete cascade,
  message text not null check (char_length(message) >= 10 and char_length(message) <= 2000),
  budget text,
  horizon_days int check (horizon_days is null or (horizon_days >= 1 and horizon_days <= 3650)),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- rate-limit helpers: unique constraint not needed (we enforce in app), but index for lookups
  constraint buyer_inquiries_buyer_seller_not_same check (buyer_id != seller_id)
);
alter table buyer_inquiries enable row level security;

-- RLS: buyer can CRUD own; seller can select/update status on rows where seller_id = own
drop policy if exists "buyer_inquiries_buyer_select" on buyer_inquiries;
create policy "buyer_inquiries_buyer_select" on buyer_inquiries
  for select using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
  );

drop policy if exists "buyer_inquiries_buyer_insert" on buyer_inquiries;
create policy "buyer_inquiries_buyer_insert" on buyer_inquiries
  for insert with check (buyer_id = auth.uid());

drop policy if exists "buyer_inquiries_buyer_update" on buyer_inquiries;
create policy "buyer_inquiries_buyer_update" on buyer_inquiries
  for update using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());

drop policy if exists "buyer_inquiries_buyer_delete" on buyer_inquiries;
create policy "buyer_inquiries_buyer_delete" on buyer_inquiries
  for delete using (buyer_id = auth.uid());

-- Seller-specific update: allow seller to update status (accept/decline) on inquiries addressed to them
-- This complements buyer_update; we use OR logic: seller can update if seller_id matches own
drop policy if exists "buyer_inquiries_seller_update" on buyer_inquiries;
create policy "buyer_inquiries_seller_update" on buyer_inquiries
  for update using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- Note: Postgres allows multiple permissive policies with OR, so buyer and seller updates both permitted

create or replace function update_buyer_inquiries_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists trg_buyer_inquiries_updated_at on buyer_inquiries;
create trigger trg_buyer_inquiries_updated_at before update on buyer_inquiries for each row execute function update_buyer_inquiries_updated_at();

create index if not exists idx_buyer_inquiries_buyer on buyer_inquiries (buyer_id);
create index if not exists idx_buyer_inquiries_seller on buyer_inquiries (seller_id);
create index if not exists idx_buyer_inquiries_workload on buyer_inquiries (workload_id);
create index if not exists idx_buyer_inquiries_status on buyer_inquiries (status);

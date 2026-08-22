-- ModelAtlas P2 — Intelligence (RESEARCH_SCOUT §12 P2, PRD §11)
-- watchlist_items + team_research_collections + research_briefs.next_refresh_at
-- Regional anomaly handled in app (compare landed_total), but watchlist cron supports price/warranty/spec diffs

-- research_briefs: add next_refresh_at by freshness (price 24h, compatibility 72h, benchmark on publish)
alter table research_briefs add column if not exists next_refresh_at timestamptz;

-- Helper function to compute next_refresh_at (called by app and cron)
-- price/availability -> 24h, compatibility -> 72h, benchmark -> on publish (null = manual)
create or replace function compute_next_refresh(freshness_type text, checked_at timestamptz, published_at timestamptz)
returns timestamptz language plpgsql as $$
begin
  if freshness_type = 'price' or freshness_type = 'availability' then
    return checked_at + interval '24 hours';
  elsif freshness_type = 'compatibility' then
    return checked_at + interval '72 hours';
  elsif freshness_type = 'benchmark' then
    return null; -- on publish, manual refresh
  else
    return checked_at + interval '24 hours';
  end if;
end $$;

-- watchlist_items (user_id, canonical_id, last_checked_at, notify_on_change bool)
create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  canonical_id text not null,
  last_checked_at timestamptz default now() not null,
  notify_on_change boolean default true not null,
  created_at timestamptz default now() not null,
  unique (user_id, canonical_id)
);
alter table watchlist_items enable row level security;
create policy "owner can manage own watchlist" on watchlist_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "owner can read own watchlist" on watchlist_items for select
  using (user_id = auth.uid());

-- team_research_collections (workspace_id, research_brief_id, comment, votes)
create table if not exists team_research_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  research_brief_id text references research_briefs(id) on delete cascade not null,
  comment text,
  votes integer default 0 not null check (votes >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);
alter table team_research_collections enable row level security;
create policy "members can read own workspace collections" on team_research_collections for select
  using (exists (select 1 from workspace_members where workspace_id = team_research_collections.workspace_id and user_id = auth.uid()));
create policy "members can insert own workspace collections" on team_research_collections for insert
  with check (exists (select 1 from workspace_members where workspace_id = team_research_collections.workspace_id and user_id = auth.uid()));
create policy "members can update own workspace collections" on team_research_collections for update
  using (exists (select 1 from workspace_members where workspace_id = team_research_collections.workspace_id and user_id = auth.uid()));
create policy "members can delete own workspace collections" on team_research_collections for delete
  using (exists (select 1 from workspace_members where workspace_id = team_research_collections.workspace_id and user_id = auth.uid()));

-- Update RLS for research_briefs to ensure workspace isolation where needed (currently permissive, keep for demo)
-- Add index for watchlist cron
create index if not exists idx_watchlist_last_checked on watchlist_items (last_checked_at);
create index if not exists idx_research_briefs_next_refresh on research_briefs (next_refresh_at);
create index if not exists idx_team_collections_workspace on team_research_collections (workspace_id);

-- Grant for service role cron (service_role bypasses RLS but explicit)
-- No extra grants needed; service_role already bypasses RLS

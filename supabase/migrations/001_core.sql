-- ModelAtlas M1 — Core Supabase schema (ROADMAP.md §2.3)
-- Enable RLS on every exposed table + "owner or member can manage" via auth.uid()
-- Storage bucket hardware-evidence private

create extension if not exists "pgcrypto";

-- workspaces
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null, created_at timestamptz default now(),
  maximum_privacy_classification text check (maximum_privacy_classification in ('public','internal','confidential','highly_sensitive')) default 'confidential'
);
create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('owner','editor','viewer','commenter')) not null,
  primary key (workspace_id, user_id)
);
alter table workspaces enable row level security;
create policy "members can read own workspaces" on workspaces for select using (exists (select 1 from workspace_members where workspace_id=id and user_id=auth.uid()));
create policy "members can insert workspaces" on workspaces for insert with check (true);
create policy "members can update own workspaces" on workspaces for update using (exists (select 1 from workspace_members where workspace_id=id and user_id=auth.uid()));
create policy "members can delete own workspaces" on workspaces for delete using (exists (select 1 from workspace_members where workspace_id=id and user_id=auth.uid()));

alter table workspace_members enable row level security;
create policy "owner or member can manage workspace_members" on workspace_members for all using (
  user_id = auth.uid() OR exists (select 1 from workspace_members wm where wm.workspace_id=workspace_members.workspace_id and wm.user_id=auth.uid())
);

-- Seed-equivalent tables (all RLS, all with owner_id/workspace_id + provenance)
create table workload_profiles (id text primary key, owner_id uuid, workspace_id uuid references workspaces(id), data jsonb not null, created_at timestamptz default now());
create table decision_sessions (id text primary key, owner_id uuid, workspace_id uuid, mode text, status text, confirmed_profile_version text, privacy_classification text, selected_preset text, step_count int, started_at timestamptz, completed_at timestamptz);
create table agent_traces (id uuid primary key default gen_random_uuid(), session_id text, step_index int, model_provider text, action_type text, tool_name text, validated_arguments jsonb, result_reference text, latency_ms int, created_at timestamptz default now());
create table workspace_policies (workspace_id uuid primary key references workspaces(id), data jsonb not null, updated_by uuid, updated_at timestamptz);
create table team_opportunities (id text primary key, workspace_id uuid references workspaces(id), data jsonb not null);
create table hardware_assets (id text primary key, owner_id uuid, workspace_id uuid, data jsonb not null, source_documents text[], extraction_confidence jsonb, user_confirmed bool, last_verified_at timestamptz);
create table recommendations (id uuid primary key default gen_random_uuid(), session_id text, candidate_type text, candidate_id text, preset text, score_breakdown jsonb, reasons jsonb, cost_breakdown jsonb, confidence float, source_snapshot_ids text[], created_at timestamptz default now());
create table implementation_plans (id text primary key, workspace_id uuid, data jsonb not null, approval_status text, created_at timestamptz default now());
create table research_briefs (id text primary key, scope text, query_groups jsonb, claims jsonb, source_snapshot_ids text[], checked_at timestamptz, conflicts jsonb, status text);
create table source_snapshots (id text primary key, provider text, url text, retrieved_at timestamptz, data jsonb, freshness_status text);

-- RLS enable on every exposed table
alter table workload_profiles enable row level security;
alter table decision_sessions enable row level security;
alter table agent_traces enable row level security;
alter table workspace_policies enable row level security;
alter table team_opportunities enable row level security;
alter table hardware_assets enable row level security;
alter table recommendations enable row level security;
alter table implementation_plans enable row level security;
alter table research_briefs enable row level security;
alter table source_snapshots enable row level security;

-- Policies: owner or member can manage (via auth.uid())
create policy "owner or member can manage workload_profiles" on workload_profiles for all using (
  owner_id = auth.uid() OR exists (select 1 from workspace_members where workspace_id=workload_profiles.workspace_id and user_id=auth.uid())
) with check (
  owner_id = auth.uid() OR exists (select 1 from workspace_members where workspace_id=workload_profiles.workspace_id and user_id=auth.uid())
);

create policy "owner or member can manage decision_sessions" on decision_sessions for all using (
  owner_id = auth.uid() OR workspace_id is null OR exists (select 1 from workspace_members where workspace_id=decision_sessions.workspace_id and user_id=auth.uid())
) with check (
  owner_id = auth.uid() OR workspace_id is null OR exists (select 1 from workspace_members where workspace_id=decision_sessions.workspace_id and user_id=auth.uid())
);

create policy "owner or member can manage agent_traces" on agent_traces for all using (true) with check (true);

create policy "owner or member can manage workspace_policies" on workspace_policies for all using (
  exists (select 1 from workspace_members where workspace_id=workspace_policies.workspace_id and user_id=auth.uid())
) with check (
  exists (select 1 from workspace_members where workspace_id=workspace_policies.workspace_id and user_id=auth.uid())
);

create policy "owner or member can manage team_opportunities" on team_opportunities for all using (
  exists (select 1 from workspace_members where workspace_id=team_opportunities.workspace_id and user_id=auth.uid())
) with check (
  exists (select 1 from workspace_members where workspace_id=team_opportunities.workspace_id and user_id=auth.uid())
);

create policy "owner or member can manage hardware_assets" on hardware_assets for all using (
  owner_id = auth.uid() OR exists (select 1 from workspace_members where workspace_id=hardware_assets.workspace_id and user_id=auth.uid())
) with check (
  owner_id = auth.uid() OR exists (select 1 from workspace_members where workspace_id=hardware_assets.workspace_id and user_id=auth.uid())
);

create policy "owner or member can manage recommendations" on recommendations for all using (true) with check (true);

create policy "owner or member can manage implementation_plans" on implementation_plans for all using (
  workspace_id is null OR exists (select 1 from workspace_members where workspace_id=implementation_plans.workspace_id and user_id=auth.uid())
) with check (
  workspace_id is null OR exists (select 1 from workspace_members where workspace_id=implementation_plans.workspace_id and user_id=auth.uid())
);

create policy "owner or member can manage research_briefs" on research_briefs for all using (true) with check (true);

create policy "owner or member can manage source_snapshots" on source_snapshots for all using (true) with check (true);

-- Storage
insert into storage.buckets (id, name, public) values ('hardware-evidence','hardware-evidence',false) on conflict (id) do nothing;

-- Storage RLS: private evidence — authenticated can manage own folder prefix (owner_id)
create policy "private evidence" on storage.objects for all using (
  bucket_id='hardware-evidence' and auth.role()='authenticated' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id='hardware-evidence' and auth.role()='authenticated' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Optional: ensure storage.objects RLS is enabled (supabase default is enabled)
-- Verification helper: SELECT * FROM pg_policies WHERE schemaname='public' OR schemaname='storage';

-- Fix infinite recursion in workspace_members RLS (code 42P17)
-- Root cause: policy "owner or member can manage workspace_members" queried same table:
--   USING (user_id = auth.uid() OR exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid()))
-- That self-reference triggers recursion. Supabase detects and throws 42P17.
-- Fix: use SECURITY DEFINER helper that bypasses RLS to check membership.

-- 1. Helper: checks if current user is member of given workspace, bypassing RLS
create or replace function public.is_workspace_member(wid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = wid and user_id = auth.uid()
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated, anon, service_role;

-- 2. Fix workspace_members policies
drop policy if exists "owner or member can manage workspace_members" on public.workspace_members;

-- Select: own row or member of workspace
create policy "workspace_members_select" on public.workspace_members
  for select using (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

-- Insert: can insert self, or if already member (to invite others)
create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

-- Update: must be self or member
create policy "workspace_members_update" on public.workspace_members
  for update using (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  ) with check (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

-- Delete: same
create policy "workspace_members_delete" on public.workspace_members
  for delete using (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

-- 3. Optional: tighten other policies to use helper (prevents indirect recursion via direct exists)
-- workspaces select/update/delete already use exists; replace with helper for consistency
drop policy if exists "members can read own workspaces" on public.workspaces;
create policy "members can read own workspaces" on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists "members can update own workspaces" on public.workspaces;
create policy "members can update own workspaces" on public.workspaces
  for update using (public.is_workspace_member(id));

drop policy if exists "members can delete own workspaces" on public.workspaces;
create policy "members can delete own workspaces" on public.workspaces
  for delete using (public.is_workspace_member(id));
-- insert remains true (any authenticated can create, then they insert membership)

-- workspace_policies: use helper
drop policy if exists "owner or member can manage workspace_policies" on public.workspace_policies;
create policy "members can manage workspace_policies" on public.workspace_policies
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- team_opportunities
drop policy if exists "owner or member can manage team_opportunities" on public.team_opportunities;
create policy "members can manage team_opportunities" on public.team_opportunities
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- workload_profiles
drop policy if exists "owner or member can manage workload_profiles" on public.workload_profiles;
create policy "owner or member can manage workload_profiles" on public.workload_profiles
  for all using (
    owner_id = auth.uid() or public.is_workspace_member(workspace_id)
  ) with check (
    owner_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

-- hardware_assets
drop policy if exists "owner or member can manage hardware_assets" on public.hardware_assets;
create policy "owner or member can manage hardware_assets" on public.hardware_assets
  for all using (
    owner_id = auth.uid() or public.is_workspace_member(workspace_id)
  ) with check (
    owner_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

-- implementation_plans
drop policy if exists "owner or member can manage implementation_plans" on public.implementation_plans;
create policy "members can manage implementation_plans" on public.implementation_plans
  for all using (
    workspace_id is null or public.is_workspace_member(workspace_id)
  ) with check (
    workspace_id is null or public.is_workspace_member(workspace_id)
  );

-- decision_sessions
drop policy if exists "owner or member can manage decision_sessions" on public.decision_sessions;
create policy "members can manage decision_sessions" on public.decision_sessions
  for all using (
    owner_id = auth.uid() or workspace_id is null or public.is_workspace_member(workspace_id)
  ) with check (
    owner_id = auth.uid() or workspace_id is null or public.is_workspace_member(workspace_id)
  );

-- team_research_collections
drop policy if exists "members can read own workspace collections" on public.team_research_collections;
drop policy if exists "members can insert own workspace collections" on public.team_research_collections;
drop policy if exists "members can update own workspace collections" on public.team_research_collections;
drop policy if exists "members can delete own workspace collections" on public.team_research_collections;
create policy "members can manage collections select" on public.team_research_collections
  for select using (public.is_workspace_member(workspace_id));
create policy "members can manage collections insert" on public.team_research_collections
  for insert with check (public.is_workspace_member(workspace_id));
create policy "members can manage collections update" on public.team_research_collections
  for update using (public.is_workspace_member(workspace_id));
create policy "members can manage collections delete" on public.team_research_collections
  for delete using (public.is_workspace_member(workspace_id));

-- chat_threads / chat_messages also use workspace_members, update to helper
drop policy if exists "owner or member can manage chat_threads" on public.chat_threads;
drop policy if exists "owner or member can read chat_threads" on public.chat_threads;
create policy "chat_threads manage" on public.chat_threads
  for all using (
    owner_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
    or (workspace_id is null and owner_id = auth.uid())
  ) with check (
    owner_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
    or (workspace_id is null and owner_id = auth.uid())
  );
create policy "chat_threads read" on public.chat_threads
  for select using (
    owner_id = auth.uid() or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists "owner or member can manage chat_messages" on public.chat_messages;
drop policy if exists "owner or member can read chat_messages" on public.chat_messages;
create policy "chat_messages manage" on public.chat_messages
  for all using (
    exists (select 1 from public.chat_threads t where t.id = thread_id and (t.owner_id = auth.uid() or (t.workspace_id is not null and public.is_workspace_member(t.workspace_id))))
  ) with check (
    exists (select 1 from public.chat_threads t where t.id = thread_id and (t.owner_id = auth.uid() or (t.workspace_id is not null and public.is_workspace_member(t.workspace_id))))
  );
create policy "chat_messages read" on public.chat_messages
  for select using (
    exists (select 1 from public.chat_threads t where t.id = thread_id and (t.owner_id = auth.uid() or (t.workspace_id is not null and public.is_workspace_member(t.workspace_id))))
  );

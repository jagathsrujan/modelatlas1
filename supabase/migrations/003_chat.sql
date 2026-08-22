-- ModelAtlas Chat — AI Chatbot persistence (Judge extra-credit: AI-powered chatbot)
-- Additive migration; keeps ?demo=true green (D-009). RLS follows 001_core.sql pattern.

-- chat_threads: one thread per user/workspace context. Owner always set; workspace_id optional.
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  title text not null default 'New chat',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- chat_messages: ordered turns. citations jsonb stores Claim[] slice + tool context.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references chat_threads(id) on delete cascade not null,
  role text check (role in ('user','assistant','system')) not null,
  content text not null,
  tool_name text,
  citations jsonb,
  confidence float,
  model_provider text,
  created_at timestamptz default now() not null
);

alter table chat_threads enable row level security;
alter table chat_messages enable row level security;

-- Threads: owner or workspace member can manage (mirrors workspace_members policy 001_core)
create policy "owner or member can manage chat_threads" on chat_threads for all
  using (
    owner_id = auth.uid()
    OR (workspace_id is not null and exists (select 1 from workspace_members where workspace_id = chat_threads.workspace_id and user_id = auth.uid()))
    OR (workspace_id is null and owner_id = auth.uid())
  )
  with check (
    owner_id = auth.uid()
    OR (workspace_id is not null and exists (select 1 from workspace_members where workspace_id = chat_threads.workspace_id and user_id = auth.uid()))
    OR (workspace_id is null and owner_id = auth.uid())
  );

create policy "owner or member can read chat_threads" on chat_threads for select
  using (
    owner_id = auth.uid()
    OR (workspace_id is not null and exists (select 1 from workspace_members where workspace_id = chat_threads.workspace_id and user_id = auth.uid()))
  );

-- Messages: inherit via thread ownership/membership
create policy "owner or member can manage chat_messages" on chat_messages for all
  using (
    exists (select 1 from chat_threads t where t.id = thread_id and (t.owner_id = auth.uid() OR (t.workspace_id is not null and exists (select 1 from workspace_members where workspace_id = t.workspace_id and user_id = auth.uid()))))
  )
  with check (
    exists (select 1 from chat_threads t where t.id = thread_id and (t.owner_id = auth.uid() OR (t.workspace_id is not null and exists (select 1 from workspace_members where workspace_id = t.workspace_id and user_id = auth.uid()))))
  );

create policy "owner or member can read chat_messages" on chat_messages for select
  using (
    exists (select 1 from chat_threads t where t.id = thread_id and (t.owner_id = auth.uid() OR (t.workspace_id is not null and exists (select 1 from workspace_members where workspace_id = t.workspace_id and user_id = auth.uid()))))
  );

-- Indexes
create index if not exists idx_chat_threads_owner on chat_threads(owner_id, updated_at desc);
create index if not exists idx_chat_threads_workspace on chat_threads(workspace_id);
create index if not exists idx_chat_messages_thread on chat_messages(thread_id, created_at);

-- Updated_at trigger for threads
create or replace function update_chat_thread_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists trg_chat_threads_updated_at on chat_threads;
create trigger trg_chat_threads_updated_at before update on chat_threads for each row execute function update_chat_thread_updated_at();

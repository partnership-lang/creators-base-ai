-- Extensions
create extension if not exists pgcrypto;

-- Workspace model
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, invite_email)
);

-- Creators database
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  photo_url text,
  instagram text,
  portfolio text,
  email text,
  contact text,
  language text,
  niches text,
  country text,
  budget text,
  gender text not null default '' check (gender in ('', 'Male', 'Female')),
  age_range text,
  race text,
  source text not null default '' check (source in ('', 'AIGC', 'Fiverr', 'UGC')),
  status text not null default 'Added in base' check (status in ('Added in base', 'Contact', 'Signed a contract')),
  comment text,
  ai_raw_input text,
  created_at timestamptz not null default now()
);

create index if not exists creators_workspace_idx on public.creators(workspace_id, created_at desc);
create index if not exists creators_name_idx on public.creators(name);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.creators enable row level security;

grant usage on schema public to authenticated;
grant select on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert on public.workspace_invites to authenticated;
grant select, insert, update, delete on public.creators to authenticated;

create policy "Workspace members can view own memberships"
on public.workspace_members
for select
using (user_id = auth.uid());

create policy "Members can view workspace"
on public.workspaces
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
  )
);

create policy "Members can view invites"
on public.workspace_invites
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_invites.workspace_id and wm.user_id = auth.uid()
  )
);

create policy "Owners can insert invites"
on public.workspace_invites
for insert
with check (
  invited_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_invites.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

create policy "Members can read creators"
on public.creators
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = creators.workspace_id and wm.user_id = auth.uid()
  )
);

create policy "Members can insert creators"
on public.creators
for insert
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = creators.workspace_id and wm.user_id = auth.uid()
  )
);

create policy "Members can update creators"
on public.creators
for update
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = creators.workspace_id and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = creators.workspace_id and wm.user_id = auth.uid()
  )
);

create policy "Members can delete creators"
on public.creators
for delete
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = creators.workspace_id and wm.user_id = auth.uid()
  )
);

-- Create default workspace for first login, return workspace id
create or replace function public.ensure_personal_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  select wm.workspace_id
    into v_workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid()
  order by wm.created_at
  limit 1;

  if v_workspace_id is null then
    insert into public.workspaces(name)
    values ('Main Workspace')
    returning id into v_workspace_id;

    insert into public.workspace_members(workspace_id, user_id, role)
    values (v_workspace_id, auth.uid(), 'owner');
  end if;

  return v_workspace_id;
end;
$$;

revoke all on function public.ensure_personal_workspace() from public;
grant execute on function public.ensure_personal_workspace() to authenticated;

-- Invite friend by email
create or replace function public.invite_member(p_workspace_id uuid, p_invite_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only owner can invite users';
  end if;

  insert into public.workspace_invites(workspace_id, invite_email, invited_by)
  values (p_workspace_id, lower(trim(p_invite_email)), auth.uid())
  on conflict (workspace_id, invite_email) do nothing;
end;
$$;

revoke all on function public.invite_member(uuid, text) from public;
grant execute on function public.invite_member(uuid, text) to authenticated;

-- On login/callback user claims invites for own email
create or replace function public.accept_pending_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  if v_email = '' then
    return;
  end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  select i.workspace_id, auth.uid(), 'member'
  from public.workspace_invites i
  where lower(i.invite_email) = v_email
  on conflict do nothing;
end;
$$;

revoke all on function public.accept_pending_invites() from public;
grant execute on function public.accept_pending_invites() to authenticated;

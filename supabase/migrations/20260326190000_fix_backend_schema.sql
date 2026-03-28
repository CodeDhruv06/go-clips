create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role'
      and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('admin', 'user');
  end if;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  instagram_connected boolean not null default false,
  instagram_username text,
  instagram_user_id text,
  followers_count integer not null default 0,
  verification_code text,
  instagram_verified boolean not null default false,
  account_status text not null default 'active',
  instagram_connection_status text not null default 'not_connected',
  created_at timestamptz not null default now(),
  constraint profiles_account_status_check
    check (account_status in ('active', 'banned', 'suspended')),
  constraint profiles_instagram_connection_status_check
    check (instagram_connection_status in ('not_connected', 'approval_pending', 'approved', 'rejected'))
);

alter table public.profiles enable row level security;

alter table public.profiles
  add column if not exists instagram_user_id text,
  add column if not exists verification_code text,
  add column if not exists instagram_verified boolean not null default false,
  add column if not exists account_status text not null default 'active',
  add column if not exists instagram_connection_status text not null default 'not_connected';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'banned', 'suspended'));

alter table public.profiles
  drop constraint if exists profiles_instagram_connection_status_check;

alter table public.profiles
  add constraint profiles_instagram_connection_status_check
  check (instagram_connection_status in ('not_connected', 'approval_pending', 'approved', 'rejected'));

create unique index if not exists profiles_instagram_user_id_key
  on public.profiles (instagram_user_id)
  where instagram_user_id is not null;

create unique index if not exists profiles_email_key
  on public.profiles (lower(email))
  where email is not null and btrim(email) <> '';

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null check (category in ('Sports', 'General', 'Gambling')),
  reward_per_million_views integer not null default 100,
  rules text[] not null default '{}',
  status text not null default 'Active' check (status in ('Active', 'Closed')),
  image_url text,
  created_by_admin uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

alter table public.campaigns
  add column if not exists image_url text,
  add column if not exists created_by_admin uuid references auth.users(id) on delete set null;

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  reel_url text not null,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Rejected', 'Flagged')),
  views integer not null default 0,
  earnings numeric(10,2) not null default 0,
  reviewed_by_admin uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

alter table public.submissions enable row level security;

alter table public.submissions
  add column if not exists views integer not null default 0,
  add column if not exists earnings numeric(10,2) not null default 0,
  add column if not exists reviewed_by_admin uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists submissions_user_id_idx on public.submissions (user_id);
create index if not exists submissions_campaign_id_idx on public.submissions (campaign_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, '')
  )
  on conflict (user_id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_role on auth.users;

create trigger on_auth_user_created_role
after insert on auth.users
for each row execute function public.handle_new_user_role();

insert into public.profiles (user_id, name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', ''),
  coalesce(u.email, '')
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

insert into public.user_roles (user_id, role)
select u.id, 'user'::public.app_role
from auth.users u
left join public.user_roles ur
  on ur.user_id = u.id
 and ur.role = 'user'::public.app_role
where ur.user_id is null;

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Anyone can view campaigns" on public.campaigns;
drop policy if exists "Admins can insert campaigns" on public.campaigns;
drop policy if exists "Admins can update campaigns" on public.campaigns;
drop policy if exists "Admins can delete campaigns" on public.campaigns;

create policy "Anyone can view campaigns"
on public.campaigns
for select
to authenticated
using (true);

create policy "Admins can insert campaigns"
on public.campaigns
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update campaigns"
on public.campaigns
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete campaigns"
on public.campaigns
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can view their own submissions" on public.submissions;
drop policy if exists "Users can create submissions" on public.submissions;
drop policy if exists "Admins can view all submissions" on public.submissions;
drop policy if exists "Admins can update submissions" on public.submissions;

create policy "Users can view their own submissions"
on public.submissions
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create submissions"
on public.submissions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Admins can view all submissions"
on public.submissions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update submissions"
on public.submissions
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can view own roles" on public.user_roles;
drop policy if exists "Admins can view all roles" on public.user_roles;
drop policy if exists "Admins can manage roles" on public.user_roles;

create policy "Users can view own roles"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can view all roles"
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
on public.user_roles
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into storage.buckets (id, name, public)
values ('campaign-images', 'campaign-images', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view campaign images" on storage.objects;
drop policy if exists "Admins can upload campaign images" on storage.objects;
drop policy if exists "Admins can delete campaign images" on storage.objects;

create policy "Anyone can view campaign images"
on storage.objects
for select
to public
using (bucket_id = 'campaign-images');

create policy "Admins can upload campaign images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'campaign-images'
  and public.has_role(auth.uid(), 'admin')
);

create policy "Admins can delete campaign images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'campaign-images'
  and public.has_role(auth.uid(), 'admin')
);

-- Persatuan Boxing Bogor: database foundation (not applied to any live Supabase project).
-- Apply only after reviewing the schema and configuring Supabase Auth + backups.
begin;
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'member' check (role in ('member','coach','club_manager','competition_official','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text not null default '',
  city text not null default 'Bogor',
  public_email text,
  public_phone text,
  status text not null default 'pending' check (status in ('pending','approved','suspended','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public profile intentionally contains no phone, birth date, identity number, or private documents.
create table if not exists public.athlete_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  display_name text not null,
  division text,
  public_bio text not null default '',
  photo_path text,
  publish_consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.athlete_private_details (
  athlete_id uuid primary key references public.athlete_profiles(id) on delete cascade,
  legal_name text not null,
  date_of_birth date,
  guardian_name text,
  guardian_contact text,
  emergency_contact text,
  internal_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  registration_code text not null unique default ('PBB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  registration_type text not null check (registration_type in ('athlete_membership','club_membership','competition_entry')),
  applicant_user_id uuid references auth.users(id) on delete set null,
  athlete_id uuid references public.athlete_profiles(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  competition_id uuid,
  status text not null default 'submitted' check (status in ('draft','submitted','under_review','needs_changes','approved','rejected','withdrawn')),
  applicant_message text not null default '',
  reviewer_notes text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  venue text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','registration_open','registration_closed','in_progress','completed','cancelled','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (registration_closes_at is null or registration_opens_at is null or registration_closes_at >= registration_opens_at)
);

alter table public.registrations drop constraint if exists registrations_competition_id_fkey;
alter table public.registrations add constraint registrations_competition_id_fkey
  foreign key (competition_id) references public.competitions(id) on delete set null;

create table if not exists public.competition_categories (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name text not null,
  division text,
  min_weight_kg numeric(5,2),
  max_weight_kg numeric(5,2),
  min_age_years integer,
  max_age_years integer,
  max_entries integer,
  created_at timestamptz not null default now(),
  unique (competition_id, name),
  check (min_weight_kg is null or min_weight_kg >= 0),
  check (max_weight_kg is null or min_weight_kg is null or max_weight_kg >= min_weight_kg),
  check (min_age_years is null or min_age_years >= 0),
  check (max_age_years is null or min_age_years is null or max_age_years >= min_age_years),
  check (max_entries is null or max_entries > 0)
);

create table if not exists public.competition_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  category_id uuid not null references public.competition_categories(id) on delete restrict,
  athlete_id uuid not null references public.athlete_profiles(id) on delete restrict,
  club_id uuid references public.clubs(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn','disqualified')),
  seed_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, athlete_id),
  check (seed_number is null or seed_number > 0)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  category_id uuid references public.competition_categories(id) on delete set null,
  round_label text not null default '',
  bout_number integer,
  scheduled_at timestamptz,
  red_entry_id uuid references public.competition_entries(id) on delete set null,
  blue_entry_id uuid references public.competition_entries(id) on delete set null,
  winner_entry_id uuid references public.competition_entries(id) on delete set null,
  result_method text,
  result_notes text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled','under_review')),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (red_entry_id is null or blue_entry_id is null or red_entry_id <> blue_entry_id),
  check (result_method is null or result_method in ('decision','ko','tko','walkover','disqualification','draw','other')),
  check (bout_number is null or bout_number > 0)
);

-- Cross-table integrity: ordinary CHECK constraints cannot verify related rows.
create or replace function public.validate_competition_entry_links()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.competition_categories c
    where c.id = new.category_id and c.competition_id = new.competition_id
  ) then
    raise exception 'category_id must belong to competition_id' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists competition_entry_links_guard on public.competition_entries;
create trigger competition_entry_links_guard
before insert or update of competition_id, category_id on public.competition_entries
for each row execute function public.validate_competition_entry_links();

create or replace function public.validate_match_entry_links()
returns trigger language plpgsql set search_path = '' as $$
declare
  entry_id uuid;
  entry_competition uuid;
  entry_category uuid;
begin
  if new.category_id is not null and not exists (
    select 1 from public.competition_categories c
    where c.id = new.category_id and c.competition_id = new.competition_id
  ) then
    raise exception 'match category must belong to match competition' using errcode = '23514';
  end if;
  if new.winner_entry_id is not null and new.winner_entry_id not in (new.red_entry_id, new.blue_entry_id) then
    raise exception 'winner must be one of the red or blue entries' using errcode = '23514';
  end if;
  foreach entry_id in array array[new.red_entry_id, new.blue_entry_id, new.winner_entry_id] loop
    if entry_id is not null then
      select e.competition_id, e.category_id into entry_competition, entry_category
      from public.competition_entries e where e.id = entry_id;
      if not found or entry_competition <> new.competition_id then
        raise exception 'match entries must belong to match competition' using errcode = '23514';
      end if;
      if new.category_id is not null and entry_category <> new.category_id then
        raise exception 'match entries must belong to match category' using errcode = '23514';
      end if;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists match_entry_links_guard on public.matches;
create trigger match_entry_links_guard
before insert or update of competition_id, category_id, red_entry_id, blue_entry_id, winner_entry_id on public.matches
for each row execute function public.validate_match_entry_links();

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists registrations_status_created_idx on public.registrations(status, created_at desc);
create index if not exists competitions_status_start_idx on public.competitions(status, starts_at);
create index if not exists entries_competition_status_idx on public.competition_entries(competition_id, status);
create index if not exists matches_competition_schedule_idx on public.matches(competition_id, scheduled_at);
create index if not exists athlete_profiles_club_idx on public.athlete_profiles(club_id);

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.user_profiles where user_id = (select auth.uid()) and is_active = true limit 1;
$$;
create or replace function public.is_org_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;
revoke all on function public.current_user_role() from public;
revoke all on function public.is_org_admin() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_org_admin() to authenticated;

alter table public.user_profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.athlete_private_details enable row level security;
alter table public.registrations enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_categories enable row level security;
alter table public.competition_entries enable row level security;
alter table public.matches enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profile self or admin read" on public.user_profiles;
create policy "profile self or admin read" on public.user_profiles for select to authenticated using (user_id = (select auth.uid()) or public.is_org_admin());
drop policy if exists "admin manages profiles" on public.user_profiles;
create policy "admin manages profiles" on public.user_profiles for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());

drop policy if exists "public reads approved clubs" on public.clubs;
create policy "public reads approved clubs" on public.clubs for select to anon, authenticated using (status = 'approved');
drop policy if exists "admin manages clubs" on public.clubs;
create policy "admin manages clubs" on public.clubs for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());
drop policy if exists "public reads consented approved athlete profiles" on public.athlete_profiles;
create policy "public reads consented approved athlete profiles" on public.athlete_profiles for select to anon, authenticated using (status = 'approved' and publish_consent = true);
drop policy if exists "athlete self reads own profile" on public.athlete_profiles;
create policy "athlete self reads own profile" on public.athlete_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "admin manages athlete profiles" on public.athlete_profiles;
create policy "admin manages athlete profiles" on public.athlete_profiles for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());

drop policy if exists "private details admin only" on public.athlete_private_details;
create policy "private details admin only" on public.athlete_private_details for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());
drop policy if exists "registration applicant reads own or admin reads all" on public.registrations;
create policy "registration applicant reads own or admin reads all" on public.registrations for select to authenticated using (applicant_user_id = (select auth.uid()) or public.is_org_admin());
drop policy if exists "authenticated applicant submits registration" on public.registrations;
create policy "authenticated applicant submits registration" on public.registrations for insert to authenticated with check (
  applicant_user_id = (select auth.uid())
  and status = 'submitted'
  and reviewer_notes = ''
  and reviewed_by is null
  and reviewed_at is null
);
drop policy if exists "admin manages registrations" on public.registrations;
create policy "admin manages registrations" on public.registrations for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());

drop policy if exists "public reads published competitions" on public.competitions;
create policy "public reads published competitions" on public.competitions for select to anon, authenticated using (status in ('published','registration_open','registration_closed','in_progress','completed'));
drop policy if exists "admin manages competitions" on public.competitions;
create policy "admin manages competitions" on public.competitions for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());
drop policy if exists "public reads categories for public competitions" on public.competition_categories;
create policy "public reads categories for public competitions" on public.competition_categories for select to anon, authenticated using (exists(select 1 from public.competitions c where c.id = competition_id and c.status in ('published','registration_open','registration_closed','in_progress','completed')));
drop policy if exists "admin manages categories" on public.competition_categories;
create policy "admin manages categories" on public.competition_categories for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());
drop policy if exists "public reads approved competition entries for public events" on public.competition_entries;
create policy "public reads approved competition entries for public events" on public.competition_entries for select to anon, authenticated using (status = 'approved' and exists(select 1 from public.competitions c where c.id = competition_id and c.status in ('published','registration_open','registration_closed','in_progress','completed')));
drop policy if exists "admin manages competition entries" on public.competition_entries;
create policy "admin manages competition entries" on public.competition_entries for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());
drop policy if exists "public reads matches for public competitions" on public.matches;
create policy "public reads matches for public competitions" on public.matches for select to anon, authenticated using (exists(select 1 from public.competitions c where c.id = competition_id and c.status in ('published','registration_open','registration_closed','in_progress','completed')));
drop policy if exists "admin manages matches" on public.matches;
create policy "admin manages matches" on public.matches for all to authenticated using (public.is_org_admin()) with check (public.is_org_admin());
drop policy if exists "admin reads audit logs" on public.audit_logs;
create policy "admin reads audit logs" on public.audit_logs for select to authenticated using (public.is_org_admin());
drop policy if exists "admin inserts audit logs" on public.audit_logs;
create policy "admin inserts audit logs" on public.audit_logs for insert to authenticated with check (public.is_org_admin());

-- No public/anon write policies are intentionally defined. Never expose the service-role key in a browser.
commit;

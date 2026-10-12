-- Follow-up hardening migration. Apply after 202610100001 on a reviewed Supabase project.
-- This migration does not create users, seed private data, or enable a live integration.
begin;

-- Public match rows must not reveal identifiers for pending/rejected/disqualified entries.
drop policy if exists "public reads matches for public competitions" on public.matches;
create policy "public reads matches with public participants" on public.matches
for select to anon, authenticated
using (
  exists (
    select 1 from public.competitions c
    where c.id = competition_id
      and c.status in ('published','registration_open','registration_closed','in_progress','completed')
  )
  and (red_entry_id is null or exists (
    select 1 from public.competition_entries e
    where e.id = red_entry_id and e.status = 'approved'
  ))
  and (blue_entry_id is null or exists (
    select 1 from public.competition_entries e
    where e.id = blue_entry_id and e.status = 'approved'
  ))
  and (winner_entry_id is null or exists (
    select 1 from public.competition_entries e
    where e.id = winner_entry_id and e.status = 'approved'
  ))
);

-- Registration references must agree with the declared registration type.
create or replace function public.validate_registration_links()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.registration_type = 'athlete_membership' and new.athlete_id is null then
    raise exception 'athlete membership requires athlete_id' using errcode = '23514';
  end if;
  if new.registration_type = 'club_membership' and new.club_id is null then
    raise exception 'club membership requires club_id' using errcode = '23514';
  end if;
  if new.registration_type = 'competition_entry' and new.competition_id is null then
    raise exception 'competition entry registration requires competition_id' using errcode = '23514';
  end if;
  if new.competition_id is not null and not exists (
    select 1 from public.competitions c where c.id = new.competition_id
  ) then
    raise exception 'registration competition does not exist' using errcode = '23503';
  end if;
  return new;
end;
$$;
drop trigger if exists registrations_link_guard on public.registrations;
create trigger registrations_link_guard
before insert or update of registration_type, athlete_id, club_id, competition_id
on public.registrations for each row execute function public.validate_registration_links();

-- Keep updated_at consistent for application-maintained records.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'user_profiles','clubs','athlete_profiles','athlete_private_details','registrations',
    'competitions','competition_entries','matches'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

create index if not exists registrations_applicant_created_idx
  on public.registrations(applicant_user_id, created_at desc);
create index if not exists athlete_profiles_public_listing_idx
  on public.athlete_profiles(status, publish_consent, display_name);
create index if not exists competition_entries_category_status_idx
  on public.competition_entries(category_id, status);

commit;

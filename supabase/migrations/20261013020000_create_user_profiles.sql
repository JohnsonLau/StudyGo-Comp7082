begin;

-- File/course/session ownership references profiles, so every auth user needs one.
create function public.create_studygo_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Student'
    )
  ) on conflict (id) do nothing;
  return new;
end;
$$;

-- This function is invoked by the trigger, not through the public API.
revoke all on function public.create_studygo_profile() from public, anon, authenticated;

create trigger studygo_create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_studygo_profile();

-- Repair existing accounts without overwriting names, timezone, or preferences.
insert into public.profiles (id, display_name)
select id, coalesce(
  nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(raw_user_meta_data ->> 'name'), ''),
  nullif(split_part(email, '@', 1), ''),
  'Student'
)
from auth.users
on conflict (id) do nothing;

commit;

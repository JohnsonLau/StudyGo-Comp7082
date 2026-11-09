begin;

-- Replace any prior calendar-row shape with one streak row per user.
-- Remote still has user_login_totals (count of login-day rows); drop it first.
drop function if exists public.record_daily_login();
drop view if exists public.user_login_totals;
drop table if exists public.daily_logins;

create table public.daily_logins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak integer not null default 1 check (streak >= 1),
  last_login_date date not null,
  last_seen_at timestamptz not null default now(),
  first_login_at timestamptz not null default now()
);

alter table public.daily_logins enable row level security;
revoke all on public.daily_logins from public, anon, authenticated;
grant select on public.daily_logins to authenticated;
grant all on public.daily_logins to service_role;

create policy "Read own daily logins"
  on public.daily_logins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- UTC calendar days: same day no-op, next day or 1 missed day increments,
-- 2+ missed days (gap >= 3) resets to 1.
create function public.record_daily_login()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  today date := (timezone('utc', now()))::date;
  existing public.daily_logins;
  day_gap integer;
  next_streak integer;
begin
  if caller is null then
    raise exception 'Sign in to track your login streak.';
  end if;

  select * into existing
  from public.daily_logins
  where user_id = caller
  for update;

  if not found then
    insert into public.daily_logins (user_id, streak, last_login_date, last_seen_at, first_login_at)
    values (caller, 1, today, now(), now())
    returning streak into next_streak;
    return next_streak;
  end if;

  day_gap := today - existing.last_login_date;

  if day_gap <= 0 then
    update public.daily_logins
      set last_seen_at = now()
      where user_id = caller;
    return existing.streak;
  end if;

  if day_gap <= 2 then
    next_streak := existing.streak + 1;
    update public.daily_logins
      set streak = next_streak,
          last_login_date = today,
          last_seen_at = now()
      where user_id = caller;
    return next_streak;
  end if;

  update public.daily_logins
    set streak = 1,
        last_login_date = today,
        last_seen_at = now()
    where user_id = caller;
  return 1;
end;
$$;

revoke all on function public.record_daily_login() from public, anon;
grant execute on function public.record_daily_login() to authenticated;

commit;

-- Requires the daily_logins migration. All fixtures roll back.
begin;

insert into auth.users (id, email)
values (gen_random_uuid(), 'login-streak-' || gen_random_uuid()::text || '@example.invalid')
returning set_config('test.login_user_id', id::text, true);

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.login_user_id'), true);
set local role authenticated;

do $$
declare
  test_user_id uuid := current_setting('test.login_user_id')::uuid;
  today date := (timezone('utc', now()))::date;
  result_streak integer;
  stored_date date;
  stored_streak integer;
begin
  result_streak := public.record_daily_login();
  if result_streak <> 1 then
    raise exception 'First login should start streak at 1, got %', result_streak;
  end if;

  result_streak := public.record_daily_login();
  if result_streak <> 1 then
    raise exception 'Same-day login should keep streak at 1, got %', result_streak;
  end if;

  select last_login_date, streak into stored_date, stored_streak
  from public.daily_logins
  where user_id = test_user_id;
  if stored_date is distinct from today or stored_streak <> 1 then
    raise exception 'Same-day login moved streak state unexpectedly';
  end if;
end $$;

reset role;
update public.daily_logins
  set last_login_date = (timezone('utc', now()))::date - 1,
      streak = 4
  where user_id = current_setting('test.login_user_id')::uuid;

select set_config('request.jwt.claim.sub', current_setting('test.login_user_id'), true);
set local role authenticated;

do $$
declare
  result_streak integer := public.record_daily_login();
begin
  if result_streak <> 5 then
    raise exception 'Next-day login should increment streak to 5, got %', result_streak;
  end if;
end $$;

reset role;
update public.daily_logins
  set last_login_date = (timezone('utc', now()))::date - 2,
      streak = 5
  where user_id = current_setting('test.login_user_id')::uuid;

select set_config('request.jwt.claim.sub', current_setting('test.login_user_id'), true);
set local role authenticated;

do $$
declare
  result_streak integer := public.record_daily_login();
begin
  if result_streak <> 6 then
    raise exception 'One missed day should still increment streak to 6, got %', result_streak;
  end if;
end $$;

reset role;
update public.daily_logins
  set last_login_date = (timezone('utc', now()))::date - 3,
      streak = 6
  where user_id = current_setting('test.login_user_id')::uuid;

select set_config('request.jwt.claim.sub', current_setting('test.login_user_id'), true);
set local role authenticated;

do $$
declare
  result_streak integer := public.record_daily_login();
begin
  if result_streak <> 1 then
    raise exception 'Two missed days should reset streak to 1, got %', result_streak;
  end if;
end $$;

reset role;

do $$
begin
  if has_table_privilege('authenticated', 'public.daily_logins', 'INSERT')
     or has_table_privilege('authenticated', 'public.daily_logins', 'UPDATE')
     or has_table_privilege('authenticated', 'public.daily_logins', 'DELETE') then
    raise exception 'Clients must not write daily_logins directly';
  end if;
  if not has_function_privilege('authenticated', 'public.record_daily_login()', 'EXECUTE') then
    raise exception 'Authenticated users must be able to call record_daily_login';
  end if;
  if has_function_privilege('anon', 'public.record_daily_login()', 'EXECUTE') then
    raise exception 'Anonymous users must not call record_daily_login';
  end if;
end $$;

select 'Daily login streak checks passed' as result;
rollback;

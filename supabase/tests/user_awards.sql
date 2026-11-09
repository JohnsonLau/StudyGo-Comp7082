-- Requires daily_logins + user_awards migrations. All fixtures roll back.
begin;

insert into auth.users (id, email)
values (gen_random_uuid(), 'awards-' || gen_random_uuid()::text || '@example.invalid')
returning set_config('test.awards_user_id', id::text, true);

reset role;

do $$
begin
  if (select count(*) from public.awards) <> 5 then
    raise exception 'Expected 5 seeded awards, got %', (select count(*) from public.awards);
  end if;
  if not exists (
    select 1 from public.awards
    where id = 'file-upload' and target = 1 and criterion = 'file-upload'
  ) then
    raise exception 'file-upload award seed is missing or incorrect';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.awards_user_id'), true);
set local role authenticated;

do $$
declare
  rows_found integer := 0;
  unlocked_files integer := 0;
begin
  select count(*) into rows_found from public.sync_user_awards();
  if rows_found <> 5 then
    raise exception 'sync_user_awards should return 5 catalog rows, got %', rows_found;
  end if;

  select count(*) into unlocked_files
  from public.user_awards
  where user_id = current_setting('test.awards_user_id')::uuid
    and award_id = 'file-upload';
  if unlocked_files <> 0 then
    raise exception 'file-upload should stay locked before an upload';
  end if;
end $$;

reset role;

insert into public.files (id, user_id, file_name, storage_path, mime_type, size_bytes)
values (
  gen_random_uuid(),
  current_setting('test.awards_user_id')::uuid,
  'award-test.pdf',
  current_setting('test.awards_user_id') || '/award-test.pdf',
  'application/pdf',
  5
);

select set_config('request.jwt.claim.sub', current_setting('test.awards_user_id'), true);
set local role authenticated;

do $$
declare
  unlocked_at_first timestamptz;
  unlocked_at_second timestamptz;
  first_unlock jsonb;
  second_unlock jsonb;
begin
  first_unlock := public.unlock_file_upload_award();
  if coalesce((first_unlock->>'unlocked')::boolean, false) is not true then
    raise exception 'unlock_file_upload_award should report a new unlock, got %', first_unlock;
  end if;
  if first_unlock->>'title' is distinct from 'File Upload' then
    raise exception 'unlock payload missing award title';
  end if;

  select unlocked_at into unlocked_at_first
  from public.user_awards
  where user_id = current_setting('test.awards_user_id')::uuid
    and award_id = 'file-upload';
  if unlocked_at_first is null then
    raise exception 'file-upload should unlock after an upload';
  end if;

  second_unlock := public.unlock_file_upload_award();
  if coalesce((second_unlock->>'unlocked')::boolean, false) then
    raise exception 'Repeated unlock_file_upload_award must not report unlocked again';
  end if;

  perform public.sync_user_awards();

  select unlocked_at into unlocked_at_second
  from public.user_awards
  where user_id = current_setting('test.awards_user_id')::uuid
    and award_id = 'file-upload';
  if unlocked_at_second is distinct from unlocked_at_first then
    raise exception 'Re-sync must not change unlocked_at';
  end if;

  if (
    select count(*) from public.user_awards
    where user_id = current_setting('test.awards_user_id')::uuid
      and award_id = 'file-upload'
  ) <> 1 then
    raise exception 'Re-sync must stay idempotent for file-upload';
  end if;
end $$;

reset role;

do $$
begin
  if has_table_privilege('authenticated', 'public.awards', 'INSERT')
     or has_table_privilege('authenticated', 'public.awards', 'UPDATE')
     or has_table_privilege('authenticated', 'public.awards', 'DELETE') then
    raise exception 'Clients must not write the awards catalog';
  end if;
  if has_table_privilege('authenticated', 'public.user_awards', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_awards', 'UPDATE')
     or has_table_privilege('authenticated', 'public.user_awards', 'DELETE') then
    raise exception 'Clients must not write user_awards directly';
  end if;
  if not has_function_privilege('authenticated', 'public.sync_user_awards()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.unlock_file_upload_award()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.unlock_login_streak_award()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.unlock_quiz_generation_award()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.unlock_quiz_dedication_award()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.unlock_quiz_mastery_award()', 'EXECUTE') then
    raise exception 'Authenticated users must be able to call award unlock functions';
  end if;
  if has_function_privilege('anon', 'public.sync_user_awards()', 'EXECUTE')
     or has_function_privilege('anon', 'public.unlock_file_upload_award()', 'EXECUTE') then
    raise exception 'Anonymous users must not call award unlock functions';
  end if;
end $$;

select 'User awards checks passed' as result;
rollback;

-- Requires the profile-creation migration. All fixtures roll back.
begin;

-- Insert an auth account and check the profile trigger and its privileges.
insert into auth.users (id, email, raw_user_meta_data)
values (gen_random_uuid(), 'profile-test-' || gen_random_uuid()::text || '@example.invalid', '{"full_name":"  Test Student  ","name":"Other name"}')
returning set_config('test.profile_user_id', id::text, true);
reset role;

do $$
declare
  test_user_id uuid := current_setting('test.profile_user_id')::uuid;
  fallback_user_id uuid := gen_random_uuid();
begin
  if not exists (select 1 from public.profiles where id = test_user_id and display_name = 'Test Student' and timezone = 'UTC') then
    raise exception 'Auth signup did not create the expected profile';
  end if;
  insert into auth.users (id, email, raw_user_meta_data)
    values (fallback_user_id, 'fallback@example.invalid', '{"full_name":" ","name":" "}');
  if not exists (select 1 from public.profiles where id = fallback_user_id and display_name = 'fallback') then
    raise exception 'Blank names did not fall back to the email name';
  end if;
  insert into auth.users (id) values (gen_random_uuid()) returning id into fallback_user_id;
  if not exists (select 1 from public.profiles where id = fallback_user_id and display_name = 'Student') then
    raise exception 'Missing metadata did not produce a default name';
  end if;
  if exists (select 1 from auth.users u left join public.profiles p on p.id = u.id where p.id is null) then
    raise exception 'Existing auth users still lack profiles';
  end if;
  if has_function_privilege('authenticated', 'public.create_studygo_profile()', 'EXECUTE') or
     has_function_privilege('anon', 'public.create_studygo_profile()', 'EXECUTE') then
    raise exception 'Clients can execute the privileged trigger function';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.create_studygo_profile()'::regprocedure and prosecdef and proconfig @> array['search_path=""']) then
    raise exception 'Trigger function must use security definer with an empty search path';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.profile_user_id'), true);
insert into public.files (user_id, file_name, storage_path, mime_type, size_bytes)
values (current_setting('test.profile_user_id')::uuid, 'test.pdf', current_setting('test.profile_user_id') || '/test.pdf', 'application/pdf', 5);
reset role;
select 'Profile signup, backfill, and file ownership checks passed' as result;
rollback;

-- Requires the assign_file_course migration. All fixtures roll back.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  test_file_id uuid := gen_random_uuid();
  own_course_id uuid := gen_random_uuid();
  other_course_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (owner_id, owner_id::text || '@example.invalid', '{"name":"Course owner"}'),
    (other_id, other_id::text || '@example.invalid', '{"name":"Other student"}');
  insert into public.profiles (id, display_name) values
    (owner_id, 'Course owner'), (other_id, 'Other student')
    on conflict (id) do nothing;
  insert into public.courses (id, user_id, code, name, term, status) values
    (own_course_id, owner_id, 'BIOL 101', 'Cell biology', 'Fall 2026', 'active'),
    (other_course_id, other_id, 'HIST 210', 'Modern history', 'Fall 2026', 'active');
  insert into public.files (id, user_id, file_name, storage_path, mime_type, size_bytes)
    values (test_file_id, owner_id, 'notes.pdf', owner_id::text || '/' || test_file_id::text || '/source.pdf', 'application/pdf', 5);
  if not exists (
    select 1 from pg_proc
    where oid = 'public.assign_file_course(uuid, uuid)'::regprocedure
      and prosecdef
      and proconfig @> array['search_path=""']
  ) then
    raise exception 'assign_file_course must use security definer with an empty search path';
  end if;
  if has_function_privilege('anon', 'public.assign_file_course(uuid, uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.assign_file_course(uuid, uuid)', 'EXECUTE') then
    raise exception 'Only signed-in users can assign a course';
  end if;
  perform set_config('test.owner_id', owner_id::text, true);
  perform set_config('test.other_id', other_id::text, true);
  perform set_config('test.file_id', test_file_id::text, true);
  perform set_config('test.own_course_id', own_course_id::text, true);
  perform set_config('test.other_course_id', other_course_id::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);
select public.assign_file_course(current_setting('test.file_id')::uuid, current_setting('test.own_course_id')::uuid);
do $$ begin
  if not exists (
    select 1 from public.files
    where id = current_setting('test.file_id')::uuid
      and course_id = current_setting('test.own_course_id')::uuid
  ) then
    raise exception 'Owner could not assign their course';
  end if;
end $$;

do $$ begin
  begin
    perform public.assign_file_course(current_setting('test.file_id')::uuid, current_setting('test.other_course_id')::uuid);
    raise exception 'Owner assigned another student''s course';
  exception when others then
    if sqlerrm <> 'Course not found.' then raise; end if;
  end;
end $$;

select public.assign_file_course(current_setting('test.file_id')::uuid, null);
do $$ begin
  if exists (
    select 1 from public.files
    where id = current_setting('test.file_id')::uuid and course_id is not null
  ) then
    raise exception 'Clearing the course left a course assigned';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.other_id'), true);
do $$ begin
  begin
    perform public.assign_file_course(current_setting('test.file_id')::uuid, current_setting('test.other_course_id')::uuid);
    raise exception 'Another student assigned a course to this file';
  exception when others then
    if sqlerrm <> 'File not found.' then raise; end if;
  end;
end $$;

reset role;
select 'Course assignment ownership checks passed' as result;
rollback;

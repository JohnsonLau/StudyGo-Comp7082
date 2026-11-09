-- Requires the file tags migration. All fixtures roll back.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  test_file_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (owner_id, owner_id::text || '@example.invalid', '{"name":"Tag owner"}'),
    (other_id, other_id::text || '@example.invalid', '{"name":"Other student"}');
  insert into public.profiles (id, display_name) values
    (owner_id, 'Tag owner'), (other_id, 'Other student')
    on conflict (id) do nothing;
  insert into public.files (id, user_id, file_name, storage_path, mime_type, size_bytes)
    values (test_file_id, owner_id, 'notes.pdf', owner_id::text || '/' || test_file_id::text || '/source.pdf', 'application/pdf', 5);
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'files' and column_name = 'tags'
  ) then
    raise exception 'files.tags column is missing';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = 'public.update_file_tags(uuid, text[])'::regprocedure
      and prosecdef
      and proconfig @> array['search_path=""']
  ) then
    raise exception 'update_file_tags must use security definer with an empty search path';
  end if;
  if has_function_privilege('anon', 'public.update_file_tags(uuid, text[])', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_file_tags(uuid, text[])', 'EXECUTE') then
    raise exception 'Only signed-in users can edit tags';
  end if;
  perform set_config('test.owner_id', owner_id::text, true);
  perform set_config('test.other_id', other_id::text, true);
  perform set_config('test.file_id', test_file_id::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);
select public.update_file_tags(current_setting('test.file_id')::uuid, array['Biology', ' cells ', 'Biology']);
do $$ begin
  if (select tags from public.files where id = current_setting('test.file_id')::uuid) <> array['Biology', 'cells'] then
    raise exception 'Owner could not save cleaned tags';
  end if;
end $$;

do $$ begin
  begin
    perform public.update_file_tags(current_setting('test.file_id')::uuid, array['']);
    raise exception 'A blank tag was saved';
  exception when others then
    if sqlerrm <> 'Tags cannot be blank.' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.other_id'), true);
do $$ begin
  begin
    perform public.update_file_tags(current_setting('test.file_id')::uuid, array['Stolen']);
    raise exception 'Another student edited these tags';
  exception when others then
    if sqlerrm <> 'File not found.' then raise; end if;
  end;
end $$;

reset role;
select 'File tag ownership and validation checks passed' as result;
rollback;

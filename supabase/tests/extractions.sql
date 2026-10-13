-- Run in a transaction after the extraction migration; always roll back fixtures.
-- This file always rolls back its fixtures. Run only after applying the migration.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  test_file_id uuid := gen_random_uuid();
  first_attempt uuid;
  next_attempt uuid;
  claimed integer;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (owner_id, owner_id::text || '@example.invalid', '{"name":"Extraction test"}');
  insert into public.profiles (id, display_name) values (owner_id, 'Extraction test') on conflict (id) do nothing;
  insert into public.files (id, user_id, file_name, storage_path, mime_type, size_bytes)
    values (test_file_id, owner_id, 'test.pdf', owner_id::text || '/' || test_file_id::text || '/source.pdf', 'application/pdf', 5);
  select attempt_id into first_attempt from public.claim_file_extraction(test_file_id);
  if first_attempt is null then raise exception 'Initial claim failed'; end if;
  select count(*) into claimed from public.claim_file_extraction(test_file_id);
  if claimed <> 0 then raise exception 'Concurrent claim was allowed'; end if;
  update public.file_extractions set updated_at = now() - interval '4 minutes' where file_extractions.file_id = test_file_id;
  select attempt_id into next_attempt from public.claim_file_extraction(test_file_id);
  if next_attempt is null or next_attempt = first_attempt then raise exception 'Stale claim was not fenced'; end if;
  update public.file_extractions set status = 'ready', content = '{}' where file_extractions.file_id = test_file_id and attempt_id = first_attempt;
  if found then raise exception 'Old attempt overwrote a new claim'; end if;
  update public.file_extractions set status = 'failed' where file_extractions.file_id = test_file_id;
  select count(*) into claimed from public.claim_file_extraction(test_file_id);
  if claimed <> 1 then raise exception 'Retry failed'; end if;
  update public.file_extractions set status = 'failed' where file_extractions.file_id = test_file_id;
  select count(*) into claimed from public.claim_file_extraction(test_file_id);
  if claimed <> 0 then raise exception 'Attempt cap bypassed'; end if;
  update public.file_extractions set status = 'ready', content = '{}' where file_extractions.file_id = test_file_id;
  select count(*) into claimed from public.claim_file_extraction(test_file_id);
  if claimed <> 0 then raise exception 'Completed file reprocessed'; end if;
  if has_table_privilege('authenticated', 'public.file_extractions', 'INSERT') or
     has_table_privilege('authenticated', 'public.file_extractions', 'UPDATE') or
     has_function_privilege('authenticated', 'public.claim_file_extraction(uuid)', 'EXECUTE') then
    raise exception 'Authenticated user has backend write privileges';
  end if;
  perform set_config('test.owner_id', owner_id::text, true);
  perform set_config('test.file_id', test_file_id::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);
do $$ begin
  if (select count(*) from public.file_extractions where file_id = current_setting('test.file_id')::uuid) <> 1 then
    raise exception 'Owner cannot read extraction';
  end if;
end $$;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
do $$ begin
  if exists (select 1 from public.file_extractions where file_id = current_setting('test.file_id')::uuid) then
    raise exception 'Another user can read extraction';
  end if;
end $$;
reset role;
select 'Extraction claims and ownership checks passed' as result;
rollback;

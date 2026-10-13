-- Requires the update_file_extraction_content migration. All fixtures roll back.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  test_file_id uuid := gen_random_uuid();
  original jsonb := '{"title":"Cells","kind":"notes","summary":"Original summary","sections":[{"heading":"Structure","content":"A membrane surrounds the cell."}],"key_terms":[{"term":"Organelle","definition":"A specialized cell part."}]}'::jsonb;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (owner_id, owner_id::text || '@example.invalid', '{"name":"Content owner"}'),
    (other_id, other_id::text || '@example.invalid', '{"name":"Other student"}');
  insert into public.profiles (id, display_name) values
    (owner_id, 'Content owner'), (other_id, 'Other student')
    on conflict (id) do nothing;
  insert into public.files (id, user_id, file_name, storage_path, mime_type, size_bytes)
    values (test_file_id, owner_id, 'notes.pdf', owner_id::text || '/' || test_file_id::text || '/source.pdf', 'application/pdf', 5);
  insert into public.file_extractions (file_id, status, content, error)
    values (test_file_id, 'ready', original, null);
  if not exists (
    select 1 from pg_proc
    where oid = 'public.update_file_extraction_content(uuid, jsonb)'::regprocedure
      and prosecdef
      and proconfig @> array['search_path=""']
  ) then
    raise exception 'update_file_extraction_content must use security definer with an empty search path';
  end if;
  if has_function_privilege('anon', 'public.update_file_extraction_content(uuid, jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_file_extraction_content(uuid, jsonb)', 'EXECUTE') then
    raise exception 'Only signed-in users can edit study content';
  end if;
  perform set_config('test.owner_id', owner_id::text, true);
  perform set_config('test.other_id', other_id::text, true);
  perform set_config('test.file_id', test_file_id::text, true);
  perform set_config('test.original', original::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);
select public.update_file_extraction_content(
  current_setting('test.file_id')::uuid,
  jsonb_set(current_setting('test.original')::jsonb, '{summary}', '"Revised summary"')
);
do $$ begin
  if (select content->>'summary' from public.file_extractions where file_id = current_setting('test.file_id')::uuid) <> 'Revised summary' then
    raise exception 'Owner could not update the summary';
  end if;
  if (select status from public.file_extractions where file_id = current_setting('test.file_id')::uuid) <> 'ready' then
    raise exception 'Editing content changed the processing status';
  end if;
end $$;

do $$ begin
  begin
    perform public.update_file_extraction_content(
      current_setting('test.file_id')::uuid,
      jsonb_set(current_setting('test.original')::jsonb, '{summary}', '""')
    );
    raise exception 'A blank summary was saved';
  exception when others then
    if sqlerrm <> 'Study content must include a title, summary, and sections.' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.other_id'), true);
do $$ begin
  begin
    perform public.update_file_extraction_content(
      current_setting('test.file_id')::uuid,
      current_setting('test.original')::jsonb
    );
    raise exception 'Another student edited this study content';
  exception when others then
    if sqlerrm <> 'File not found.' then raise; end if;
  end;
end $$;

reset role;
update public.file_extractions
set status = 'processing', content = null
where file_id = current_setting('test.file_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);
do $$ begin
  begin
    perform public.update_file_extraction_content(
      current_setting('test.file_id')::uuid,
      current_setting('test.original')::jsonb
    );
    raise exception 'Processing content was edited';
  exception when others then
    if sqlerrm <> 'Study content can be edited after processing finishes.' then raise; end if;
  end;
end $$;

reset role;
select 'Extraction content edits and ownership checks passed' as result;
rollback;

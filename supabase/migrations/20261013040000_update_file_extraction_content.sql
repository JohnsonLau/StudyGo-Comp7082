-- Lets the file owner replace ready study content without changing processing state.
begin;

create function public.update_file_extraction_content(p_file_id uuid, p_content jsonb)
returns public.file_extractions
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.file_extractions;
  section jsonb;
  term jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to edit study content.';
  end if;

  if not exists (
    select 1 from public.files
    where files.id = p_file_id and files.user_id = (select auth.uid())
  ) then
    raise exception 'File not found.';
  end if;

  if jsonb_typeof(p_content) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_content)) <> 5
    or not jsonb_exists(p_content, 'title')
    or not jsonb_exists(p_content, 'kind')
    or not jsonb_exists(p_content, 'summary')
    or not jsonb_exists(p_content, 'sections')
    or not jsonb_exists(p_content, 'key_terms')
    or jsonb_typeof(p_content->'title') is distinct from 'string'
    or btrim(p_content->>'title') = ''
    or jsonb_typeof(p_content->'summary') is distinct from 'string'
    or btrim(p_content->>'summary') = ''
    or p_content->>'kind' not in ('notes', 'coursework', 'course_outline', 'other')
    or jsonb_typeof(p_content->'sections') is distinct from 'array'
    or jsonb_typeof(p_content->'key_terms') is distinct from 'array'
  then
    raise exception 'Study content must include a title, summary, and sections.';
  end if;

  for section in select value from jsonb_array_elements(p_content->'sections')
  loop
    if jsonb_typeof(section) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(section)) <> 2
      or not jsonb_exists(section, 'heading')
      or not jsonb_exists(section, 'content')
      or jsonb_typeof(section->'heading') is distinct from 'string'
      or btrim(section->>'heading') = ''
      or jsonb_typeof(section->'content') is distinct from 'string'
      or btrim(section->>'content') = ''
    then
      raise exception 'Each section needs a heading and body.';
    end if;
  end loop;

  for term in select value from jsonb_array_elements(p_content->'key_terms')
  loop
    if jsonb_typeof(term) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(term)) <> 2
      or not jsonb_exists(term, 'term')
      or not jsonb_exists(term, 'definition')
      or jsonb_typeof(term->'term') is distinct from 'string'
      or jsonb_typeof(term->'definition') is distinct from 'string'
    then
      raise exception 'Each key term needs a term and definition.';
    end if;
  end loop;

  update public.file_extractions
  set content = p_content, updated_at = now()
  where file_extractions.file_id = p_file_id and file_extractions.status = 'ready'
  returning * into saved;

  if saved.file_id is null then
    raise exception 'Study content can be edited after processing finishes.';
  end if;

  return saved;
end;
$$;

revoke all on function public.update_file_extraction_content(uuid, jsonb) from public, anon;
grant execute on function public.update_file_extraction_content(uuid, jsonb) to authenticated;

commit;

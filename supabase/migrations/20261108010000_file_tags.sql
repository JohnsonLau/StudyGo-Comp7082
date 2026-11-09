-- Free-form tags belong to the file owner and can be edited from Study materials.
begin;

alter table public.files
  add column if not exists tags text[] not null default '{}';

create or replace function public.update_file_tags(p_file_id uuid, p_tags text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text[] := '{}';
  candidate text;
  updated_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to edit tags.';
  end if;

  if p_tags is null then
    raise exception 'Tags are required.';
  end if;

  if coalesce(array_length(p_tags, 1), 0) > 20 then
    raise exception 'A file can have at most 20 tags.';
  end if;

  foreach candidate in array p_tags
  loop
    candidate := btrim(candidate);
    if candidate = '' then
      raise exception 'Tags cannot be blank.';
    end if;
    if char_length(candidate) > 40 then
      raise exception 'Each tag must be 40 characters or fewer.';
    end if;
    if exists (
      select 1 from unnest(cleaned) as existing(tag)
      where lower(existing.tag) = lower(candidate)
    ) then
      continue;
    end if;
    cleaned := array_append(cleaned, candidate);
  end loop;

  update public.files
  set tags = cleaned
  where files.id = p_file_id and files.user_id = (select auth.uid())
  returning files.id into updated_id;

  if updated_id is null then
    raise exception 'File not found.';
  end if;

  return cleaned;
end;
$$;

revoke all on function public.update_file_tags(uuid, text[]) from public, anon;
grant execute on function public.update_file_tags(uuid, text[]) to authenticated;

commit;

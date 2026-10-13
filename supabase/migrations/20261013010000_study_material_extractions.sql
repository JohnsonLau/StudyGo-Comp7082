-- Requires the existing StudyGo public.files and public.profiles tables.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-materials', 'study-materials', false, 2097152,
  array['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png']);

create policy "Upload own study materials" on storage.objects
for insert to authenticated with check (
  bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "Read own study materials" on storage.objects
for select to authenticated using (
  bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "Delete own study materials" on storage.objects
for delete to authenticated using (
  bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create table public.file_extractions (
  file_id uuid primary key references public.files(id) on delete cascade,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  content jsonb,
  error text,
  model text,
  attempt_id uuid not null default gen_random_uuid(),
  attempts integer not null default 1 check (attempts between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'ready' and content is not null and error is null)
    or (status <> 'ready' and content is null))
);
alter table public.file_extractions enable row level security;
revoke all on public.file_extractions from anon, authenticated;
grant select on public.file_extractions to authenticated;
grant all on public.file_extractions to service_role;
create policy "Read own extractions" on public.file_extractions
for select to authenticated using (
  exists (select 1 from public.files where files.id = file_id and files.user_id = (select auth.uid()))
);

-- A single atomic claim prevents concurrent requests from generating duplicate charges.
-- Stale attempts may be reclaimed after three minutes; attempt_id fences late results.
create function public.claim_file_extraction(p_file_id uuid)
returns setof public.file_extractions
language sql security invoker set search_path = '' as $$
  insert into public.file_extractions (file_id) values (p_file_id)
  on conflict (file_id) do update set
    status = 'processing', content = null, error = null,
    attempt_id = gen_random_uuid(), attempts = public.file_extractions.attempts + 1,
    updated_at = now()
  where public.file_extractions.attempts < 3 and (
    public.file_extractions.status = 'failed' or
    (public.file_extractions.status = 'processing' and public.file_extractions.updated_at < now() - interval '3 minutes')
  ) returning *;
$$;
revoke all on function public.claim_file_extraction(uuid) from public, anon, authenticated;
grant execute on function public.claim_file_extraction(uuid) to service_role;
commit;

begin;

-- Snapshots keep practice history intact when source notes change or are deleted.
create table public.mock_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_file_ids uuid[] not null,
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 3 and 5),
  answers jsonb,
  score integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((completed_at is null and answers is null and score is null) or
    (completed_at is not null and answers is not null and score between 0 and jsonb_array_length(questions)))
);
create index mock_quizzes_user_created_idx on public.mock_quizzes(user_id, created_at desc);
alter table public.mock_quizzes enable row level security;
revoke all on public.mock_quizzes from public, anon, authenticated;
grant select on public.mock_quizzes to authenticated;
grant all on public.mock_quizzes to service_role;
create policy "Read own mock quizzes" on public.mock_quizzes for select to authenticated
using (user_id = (select auth.uid()));

create function public.create_mock_quiz(p_file_ids uuid[], p_count integer)
returns public.mock_quizzes
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  pool jsonb;
  item jsonb;
  choices text[];
  result_questions jsonb := '[]'::jsonb;
  saved public.mock_quizzes;
  quiz_title text;
  ids uuid[];
begin
  if caller is null then raise exception 'Sign in to create a quiz.'; end if;
  if p_count is null or p_count not in (3, 5) then raise exception 'Choose 3 or 5 questions.'; end if;
  if p_file_ids is null or cardinality(p_file_ids) not between 1 and 50 then
    raise exception 'Select between 1 and 50 notes.';
  end if;
  select array_agg(distinct id) into ids from unnest(p_file_ids) as id;
  if exists (
    select 1 from unnest(ids) as chosen(file_id) where not exists (
      select 1 from public.files f join public.file_extractions e on e.file_id = f.id
      where f.id = chosen.file_id and f.user_id = caller and e.status = 'ready'
    )
  ) then raise exception 'Some selected notes are unavailable or have not finished processing.'; end if;

  -- Deduplicate both labels and definitions to avoid ambiguous answer choices.
  select jsonb_agg(to_jsonb(t)) into pool from (
    select distinct on (lower(definition)) * from (
      select distinct on (lower(btrim(term->>'term')))
        btrim(term->>'term') as term, btrim(term->>'definition') as definition,
        f.id as source_file_id, f.file_name as source_name
      from public.files f join public.file_extractions e on e.file_id = f.id
      cross join lateral jsonb_array_elements(e.content->'key_terms') as term
      where f.id = any(ids) and f.user_id = caller and e.status = 'ready'
        and jsonb_typeof(term->'term') = 'string' and jsonb_typeof(term->'definition') = 'string'
        and btrim(term->>'term') <> '' and btrim(term->>'definition') <> ''
      order by lower(btrim(term->>'term')), f.id
    ) unique_terms order by lower(definition), term
  ) t;
  if pool is null or jsonb_array_length(pool) < greatest(4, p_count) then
    raise exception 'Select notes with at least % distinct key terms and definitions. Process more notes or choose fewer questions.', greatest(4, p_count);
  end if;

  for item in select value from jsonb_array_elements(pool) order by random() limit p_count loop
    select array_agg(label order by random()) into choices from (
      (select value->>'term' as label from jsonb_array_elements(pool)
        where value->>'term' <> item->>'term' order by random() limit 3)
      union all select item->>'term'
    ) options;
    result_questions := result_questions || jsonb_build_array(jsonb_build_object(
      'prompt', 'Which term matches this definition?' || E'\n' || (item->>'definition'),
      'options', to_jsonb(choices), 'correct', array_position(choices, item->>'term') - 1,
      'explanation', (item->>'term') || ': ' || (item->>'definition'),
      'source_file_id', item->>'source_file_id', 'source_name', item->>'source_name'
    ));
  end loop;
  select left(string_agg(f.file_name, ', ' order by f.file_name), 160) into quiz_title
    from public.files f where f.id = any(ids) and f.user_id = caller;
  insert into public.mock_quizzes(user_id, title, source_file_ids, questions)
    values(caller, quiz_title, ids, result_questions) returning * into saved;
  return saved;
end $$;
revoke all on function public.create_mock_quiz(uuid[], integer) from public, anon;
grant execute on function public.create_mock_quiz(uuid[], integer) to authenticated;

create function public.submit_mock_quiz(p_quiz_id uuid, p_answers jsonb)
returns public.mock_quizzes
language plpgsql security definer set search_path = '' as $$
declare
  saved public.mock_quizzes;
  correct_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to submit a quiz.'; end if;
  select * into saved from public.mock_quizzes
    where id = p_quiz_id and user_id = auth.uid() for update;
  if saved.id is null then raise exception 'Quiz not found.'; end if;
  -- Repeated submissions cannot replace a completed score.
  if saved.completed_at is not null then return saved; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Answer every question before finishing.';
  end if;
  if jsonb_array_length(p_answers) <> jsonb_array_length(saved.questions) or exists (
    select 1 from jsonb_array_elements(p_answers) a
    where jsonb_typeof(a) <> 'number' or a::text not in ('0', '1', '2', '3')
  ) then raise exception 'Answer every question before finishing.'; end if;
  select count(*) into correct_count
    from jsonb_array_elements(saved.questions) with ordinality as q(value, position)
    where (q.value->>'correct')::integer = (p_answers->>(q.position::integer - 1))::integer;
  update public.mock_quizzes set answers = p_answers, score = correct_count, completed_at = now()
    where id = saved.id returning * into saved;
  return saved;
end $$;
revoke all on function public.submit_mock_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_mock_quiz(uuid, jsonb) to authenticated;
commit;

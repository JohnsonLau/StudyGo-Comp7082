begin;

-- created_at is the start of an attempt. Use wall-clock time, including when
-- creation and submission happen in the same transaction.
alter table public.mock_quizzes alter column created_at set default clock_timestamp();
alter table public.mock_quizzes drop constraint mock_quizzes_check;
alter table public.mock_quizzes add constraint mock_quizzes_completion_state check (
  (completed_at is null and answers is null and score is null) or
  (completed_at is not null and answers is not null and score is not null
    and score between 0 and jsonb_array_length(questions))
);
alter table public.mock_quizzes add constraint mock_quizzes_completion_time
  check (completed_at is null or completed_at >= created_at);
alter table public.mock_quizzes add column elapsed_seconds integer generated always as (
  floor(extract(epoch from (completed_at - created_at)))::integer
) stored;

create or replace function public.submit_mock_quiz(p_quiz_id uuid, p_answers jsonb)
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
  -- Lock before checking completion: concurrent retries return the first result.
  if saved.completed_at is not null then return saved; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Answer every question before finishing.';
  end if;
  if jsonb_array_length(p_answers) <> jsonb_array_length(saved.questions) then
    raise exception 'Answer every question before finishing.';
  end if;
  -- Validate against each question's options rather than a fixed option range.
  -- Compare JSON values so fractions, strings, nulls and negative indices fail
  -- without unsafe casts on untrusted input.
  if exists (
    select 1 from jsonb_array_elements(saved.questions) with ordinality as q(value, position)
    where not exists (
      select 1 from jsonb_array_elements(q.value->'options') with ordinality as o(value, position)
      where p_answers->(q.position::integer - 1) = to_jsonb(o.position - 1)
    )
  ) then raise exception 'Answer every question before finishing.'; end if;
  select count(*) into correct_count
    from jsonb_array_elements(saved.questions) with ordinality as q(value, position)
    where q.value->'correct' = p_answers->(q.position::integer - 1);
  update public.mock_quizzes
    set answers = p_answers, score = correct_count, completed_at = clock_timestamp()
    where id = saved.id returning * into saved;
  return saved;
end $$;
revoke all on function public.submit_mock_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_mock_quiz(uuid, jsonb) to authenticated;

commit;

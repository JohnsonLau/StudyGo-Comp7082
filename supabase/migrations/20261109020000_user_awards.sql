begin;

create table public.awards (
  id text primary key,
  title text not null,
  description text not null,
  unit text not null,
  target integer not null check (target >= 1),
  criterion text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.awards enable row level security;
revoke all on public.awards from public, anon, authenticated;
grant select on public.awards to authenticated;
grant all on public.awards to service_role;

create policy "Read awards catalog"
  on public.awards
  for select
  to authenticated
  using (true);

create table public.user_awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  award_id text not null references public.awards(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  progress_at_unlock integer not null check (progress_at_unlock >= 0),
  primary key (user_id, award_id)
);

create index user_awards_user_unlocked_idx
  on public.user_awards (user_id, unlocked_at desc);

alter table public.user_awards enable row level security;
revoke all on public.user_awards from public, anon, authenticated;
grant select on public.user_awards to authenticated;
grant all on public.user_awards to service_role;

create policy "Read own user awards"
  on public.user_awards
  for select
  to authenticated
  using (user_id = (select auth.uid()));

insert into public.awards (id, title, description, unit, target, criterion, sort_order)
values
  ('login-streak', 'Login Streak', 'Login 3 days in a row', 'days', 3, 'login-streak', 10),
  ('file-upload', 'File Upload', 'Upload a file', 'files', 1, 'file-upload', 20),
  ('quiz-generation', 'Quiz Generation', 'Generate a quiz', 'quizzes', 1, 'quiz-generation', 30),
  ('quiz-dedication', 'Quiz Dedication', 'Complete 3 quizzes', 'quizzes', 3, 'quiz-dedication', 40),
  ('quiz-mastery', 'Quiz Mastery', 'Score perfect on 3 quizzes', 'perfect scores', 3, 'quiz-mastery', 50);

-- Evaluate metrics, permanently save newly earned awards, return catalog + progress.
create function public.sync_user_awards()
returns table (
  award_id text,
  title text,
  description text,
  unit text,
  target integer,
  sort_order integer,
  current_progress integer,
  unlocked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  login_streak integer := 0;
  file_count integer := 0;
  quiz_generated integer := 0;
  quiz_completed integer := 0;
  quiz_perfect integer := 0;
  award_row public.awards;
  metric integer;
begin
  if caller is null then
    raise exception 'Sign in to sync your awards.';
  end if;

  login_streak := public.record_daily_login();

  select count(*)::integer into file_count
  from public.files
  where user_id = caller;

  select count(*)::integer into quiz_generated
  from public.mock_quizzes
  where user_id = caller;

  select count(*)::integer into quiz_completed
  from public.mock_quizzes
  where user_id = caller and completed_at is not null;

  select count(*)::integer into quiz_perfect
  from public.mock_quizzes
  where user_id = caller
    and completed_at is not null
    and score is not null
    and score = jsonb_array_length(questions);

  for award_row in
    select * from public.awards order by sort_order, id
  loop
    metric := case award_row.criterion
      when 'login-streak' then login_streak
      when 'file-upload' then file_count
      when 'quiz-generation' then quiz_generated
      when 'quiz-dedication' then quiz_completed
      when 'quiz-mastery' then quiz_perfect
      else 0
    end;

    if metric >= award_row.target then
      insert into public.user_awards (user_id, award_id, progress_at_unlock)
      values (caller, award_row.id, metric)
      on conflict (user_id, award_id) do nothing;
    end if;
  end loop;

  return query
  select
    a.id,
    a.title,
    a.description,
    a.unit,
    a.target,
    a.sort_order,
    case a.criterion
      when 'login-streak' then login_streak
      when 'file-upload' then file_count
      when 'quiz-generation' then quiz_generated
      when 'quiz-dedication' then quiz_completed
      when 'quiz-mastery' then quiz_perfect
      else 0
    end,
    ua.unlocked_at
  from public.awards a
  left join public.user_awards ua
    on ua.award_id = a.id and ua.user_id = caller
  order by a.sort_order, a.id;
end;
$$;

revoke all on function public.sync_user_awards() from public, anon;
grant execute on function public.sync_user_awards() to authenticated;

commit;

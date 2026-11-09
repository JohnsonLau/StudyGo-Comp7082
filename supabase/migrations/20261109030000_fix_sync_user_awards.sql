begin;

-- OUT params (title, target, …) shadowed awards columns and made RETURN QUERY
-- resolve to NULL variables, so the UI got empty/broken award rows.
create or replace function public.sync_user_awards()
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
#variable_conflict use_column
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
  where files.user_id = caller;

  select count(*)::integer into quiz_generated
  from public.mock_quizzes
  where mock_quizzes.user_id = caller;

  select count(*)::integer into quiz_completed
  from public.mock_quizzes
  where mock_quizzes.user_id = caller and mock_quizzes.completed_at is not null;

  select count(*)::integer into quiz_perfect
  from public.mock_quizzes
  where mock_quizzes.user_id = caller
    and mock_quizzes.completed_at is not null
    and mock_quizzes.score is not null
    and mock_quizzes.score = jsonb_array_length(mock_quizzes.questions);

  for award_row in
    select * from public.awards as catalog order by catalog.sort_order, catalog.id
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
      insert into public.user_awards as earned (user_id, award_id, progress_at_unlock)
      values (caller, award_row.id, metric)
      on conflict (user_id, award_id) do nothing;
    end if;
  end loop;

  return query
  select
    catalog.id,
    catalog.title,
    catalog.description,
    catalog.unit,
    catalog.target,
    catalog.sort_order,
    case catalog.criterion
      when 'login-streak' then login_streak
      when 'file-upload' then file_count
      when 'quiz-generation' then quiz_generated
      when 'quiz-dedication' then quiz_completed
      when 'quiz-mastery' then quiz_perfect
      else 0
    end,
    earned.unlocked_at
  from public.awards as catalog
  left join public.user_awards as earned
    on earned.award_id = catalog.id and earned.user_id = caller
  order by catalog.sort_order, catalog.id;
end;
$$;

revoke all on function public.sync_user_awards() from public, anon;
grant execute on function public.sync_user_awards() to authenticated;

commit;

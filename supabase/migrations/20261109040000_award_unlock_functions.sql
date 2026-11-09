begin;

-- Each award has its own unlock RPC. Returns jsonb:
--   {"unlocked": true, "award_id", "title", "description"} when newly earned
--   {"unlocked": false, ...} otherwise

create or replace function public.unlock_login_streak_award()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := (select auth.uid());
  metric integer;
  award_target integer;
  award_title text;
  award_description text;
  unlocked_id text;
begin
  if caller is null then
    raise exception 'Sign in to unlock awards.';
  end if;

  metric := public.record_daily_login();

  select catalog.target, catalog.title, catalog.description
    into award_target, award_title, award_description
  from public.awards as catalog
  where catalog.id = 'login-streak';

  if award_target is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'login-streak');
  end if;

  if metric < award_target then
    return jsonb_build_object(
      'unlocked', false,
      'award_id', 'login-streak',
      'progress', metric,
      'target', award_target
    );
  end if;

  insert into public.user_awards as earned (user_id, award_id, progress_at_unlock)
  values (caller, 'login-streak', metric)
  on conflict (user_id, award_id) do nothing
  returning earned.award_id into unlocked_id;

  if unlocked_id is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'login-streak');
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'award_id', 'login-streak',
    'title', award_title,
    'description', award_description
  );
end;
$$;

create or replace function public.unlock_file_upload_award()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := (select auth.uid());
  metric integer;
  award_target integer;
  award_title text;
  award_description text;
  unlocked_id text;
begin
  if caller is null then
    raise exception 'Sign in to unlock awards.';
  end if;

  select count(*)::integer into metric
  from public.files
  where files.user_id = caller;

  select catalog.target, catalog.title, catalog.description
    into award_target, award_title, award_description
  from public.awards as catalog
  where catalog.id = 'file-upload';

  if award_target is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'file-upload');
  end if;

  if metric < award_target then
    return jsonb_build_object(
      'unlocked', false,
      'award_id', 'file-upload',
      'progress', metric,
      'target', award_target
    );
  end if;

  insert into public.user_awards as earned (user_id, award_id, progress_at_unlock)
  values (caller, 'file-upload', metric)
  on conflict (user_id, award_id) do nothing
  returning earned.award_id into unlocked_id;

  if unlocked_id is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'file-upload');
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'award_id', 'file-upload',
    'title', award_title,
    'description', award_description
  );
end;
$$;

create or replace function public.unlock_quiz_generation_award()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := (select auth.uid());
  metric integer;
  award_target integer;
  award_title text;
  award_description text;
  unlocked_id text;
begin
  if caller is null then
    raise exception 'Sign in to unlock awards.';
  end if;

  select count(*)::integer into metric
  from public.mock_quizzes
  where mock_quizzes.user_id = caller;

  select catalog.target, catalog.title, catalog.description
    into award_target, award_title, award_description
  from public.awards as catalog
  where catalog.id = 'quiz-generation';

  if award_target is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'quiz-generation');
  end if;

  if metric < award_target then
    return jsonb_build_object(
      'unlocked', false,
      'award_id', 'quiz-generation',
      'progress', metric,
      'target', award_target
    );
  end if;

  insert into public.user_awards as earned (user_id, award_id, progress_at_unlock)
  values (caller, 'quiz-generation', metric)
  on conflict (user_id, award_id) do nothing
  returning earned.award_id into unlocked_id;

  if unlocked_id is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'quiz-generation');
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'award_id', 'quiz-generation',
    'title', award_title,
    'description', award_description
  );
end;
$$;

create or replace function public.unlock_quiz_dedication_award()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := (select auth.uid());
  metric integer;
  award_target integer;
  award_title text;
  award_description text;
  unlocked_id text;
begin
  if caller is null then
    raise exception 'Sign in to unlock awards.';
  end if;

  select count(*)::integer into metric
  from public.mock_quizzes
  where mock_quizzes.user_id = caller
    and mock_quizzes.completed_at is not null;

  select catalog.target, catalog.title, catalog.description
    into award_target, award_title, award_description
  from public.awards as catalog
  where catalog.id = 'quiz-dedication';

  if award_target is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'quiz-dedication');
  end if;

  if metric < award_target then
    return jsonb_build_object(
      'unlocked', false,
      'award_id', 'quiz-dedication',
      'progress', metric,
      'target', award_target
    );
  end if;

  insert into public.user_awards as earned (user_id, award_id, progress_at_unlock)
  values (caller, 'quiz-dedication', metric)
  on conflict (user_id, award_id) do nothing
  returning earned.award_id into unlocked_id;

  if unlocked_id is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'quiz-dedication');
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'award_id', 'quiz-dedication',
    'title', award_title,
    'description', award_description
  );
end;
$$;

create or replace function public.unlock_quiz_mastery_award()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := (select auth.uid());
  metric integer;
  award_target integer;
  award_title text;
  award_description text;
  unlocked_id text;
begin
  if caller is null then
    raise exception 'Sign in to unlock awards.';
  end if;

  select count(*)::integer into metric
  from public.mock_quizzes
  where mock_quizzes.user_id = caller
    and mock_quizzes.completed_at is not null
    and mock_quizzes.score is not null
    and mock_quizzes.score = jsonb_array_length(mock_quizzes.questions);

  select catalog.target, catalog.title, catalog.description
    into award_target, award_title, award_description
  from public.awards as catalog
  where catalog.id = 'quiz-mastery';

  if award_target is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'quiz-mastery');
  end if;

  if metric < award_target then
    return jsonb_build_object(
      'unlocked', false,
      'award_id', 'quiz-mastery',
      'progress', metric,
      'target', award_target
    );
  end if;

  insert into public.user_awards as earned (user_id, award_id, progress_at_unlock)
  values (caller, 'quiz-mastery', metric)
  on conflict (user_id, award_id) do nothing
  returning earned.award_id into unlocked_id;

  if unlocked_id is null then
    return jsonb_build_object('unlocked', false, 'award_id', 'quiz-mastery');
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'award_id', 'quiz-mastery',
    'title', award_title,
    'description', award_description
  );
end;
$$;

revoke all on function public.unlock_login_streak_award() from public, anon;
revoke all on function public.unlock_file_upload_award() from public, anon;
revoke all on function public.unlock_quiz_generation_award() from public, anon;
revoke all on function public.unlock_quiz_dedication_award() from public, anon;
revoke all on function public.unlock_quiz_mastery_award() from public, anon;

grant execute on function public.unlock_login_streak_award() to authenticated;
grant execute on function public.unlock_file_upload_award() to authenticated;
grant execute on function public.unlock_quiz_generation_award() to authenticated;
grant execute on function public.unlock_quiz_dedication_award() to authenticated;
grant execute on function public.unlock_quiz_mastery_award() to authenticated;

-- Awards page listing still syncs via the per-award unlockers, then returns status.
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
begin
  if caller is null then
    raise exception 'Sign in to sync your awards.';
  end if;

  perform public.unlock_login_streak_award();
  perform public.unlock_file_upload_award();
  perform public.unlock_quiz_generation_award();
  perform public.unlock_quiz_dedication_award();
  perform public.unlock_quiz_mastery_award();

  select coalesce(daily_logins.streak, 0) into login_streak
  from public.daily_logins
  where daily_logins.user_id = caller;

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

  return query
  select
    catalog.id,
    catalog.title,
    catalog.description,
    catalog.unit,
    catalog.target,
    catalog.sort_order,
    case catalog.criterion
      when 'login-streak' then coalesce(login_streak, 0)
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

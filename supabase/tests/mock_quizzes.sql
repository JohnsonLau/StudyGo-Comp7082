-- Run with all migrations installed. All fixtures roll back.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  note_id uuid := gen_random_uuid();
  other_note uuid := gen_random_uuid();
  short_note uuid := gen_random_uuid();
  processing_note uuid := gen_random_uuid();
  content jsonb := '{"title":"Biology","kind":"notes","summary":"Cell structures","sections":[],"key_terms":[{"term":"Membrane","definition":"Controls cell transport"},{"term":"Ribosome","definition":"Makes proteins"},{"term":"Nucleus","definition":"Stores genetic material"},{"term":"Chloroplast","definition":"Performs photosynthesis"},{"term":"Mitochondrion","definition":"Produces ATP"},{"term":" membrane ","definition":"Duplicate label"},{"term":"Synonym","definition":"Makes proteins"}]}'::jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text || '@example.invalid','{}'), (other_id,other_id::text || '@example.invalid','{}');
  insert into public.profiles(id,display_name) values(owner_id,'Quiz test'),(other_id,'Other test') on conflict(id) do nothing;
  insert into public.files(id,user_id,file_name,storage_path,mime_type,size_bytes) values
    (note_id,owner_id,'quiz-test.pdf',owner_id::text || '/' || note_id::text || '/notes.pdf','application/pdf',5),
    (other_note,other_id,'other.pdf',other_id::text || '/' || other_note::text || '/notes.pdf','application/pdf',5),
    (short_note,owner_id,'short.pdf',owner_id::text || '/' || short_note::text || '/notes.pdf','application/pdf',5),
    (processing_note,owner_id,'processing.pdf',owner_id::text || '/' || processing_note::text || '/notes.pdf','application/pdf',5);
  insert into public.file_extractions(file_id,status,content) values
    (note_id,'ready',content),(other_note,'ready',content),
    (short_note,'ready',jsonb_set(content,'{key_terms}','[{"term":"One","definition":"Only one term"}]'));
  perform set_config('test.quiz_owner',owner_id::text,true);
  perform set_config('test.quiz_other',other_id::text,true);
  perform set_config('test.quiz_note',note_id::text,true);
  perform set_config('test.quiz_other_note',other_note::text,true);
  perform set_config('test.quiz_short',short_note::text,true);
  perform set_config('test.quiz_processing',processing_note::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.quiz_owner'), true);
do $$
declare
  saved public.mock_quizzes;
  done public.mock_quizzes;
  correct_answers jsonb;
  q jsonb;
  invalid_answers jsonb;
  completed_time timestamptz;
begin
  if has_table_privilege('authenticated','public.mock_quizzes','INSERT') or
    has_table_privilege('authenticated','public.mock_quizzes','UPDATE') or
    has_function_privilege('anon','public.create_mock_quiz(uuid[],integer)','EXECUTE') or
    has_function_privilege('anon','public.submit_mock_quiz(uuid,jsonb)','EXECUTE') then
    raise exception 'Quiz mutation privileges are too broad';
  end if;
  saved := public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],5);
  perform set_config('test.saved_quiz',saved.id::text,true);
  if jsonb_array_length(saved.questions) <> 5 or saved.score is not null
    or saved.answers is not null or saved.completed_at is not null
    or saved.elapsed_seconds is not null or saved.created_at is null then raise exception 'Incorrect quiz state'; end if;
  for q in select value from jsonb_array_elements(saved.questions) loop
    if jsonb_array_length(q->'options') <> 4 or q->>'source_file_id' <> current_setting('test.quiz_note')
      or (select count(distinct value) from jsonb_array_elements(q->'options')) <> 4 then raise exception 'Invalid question or source'; end if;
  end loop;
  if (select count(distinct value->>'prompt') from jsonb_array_elements(saved.questions)) <> 5 then raise exception 'Questions repeat'; end if;
  begin
    perform public.submit_mock_quiz(saved.id,'[0]');
    raise exception 'Accepted incomplete answers';
  exception when others then if sqlerrm <> 'Answer every question before finishing.' then raise; end if; end;
  for invalid_answers in select value from jsonb_array_elements(
    '[null, {}, true, "answers", [0,1,2,3,null], [0,1,2,3,-1], [0,1,2,3,0.5], [0,1,2,3,true], [0,1,2,3,{}], [0,1,2,3,0,0]]'::jsonb
  ) loop
    begin
      perform public.submit_mock_quiz(saved.id,invalid_answers);
      raise exception 'Accepted malformed answers: %', invalid_answers;
    exception when others then if sqlerrm <> 'Answer every question before finishing.' then raise; end if; end;
  end loop;
  begin
    perform public.submit_mock_quiz(saved.id,null);
    raise exception 'Accepted SQL null answers';
  exception when others then if sqlerrm <> 'Answer every question before finishing.' then raise; end if; end;
  if exists(select 1 from public.mock_quizzes where id=saved.id and
    (answers is not null or score is not null or completed_at is not null)) then
    raise exception 'Invalid submission changed quiz state';
  end if;
  begin
    perform public.submit_mock_quiz(saved.id,'[0,1,2,3,4]');
    raise exception 'Accepted invalid option';
  exception when others then if sqlerrm <> 'Answer every question before finishing.' then raise; end if; end;
  begin
    perform public.submit_mock_quiz(saved.id,'[0,1,2,3,"0"]');
    raise exception 'Accepted string answer';
  exception when others then if sqlerrm <> 'Answer every question before finishing.' then raise; end if; end;
  select jsonb_agg(value->'correct') into correct_answers from jsonb_array_elements(saved.questions);
  done := public.submit_mock_quiz(saved.id,correct_answers);
  if done.score <> 5 or done.completed_at is null or done.answers <> correct_answers
    or done.elapsed_seconds is null or done.elapsed_seconds < 0
    or done.completed_at < done.created_at then raise exception 'Server grading or timing failed'; end if;
  completed_time := done.completed_at;
  if not exists(select 1 from public.mock_quizzes where id=done.id and answers=correct_answers
    and score=5 and completed_at=completed_time) then raise exception 'Result was not persisted'; end if;
  done := public.submit_mock_quiz(saved.id,'[0,0,0,0,0]');
  if done.score <> 5 or done.answers <> correct_answers or done.completed_at <> completed_time then raise exception 'Completed result was replaced'; end if;
  saved := public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],3);
  select jsonb_agg(to_jsonb(((value->>'correct')::integer + 1) % 4)) into correct_answers from jsonb_array_elements(saved.questions);
  done := public.submit_mock_quiz(saved.id,correct_answers);
  if done.score <> 0 then raise exception 'Zero score grading failed'; end if;
  saved := public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],3);
  select jsonb_agg(case when position=1 then value->'correct'
    else to_jsonb(((value->>'correct')::integer + 1) % 4) end order by position)
    into correct_answers from jsonb_array_elements(saved.questions) with ordinality as q(value,position);
  done := public.submit_mock_quiz(saved.id,correct_answers);
  if done.score <> 1 then raise exception 'Partial score grading failed'; end if;
  begin
    perform public.submit_mock_quiz(gen_random_uuid(),'[0,0,0]');
    raise exception 'Accepted nonexistent quiz';
  exception when others then if sqlerrm <> 'Quiz not found.' then raise; end if; end;
end $$;
do $$ begin
  begin
    perform public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid,current_setting('test.quiz_other_note')::uuid],3);
    raise exception 'Used another owner note';
  exception when others then if sqlerrm <> 'Some selected notes are unavailable or have not finished processing.' then raise; end if; end;
  begin
    perform public.create_mock_quiz(array[current_setting('test.quiz_processing')::uuid],3);
    raise exception 'Used unprocessed note';
  exception when others then if sqlerrm <> 'Some selected notes are unavailable or have not finished processing.' then raise; end if; end;
  begin
    perform public.create_mock_quiz(array[current_setting('test.quiz_short')::uuid],3);
    raise exception 'Used insufficient terms';
  exception when others then if sqlerrm not like 'Select notes with at least 4 distinct%' then raise; end if; end;
  begin
    perform public.create_mock_quiz(array[]::uuid[],3);
    raise exception 'Accepted empty selection';
  exception when others then if sqlerrm <> 'Select between 1 and 50 notes.' then raise; end if; end;
  begin
    perform public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],4);
    raise exception 'Accepted invalid count';
  exception when others then if sqlerrm <> 'Choose 3 or 5 questions.' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.quiz_other'), true);
do $$ begin
  if exists(select 1 from public.mock_quizzes where id=current_setting('test.saved_quiz')::uuid) then raise exception 'Another user read a quiz'; end if;
  begin
    perform public.submit_mock_quiz(current_setting('test.saved_quiz')::uuid,'[0,0,0,0,0]');
    raise exception 'Another user submitted a quiz';
  exception when others then if sqlerrm <> 'Quiz not found.' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.submit_mock_quiz(current_setting('test.saved_quiz')::uuid,'[0,0,0,0,0]');
    raise exception 'Signed-out submission allowed';
  exception when others then if sqlerrm <> 'Sign in to submit a quiz.' then raise; end if; end;
  begin
    perform public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],3);
    raise exception 'Signed-out creation allowed';
  exception when others then if sqlerrm <> 'Sign in to create a quiz.' then raise; end if; end;
end $$;
reset role;
-- Simulate an attempt started 90 seconds ago. Give it two-option questions to
-- ensure submission validates the actual snapshot, not a hard-coded 0..3 range.
select set_config('request.jwt.claim.sub', current_setting('test.quiz_owner'), true);
do $$
declare saved public.mock_quizzes;
begin
  saved := public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],3);
  update public.mock_quizzes set created_at=clock_timestamp() - interval '90 seconds',
    questions='[{"prompt":"One","options":["A","B"],"correct":0},{"prompt":"Two","options":["A","B"],"correct":1},{"prompt":"Three","options":["A","B"],"correct":0}]'
    where id=saved.id;
  perform set_config('test.timed_quiz',saved.id::text,true);
  begin
    update public.mock_quizzes set answers='[0,1,0]', completed_at=clock_timestamp(), score=null where id=saved.id;
    raise exception 'Accepted completed quiz without a score';
  exception when check_violation then null; end;
  begin
    update public.mock_quizzes set answers='[0,1,0]', completed_at=created_at - interval '1 second', score=3 where id=saved.id;
    raise exception 'Accepted completion before start';
  exception when check_violation then null; end;
end $$;
set local role authenticated;
do $$
declare done public.mock_quizzes;
begin
  begin
    perform public.submit_mock_quiz(current_setting('test.timed_quiz')::uuid,'[0,1,2]');
    raise exception 'Accepted option outside question range';
  exception when others then if sqlerrm <> 'Answer every question before finishing.' then raise; end if; end;
  done := public.submit_mock_quiz(current_setting('test.timed_quiz')::uuid,'[0,1,0]');
  if done.score <> 3 or done.elapsed_seconds < 90 or done.elapsed_seconds > 95 then
    raise exception 'Timed attempt or variable-option grading failed';
  end if;
end $$;
reset role;
delete from public.files where id=current_setting('test.quiz_note')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.quiz_owner'), true);
do $$ begin
  if not exists(select 1 from public.mock_quizzes where id=current_setting('test.saved_quiz')::uuid and score=5) then
    raise exception 'Source deletion lost quiz history';
  end if;
end $$;
reset role;
select 'Quiz generation, submission, persistence, grading, timing, ownership, validation, and snapshots passed' as result;
rollback;

-- Run with the mock_quizzes migration installed. All fixtures roll back.
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
begin
  if has_table_privilege('authenticated','public.mock_quizzes','INSERT') or
    has_table_privilege('authenticated','public.mock_quizzes','UPDATE') or
    has_function_privilege('anon','public.create_mock_quiz(uuid[],integer)','EXECUTE') then
    raise exception 'Quiz mutation privileges are too broad';
  end if;
  saved := public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],5);
  perform set_config('test.saved_quiz',saved.id::text,true);
  if jsonb_array_length(saved.questions) <> 5 or saved.score is not null then raise exception 'Incorrect quiz state'; end if;
  for q in select value from jsonb_array_elements(saved.questions) loop
    if jsonb_array_length(q->'options') <> 4 or q->>'source_file_id' <> current_setting('test.quiz_note')
      or (select count(distinct value) from jsonb_array_elements(q->'options')) <> 4 then raise exception 'Invalid question or source'; end if;
  end loop;
  if (select count(distinct value->>'prompt') from jsonb_array_elements(saved.questions)) <> 5 then raise exception 'Questions repeat'; end if;
  begin
    perform public.submit_mock_quiz(saved.id,'[0]');
    raise exception 'Accepted incomplete answers';
  exception when others then if sqlerrm <> 'Answer every question before finishing.' then raise; end if; end;
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
  if done.score <> 5 or done.completed_at is null then raise exception 'Server grading failed'; end if;
  done := public.submit_mock_quiz(saved.id,'[0,0,0,0,0]');
  if done.score <> 5 or done.answers <> correct_answers then raise exception 'Completed score was replaced'; end if;
  saved := public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],3);
  select jsonb_agg(to_jsonb(((value->>'correct')::integer + 1) % 4)) into correct_answers from jsonb_array_elements(saved.questions);
  done := public.submit_mock_quiz(saved.id,correct_answers);
  if done.score <> 0 then raise exception 'Zero score grading failed'; end if;
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
    perform public.create_mock_quiz(array[current_setting('test.quiz_note')::uuid],3);
    raise exception 'Signed-out creation allowed';
  exception when others then if sqlerrm <> 'Sign in to create a quiz.' then raise; end if; end;
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
select 'Quiz generation, grading, ownership, validation, and snapshots passed' as result;
rollback;

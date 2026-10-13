-- Requires public.files.course_id and public.courses(id, user_id).
-- Changes only the course assigned to a file the caller owns.
begin;

create function public.assign_file_course(p_file_id uuid, p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to assign a course.';
  end if;

  if p_course_id is not null and not exists (
    select 1 from public.courses
    where courses.id = p_course_id and courses.user_id = (select auth.uid())
  ) then
    raise exception 'Course not found.';
  end if;

  update public.files
  set course_id = p_course_id
  where files.id = p_file_id and files.user_id = (select auth.uid())
  returning files.id into updated_id;

  if updated_id is null then
    raise exception 'File not found.';
  end if;
end;
$$;

revoke all on function public.assign_file_course(uuid, uuid) from public, anon;
grant execute on function public.assign_file_course(uuid, uuid) to authenticated;

commit;

-- Incremental post-audit changes. Historical migrations 001-029 remain unchanged.
-- All pages retain server-side role, assurance and application-assignment checks.
create function public.esports_assessment_page(
 p_offset integer default 0, p_query text default '',
 p_review_offset integer default 0, p_attempt uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.esports_is_admin() or private.esports_staff_access()) then
  raise exception 'Administrative role required';
 end if;
 if p_offset is null or p_review_offset is null or p_query is null or
    p_offset not between 0 and 100000 or p_review_offset not between 0 and 100000 or length(p_query)>120 then
  raise exception 'Invalid search';
 end if;
 if p_attempt is not null and not exists(select 1 from private.esports_attempts a
   where a.id=p_attempt and a.status<>'active' and public.esports_can_review(a.application_id)) then
  raise exception 'Attempt unavailable';
 end if;
 return jsonb_build_object('admin',public.esports_is_admin(),'page_size',50,
  'questions',case when public.esports_is_admin() then coalesce((select jsonb_agg(to_jsonb(q) order by q.category,q.prompt,q.id)
    from (select * from private.esports_questions
      where position(lower(p_query) in lower(prompt||' '||category))>0
      order by category,prompt,id limit 50 offset p_offset)q),'[]'::jsonb) else '[]'::jsonb end,
  'exams',case when public.esports_is_admin() then coalesce((select jsonb_agg(to_jsonb(e) order by e.title,e.id)
    from (select * from private.esports_exams order by title,id limit 50 offset p_offset)e),'[]'::jsonb) else '[]'::jsonb end,
  'assignments',coalesce((select jsonb_agg(to_jsonb(x) order by x.application_id,x.exam_id)
    from (select * from private.esports_exam_assignments where public.esports_can_review(application_id)
      order by application_id,exam_id limit 50 offset p_offset)x),'[]'::jsonb),
  'attempts',coalesce((select jsonb_agg(to_jsonb(a) order by a.started_at desc,a.id)
    from (select * from private.esports_attempts where status<>'active' and public.esports_can_review(application_id)
      order by started_at desc,id limit 50 offset p_offset)a),'[]'::jsonb),
  'review_history',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id)
    from (select r.* from private.esports_attempt_reviews r join private.esports_attempts a on a.id=r.attempt_id
      where r.attempt_id=p_attempt and a.status<>'active' and public.esports_can_review(a.application_id)
      order by r.created_at desc,r.id limit 50 offset p_review_offset)r),'[]'::jsonb));
end;$$;

-- Preserve the old zero-argument entry point as a bounded, genuinely read-only page.
create or replace function public.esports_assessment_admin() returns jsonb
 language sql stable security definer set search_path='' as $$
 select public.esports_assessment_page();
$$;

-- Expiration is explicit, bounded and audited through the existing finish helper.
create function public.esports_expire_assessments() returns integer
 language plpgsql security definer set search_path='' as $$
declare expired record; completed integer:=0; remaining integer;
begin
 if auth.uid() is null or not(public.esports_is_admin() or private.esports_staff_access()) then
  raise exception 'Administrative role required';
 end if;
 -- The shared quota serializes on the caller's profile row; require that row.
 perform 1 from public.profiles where id=auth.uid() for update;
 if not found then
  raise exception 'Profile required';
 end if;
 perform private.esports_write_limit();
 select greatest(0,120-count(*))::integer into remaining from private.esports_audit
  where actor_id=auth.uid() and created_at>now()-interval '1 minute';
 for expired in select id from private.esports_attempts where status='active' and deadline<=now()
   and public.esports_can_review(application_id) order by deadline,id limit least(25,remaining)
   for update skip locked loop
  perform private.esports_finish_attempt(expired.id);
  completed:=completed+1;
 end loop;
 return completed;
end;$$;

revoke all on function public.esports_assessment_page(integer,text,integer,uuid),public.esports_expire_assessments() from public,anon,authenticated;
grant execute on function public.esports_assessment_page(integer,text,integer,uuid),public.esports_expire_assessments() to authenticated;

create index esports_review_page on private.esports_attempt_reviews(attempt_id,created_at desc,id);
create index esports_attempt_page on private.esports_attempts(started_at desc,id) where status<>'active';
create index esports_question_page on private.esports_questions(category,prompt,id);

-- Lifecycle controls close shortcuts between human decision flows.
create function private.esports_write_limit() returns void language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if (select count(*) from private.esports_audit where actor_id=auth.uid() and created_at>now()-interval '1 minute')>=120 then raise exception 'Esports write rate limit';end if;
 end;$$;
create or replace function private.esports_role(p_role text,p_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from private.esports_role_grants r where user_id=p_user and role=p_role and starts_at<=now() and ends_at>now() and revoked_at is null and (role in('esports_staff','esports_admin') or private.esports_participation(application_id,p_user)))
$$;
alter function public.esports_admin_action(text,uuid,integer,jsonb) set schema private;
alter function private.esports_admin_action(text,uuid,integer,jsonb) rename to esports_admin_action_internal;
revoke all on function private.esports_admin_action_internal(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.esports_admin_action(p_action text,p_id uuid default null,p_expected integer default 0,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 declare result jsonb;
 begin
 perform private.esports_write_limit();
 if p_action='status' and (p_payload->>'status' in('development_offered','development_active','academy_selected') or exists(select 1 from private.esports_scholarships where application_id=p_id and status in('offered','accepted') and ends_at>now()) and p_payload->>'status'='trial_completed') then raise exception 'Use explicit scholarship or roster workflow';end if;
 result:=private.esports_admin_action_internal(p_action,p_id,p_expected,p_payload);
 if p_action='status' and p_payload->>'status'='not_selected' then
 update private.esports_role_grants set revoked_at=now() where application_id=p_id and revoked_at is null;
 update private.esports_benefit_grants set revoked_at=now() where scholarship_id in(select id from private.esports_scholarships where application_id=p_id);
 update private.esports_scholarships set status='revoked',version=version+1 where application_id=p_id and status in('offered','accepted');
 end if;
 if p_action='revoke_authorization' then
 update private.esports_role_grants r set revoked_at=now() from public.esports_applications a where r.application_id=a.id and a.cycle_id=p_id and a.user_id=(p_payload->>'user_id')::uuid and a.payload->>'age_band'='adolescent' and r.revoked_at is null;
 update private.esports_benefit_grants set revoked_at=now() where scholarship_id in(select s.id from private.esports_scholarships s join public.esports_applications a on a.id=s.application_id where a.cycle_id=p_id and a.user_id=(p_payload->>'user_id')::uuid and a.payload->>'age_band'='adolescent');
 end if;
 return result;
 end;$$;
-- Apply the same serialized write quota to the other mutating RPCs.
alter function public.esports_assessment_action(text,uuid,integer,jsonb) set schema private;
alter function private.esports_assessment_action(text,uuid,integer,jsonb) rename to esports_assessment_action_internal;
create function public.esports_assessment_action(p_action text,p_id uuid default null,p_expected integer default 0,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.esports_write_limit();return private.esports_assessment_action_internal(p_action,p_id,p_expected,p_payload);end;$$;
alter function public.esports_development_action(text,uuid,integer,jsonb) set schema private;
alter function private.esports_development_action(text,uuid,integer,jsonb) rename to esports_development_action_internal;
create function public.esports_development_action(p_action text,p_id uuid default null,p_expected integer default 0,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.esports_write_limit();return private.esports_development_action_internal(p_action,p_id,p_expected,p_payload);end;$$;
revoke all on function private.esports_write_limit(),private.esports_assessment_action_internal(text,uuid,integer,jsonb),private.esports_development_action_internal(text,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.esports_admin_action(text,uuid,integer,jsonb),public.esports_assessment_action(text,uuid,integer,jsonb),public.esports_development_action(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.esports_admin_action(text,uuid,integer,jsonb),public.esports_assessment_action(text,uuid,integer,jsonb),public.esports_development_action(text,uuid,integer,jsonb) to authenticated;

create or replace function public.esports_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return jsonb_build_object('admin',public.esports_is_admin(),'staff',private.esports_role('esports_staff'),
 'applications',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.esports_applications a where user_id=auth.uid()),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('id',id,'role',role,'application_id',application_id,'ends_at',ends_at)) from private.esports_role_grants where user_id=auth.uid() and revoked_at is null and starts_at<=now() and ends_at>now() and (application_id is null or private.esports_participation(application_id,user_id))),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.esports_status_events e join public.esports_applications a on a.id=e.application_id where a.user_id=auth.uid()),'[]'::jsonb),
 'trial_intro',case when private.esports_role('trialist') then (select trial_intro from public.esports_settings) else null end);
 end;$$;
-- Account deletion cascades also clear linked esports audit detail.
create function private.esports_application_delete_audit() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 delete from private.esports_audit where target_id=old.id or target_id in(select id from private.esports_attempts where application_id=old.id) or target_id in(select id from private.esports_scholarships where application_id=old.id) or target_id in(select id from private.esports_role_grants where application_id=old.id) or target_id in(select g.id from private.esports_development_goals g join private.esports_scholarships s on s.id=g.scholarship_id where s.application_id=old.id);
 return old;end;$$;
create trigger esports_application_delete_audit before delete on public.esports_applications for each row execute function private.esports_application_delete_audit();
create function private.esports_profile_delete_audit() returns trigger language plpgsql security definer set search_path='' as $$
 begin delete from private.esports_audit where actor_id=old.id or target_id=old.id or detail->>'user_id'=old.id::text;return old;end;$$;
create trigger esports_profile_delete_audit before delete on public.profiles for each row execute function private.esports_profile_delete_audit();
revoke all on function private.esports_application_delete_audit(),private.esports_profile_delete_audit() from public,anon,authenticated;

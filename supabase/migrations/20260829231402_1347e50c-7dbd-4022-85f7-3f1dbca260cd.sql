-- Platform-required grants: without these, the Data API rejects every query
-- even though the RLS policies from 0002 allow the rows through.
grant select on public.problems to authenticated;
grant all on public.problems to service_role;

grant select on public.rooms to authenticated;
grant all on public.rooms to service_role;

grant select on public.rounds to authenticated;
grant all on public.rounds to service_role;

grant select on public.submissions to authenticated;
grant all on public.submissions to service_role;

grant select, insert, update on public.solo_runs to authenticated;
grant all on public.solo_runs to service_role;

-- Close the mutable search_path linter warning on the two helper functions
-- from 0001. Behaviour is identical, only the resolution path is pinned.
alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.is_valid_case_list(jsonb) set search_path = public, pg_temp;
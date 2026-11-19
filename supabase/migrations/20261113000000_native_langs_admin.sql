-- Learners can speak several languages (primary first). native_lang stays the primary one.
alter table public.profiles add column if not exists native_langs text[] not null default '{}';
update public.profiles set native_langs = array[native_lang] where cardinality(native_langs) = 0;

-- Admin analytics: count learners only (admin accounts are not learners).
create or replace function public.admin_stats()
returns json
language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select json_build_object(
    'learners', (select count(*) from public.profiles where role = 'learner'),
    'active_7d', (select count(distinct a.user_id) from public.daily_activity a join public.profiles p on p.id = a.user_id and p.role = 'learner' where a.day >= current_date - 7),
    'lessons_completed', (select count(*) from public.user_lesson_progress),
    'xp_7d', (select coalesce(sum(amount), 0) from public.xp_transactions where created_at >= now() - interval '7 days'),
    'attempts_7d', (select count(*) from public.exercise_attempts where created_at >= now() - interval '7 days'),
    'accuracy_7d', (select round(100.0 * avg(case when correct then 1 else 0 end)) from public.exercise_attempts where created_at >= now() - interval '7 days'),
    'daily', (select coalesce(json_agg(d order by d.day), '[]'::json) from (
        select day, count(distinct user_id) as learners, sum(xp) as xp
        from public.daily_activity where day >= current_date - 13 group by day) d),
    'hardest', (select coalesce(json_agg(h), '[]'::json) from (
        select exercise_id, count(*) as attempts, round(100.0 * avg(case when correct then 1 else 0 end)) as accuracy
        from public.exercise_attempts where lesson_id <> 'review' group by exercise_id having count(*) >= 3
        order by accuracy asc limit 10) h)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_stats() from anon;

-- ════════════════════════════════════════════════════════════════
-- Lumrik – initial schema
-- Content tables (admin-managed) + learner progress tables (written by
-- the server after answer validation) + AI tutor history.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Helpers ─────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── Languages ───────────────────────────────────────────────────
create table public.languages (
  code          text primary key check (code ~ '^[a-z]{2,3}(-[A-Za-z0-9]+)?$'),
  name          text not null,
  native_name   text not null,
  flag          text not null default '🌐',
  glyph         text not null default 'Aa',
  script        text not null default 'Latin',
  speech_locale text not null,
  rtl           boolean not null default false,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Profiles (1:1 with auth.users) ──────────────────────────────
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text,
  display_name        text not null default 'Learner' check (char_length(display_name) between 1 and 40),
  native_lang         text not null default 'en' references public.languages (code),
  target_lang         text not null default 'en' references public.languages (code),
  proficiency         text not null default 'beginner' check (proficiency in ('beginner','elementary','intermediate','advanced')),
  goal                text not null default 'personal' check (goal in ('travel','education','career','communication','personal')),
  daily_minutes       int  not null default 10 check (daily_minutes between 5 and 120),
  daily_xp_goal       int  not null default 20 check (daily_xp_goal between 10 and 500),
  timezone            text not null default 'UTC',
  role                text not null default 'learner' check (role in ('learner','admin')),
  onboarded           boolean not null default false,
  placement_unit      int  not null default 1,
  show_on_leaderboard boolean not null default true,
  theme               text not null default 'system' check (theme in ('system','light','dark')),
  xp_total            int  not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Learners may edit their own profile, but never their role or XP total.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role or new.xp_total is distinct from old.xp_total
     or new.id is distinct from old.id then
    raise exception 'Not allowed to change protected profile fields';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1),
      'Learner'), 40)
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Course content ──────────────────────────────────────────────
create table public.courses (
  id          text primary key,
  target_lang text not null references public.languages (code),
  title       text not null,
  description text not null default '',
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index courses_target_lang_idx on public.courses (target_lang);
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();

create table public.units (
  id          text primary key,
  course_id   text not null references public.courses (id) on delete cascade,
  position    int  not null,
  title       text not null,
  description text not null default '',
  cefr        text not null default 'A1' check (cefr in ('A1','A2','B1','B2','C1','C2')),
  icon        text not null default '📘',
  published   boolean not null default false,
  unique (course_id, position)
);
create index units_course_idx on public.units (course_id, position);

create table public.lessons (
  id          text primary key,
  unit_id     text not null references public.units (id) on delete cascade,
  position    int  not null,
  title       text not null,
  description text not null default '',
  tip         text,
  xp_reward   int  not null default 15,
  published   boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (unit_id, position)
);
create index lessons_unit_idx on public.lessons (unit_id, position);
create trigger lessons_updated_at before update on public.lessons for each row execute function public.set_updated_at();

create table public.exercises (
  id          text primary key,
  lesson_id   text not null references public.lessons (id) on delete cascade,
  position    int  not null,
  type        text not null check (type in ('multiple_choice','match_pairs','fill_blank','listening','speaking','sentence_builder','translate')),
  instruction text not null,
  data        jsonb not null,
  explanation text not null default '',
  word_ids    text[] not null default '{}',
  check ((data ->> 'type') = type)
);
create index exercises_lesson_idx on public.exercises (lesson_id, position);

create table public.vocabulary (
  id             text primary key,
  course_id      text not null references public.courses (id) on delete cascade,
  lesson_id      text references public.lessons (id) on delete set null,
  term           text not null,
  meaning        text not null,
  pronunciation  text not null default '',
  part_of_speech text not null default '',
  example        text not null default '',
  related        text[] not null default '{}',
  emoji          text,
  audio_url      text,
  created_at     timestamptz not null default now()
);
create index vocabulary_course_idx on public.vocabulary (course_id);
create index vocabulary_lesson_idx on public.vocabulary (lesson_id);

-- Translations of vocabulary into learners' native languages (filled by admins / reviewers,
-- never auto-generated) – lets every course grow without inaccurate placeholder text.
create table public.vocabulary_translations (
  word_id     text not null references public.vocabulary (id) on delete cascade,
  lang        text not null references public.languages (code),
  translation text not null,
  primary key (word_id, lang)
);

create table public.achievements (
  id          text primary key,
  title       text not null,
  description text not null,
  icon        text not null,
  tier        text not null check (tier in ('bronze','silver','gold')),
  metric      text not null,
  target      int  not null
);

-- ── Learner progress (written only by the server / service role) ─
create table public.user_lesson_progress (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  lesson_id          text not null references public.lessons (id) on delete cascade,
  status             text not null default 'completed',
  best_score         int  not null check (best_score between 0 and 100),
  attempts           int  not null default 1,
  first_completed_at timestamptz not null default now(),
  last_completed_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.exercise_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null, -- no FK: review exercises are generated from vocabulary
  lesson_id   text not null,
  type        text not null,
  correct     boolean not null,
  answer      text not null default '',
  created_at  timestamptz not null default now()
);
create index exercise_attempts_user_idx on public.exercise_attempts (user_id, created_at desc);
create index exercise_attempts_exercise_idx on public.exercise_attempts (exercise_id);

create table public.user_vocabulary (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  word_id       text not null references public.vocabulary (id) on delete cascade,
  saved         boolean not null default false,
  learned       boolean not null default false,
  ease          numeric(4,2) not null default 2.5,
  interval_days int not null default 0,
  reps          int not null default 0,
  lapses        int not null default 0,
  due           timestamptz not null default now(),
  last_reviewed timestamptz,
  correct       int not null default 0,
  incorrect     int not null default 0,
  primary key (user_id, word_id)
);
create index user_vocabulary_due_idx on public.user_vocabulary (user_id, due);

create table public.vocabulary_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  word_id     text not null references public.vocabulary (id) on delete cascade,
  grade       text not null check (grade in ('again','hard','good','easy')),
  interval_days int not null,
  reviewed_at timestamptz not null default now()
);
create index vocabulary_reviews_user_idx on public.vocabulary_reviews (user_id, reviewed_at desc);

-- One row per learner per local calendar day (learner's timezone) → streaks & weekly charts.
create table public.daily_activity (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  day              date not null,
  xp               int not null default 0,
  lessons          int not null default 0,
  reviews          int not null default 0,
  speaking         int not null default 0,
  tutor_messages   int not null default 0,
  writing          int not null default 0,
  missions_claimed boolean not null default false,
  primary key (user_id, day)
);
create index daily_activity_day_idx on public.daily_activity (day);

create table public.xp_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     int not null check (amount between 0 and 500),
  reason     text not null check (reason in ('lesson','lesson_repeat','perfect_bonus','review','speaking','tutor','writing','missions','placement')),
  ref_id     text,
  day        date not null,
  created_at timestamptz not null default now()
);
create index xp_transactions_user_idx on public.xp_transactions (user_id, created_at desc);

-- Keep profiles.xp_total in sync with the XP ledger.
create or replace function public.apply_xp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set xp_total = xp_total + new.amount where id = new.user_id;
  return new;
end $$;
create trigger xp_transactions_apply after insert on public.xp_transactions
  for each row execute function public.apply_xp();

create table public.user_achievements (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ── AI tutor history ────────────────────────────────────────────
create table public.tutor_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  scenario    text not null,
  target_lang text not null,
  level       text not null,
  title       text not null default 'Conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tutor_conversations_user_idx on public.tutor_conversations (user_id, updated_at desc);

create table public.tutor_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tutor_conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null check (char_length(content) <= 8000),
  created_at      timestamptz not null default now()
);
create index tutor_messages_conv_idx on public.tutor_messages (conversation_id, created_at);

-- ════════════════════════════════════════════════════════════════
-- Row-level security
-- ════════════════════════════════════════════════════════════════
alter table public.languages               enable row level security;
alter table public.profiles                enable row level security;
alter table public.courses                 enable row level security;
alter table public.units                   enable row level security;
alter table public.lessons                 enable row level security;
alter table public.exercises               enable row level security;
alter table public.vocabulary              enable row level security;
alter table public.vocabulary_translations enable row level security;
alter table public.achievements            enable row level security;
alter table public.user_lesson_progress    enable row level security;
alter table public.exercise_attempts       enable row level security;
alter table public.user_vocabulary         enable row level security;
alter table public.vocabulary_reviews      enable row level security;
alter table public.daily_activity          enable row level security;
alter table public.xp_transactions         enable row level security;
alter table public.user_achievements       enable row level security;
alter table public.tutor_conversations     enable row level security;
alter table public.tutor_messages          enable row level security;

-- Content: anyone can read published content; admins can read & write everything.
create policy "languages readable" on public.languages for select using (enabled or public.is_admin());
create policy "languages admin write" on public.languages for all using (public.is_admin()) with check (public.is_admin());

create policy "courses readable" on public.courses for select using (published or public.is_admin());
create policy "courses admin write" on public.courses for all using (public.is_admin()) with check (public.is_admin());

create policy "units readable" on public.units for select using (published or public.is_admin());
create policy "units admin write" on public.units for all using (public.is_admin()) with check (public.is_admin());

create policy "lessons readable" on public.lessons for select using (published or public.is_admin());
create policy "lessons admin write" on public.lessons for all using (public.is_admin()) with check (public.is_admin());

create policy "exercises readable" on public.exercises for select
  using (public.is_admin() or exists (select 1 from public.lessons l where l.id = lesson_id and l.published));
create policy "exercises admin write" on public.exercises for all using (public.is_admin()) with check (public.is_admin());

create policy "vocabulary readable" on public.vocabulary for select
  using (public.is_admin() or exists (select 1 from public.courses c where c.id = course_id and c.published));
create policy "vocabulary admin write" on public.vocabulary for all using (public.is_admin()) with check (public.is_admin());

create policy "translations readable" on public.vocabulary_translations for select using (true);
create policy "translations admin write" on public.vocabulary_translations for all using (public.is_admin()) with check (public.is_admin());

create policy "achievements readable" on public.achievements for select using (true);
create policy "achievements admin write" on public.achievements for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: own row (admins: all). Column protection is enforced by trigger.
create policy "profiles select own" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Progress: learners can READ their own rows. All writes go through the server
-- (service role) after answers are validated, so XP cannot be forged from the browser.
create policy "progress select own" on public.user_lesson_progress for select using (user_id = auth.uid() or public.is_admin());
create policy "attempts select own" on public.exercise_attempts for select using (user_id = auth.uid() or public.is_admin());
create policy "user vocab select own" on public.user_vocabulary for select using (user_id = auth.uid() or public.is_admin());
create policy "reviews select own" on public.vocabulary_reviews for select using (user_id = auth.uid() or public.is_admin());
create policy "activity select own" on public.daily_activity for select using (user_id = auth.uid() or public.is_admin());
create policy "xp select own" on public.xp_transactions for select using (user_id = auth.uid() or public.is_admin());
create policy "user achievements select own" on public.user_achievements for select using (user_id = auth.uid() or public.is_admin());

-- Tutor history: fully owned by the learner.
create policy "conversations own" on public.tutor_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages own" on public.tutor_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- RPCs
-- ════════════════════════════════════════════════════════════════

-- Weekly leaderboard: only display names + XP of learners who opted in.
create or replace function public.get_leaderboard(p_since date, p_limit int default 50)
returns table (user_id uuid, display_name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, coalesce(sum(a.xp), 0)::bigint as xp, p.id = auth.uid()
  from public.profiles p
  join public.daily_activity a on a.user_id = p.id and a.day >= p_since
  where p.show_on_leaderboard or p.id = auth.uid()
  group by p.id, p.display_name
  having coalesce(sum(a.xp), 0) > 0
  order by xp desc, p.display_name
  limit least(p_limit, 100);
$$;
revoke all on function public.get_leaderboard(date, int) from anon;

-- Admin analytics (raises for non-admins).
create or replace function public.admin_stats()
returns json
language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select json_build_object(
    'learners', (select count(*) from public.profiles),
    'active_7d', (select count(distinct user_id) from public.daily_activity where day >= current_date - 7),
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

-- ════════════════════════════════════════════════════════════════
-- Storage: public audio bucket, admin-only uploads
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

create policy "audio public read" on storage.objects for select using (bucket_id = 'audio');
create policy "audio admin insert" on storage.objects for insert with check (bucket_id = 'audio' and public.is_admin());
create policy "audio admin update" on storage.objects for update using (bucket_id = 'audio' and public.is_admin());
create policy "audio admin delete" on storage.objects for delete using (bucket_id = 'audio' and public.is_admin());

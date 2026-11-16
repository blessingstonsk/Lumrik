-- Learners can speak several languages (primary first). native_lang stays the primary one.
alter table public.profiles add column if not exists native_langs text[] not null default '{}';
update public.profiles set native_langs = array[native_lang] where cardinality(native_langs) = 0;

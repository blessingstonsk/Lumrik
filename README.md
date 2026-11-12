# Lumrik – Learn Languages Smarter

An AI-powered language-learning web app: interactive lessons, spaced-repetition flashcards, speaking practice, an AI conversation tutor, gamification and an admin CMS.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · Lucide · Recharts · Supabase (Auth + Postgres + Storage) · Anthropic Claude API · Web Speech API**.

---

## What's in the MVP

| Area | Status |
| --- | --- |
| Email/password sign-up & login, Google OAuth, password reset, persistent sessions | ✅ (Google/reset need Supabase) |
| 5-step onboarding (native language, target language, level, goal, daily minutes) + optional placement test | ✅ |
| 11 languages with native names & script glyphs; Unicode fonts for Tamil, Devanagari, Malayalam, Telugu, Kannada, Japanese, Korean | ✅ |
| **English for Beginners** course: 6 units, **24 hand-authored lessons, 170 exercises, 123 vocabulary words** (CEFR A1–A2) | ✅ |
| 7 exercise types: multiple choice, word matching, fill-in-the-blank, listening, speaking, sentence builder, translation | ✅ |
| Answer validation (typo tolerance, contractions), instant feedback + explanations, missed questions re-queued, completion summary | ✅ |
| XP, timezone-aware daily streaks, levels, daily missions + bonus, weekly challenge, 19 achievements, milestones, leaderboard, unlockable lessons, celebrations | ✅ |
| Dashboard: daily goal ring, streak, XP, level, proficiency, lessons, words, weekly chart, achievements, recommended next lesson | ✅ |
| Flashcards with SM-2 spaced repetition; vocabulary notebook (IPA, audio, example, POS, related words, review status, bookmarks) | ✅ |
| Rule-based adaptive engine: mistake tracking, weak words, review lessons, revision recommendations, daily plan – every recommendation explains *why* | ✅ |
| AI tutor (streaming): 8 scenarios, 3 difficulty levels, corrections explained in the native language, alternative phrasings, dictation, TTS; AI writing feedback | ✅ (needs `ANTHROPIC_API_KEY`) |
| Speaking practice: mic recording + playback, sentence repetition, word drills, transcription-based word-level feedback (no fake accent scores) | ✅ (Chrome/Edge/Safari) |
| Progress analytics, profile & settings (theme, timezone, goal, leaderboard privacy, password) | ✅ |
| Admin dashboard: courses/units/lessons CRUD + publish/unpublish, JSON exercise editor with schema validation, vocabulary + audio upload, languages, learner analytics, user roles | ✅ |
| Light/dark mode, responsive (phone/tablet/desktop), keyboard navigation, reduced-motion, PWA manifest + service worker | ✅ |

Other languages' courses are **added through the admin CMS / database** rather than shipped as machine-generated placeholder translations. Until a course is published for a language, learners can still use the AI tutor and speaking practice in it.

---

## Two run modes

| | **Local mode** (no config) | **Supabase mode** (production) |
| --- | --- | --- |
| Enabled when | Supabase env vars are empty | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set |
| Accounts | Stored in this browser (PBKDF2-hashed passwords) | Supabase Auth (email, Google, reset emails) |
| Progress | `localStorage` | Postgres, written by the server after re-validating answers |
| Content edits (admin) | Saved in this browser | Postgres with RLS |
| Admin | First account created on the device | `profiles.role = 'admin'` |

Local mode is meant for evaluation and demos; deploy with Supabase for real users.

---

## Quick start

Requirements: **Node.js 20+** and npm.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open http://localhost:3000 and create an account. Without any env vars the app runs in local mode. Add `ANTHROPIC_API_KEY` to `.env.local` to enable the AI tutor.

Other scripts:

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

---

## Environment variables

See [.env.example](.env.example).

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | public | Base URL used for auth redirects |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (safe in the browser; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Lets API routes write XP/progress after validation. Never expose it. |
| `ANTHROPIC_API_KEY` | **server only** | AI tutor + writing feedback |
| `ANTHROPIC_MODEL` | server, optional | Model override (default `claude-opus-5-5`) |

API keys are only read in server code (`src/lib/server/*`, `src/app/api/*`); nothing secret is prefixed with `NEXT_PUBLIC_`.

---

## Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Run the migration** – either paste [supabase/migrations/20261112000000_init.sql](supabase/migrations/20261112000000_init.sql) into the SQL editor, or with the Supabase CLI:
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   ```bash
   npx supabase db push
   ```
3. **Seed content** – run [supabase/seed.sql](supabase/seed.sql) in the SQL editor (languages, achievements, the English course, vocabulary). It is idempotent (upserts). Regenerate it after editing the TypeScript content sources:
   ```bash
   npm run seed:generate
   ```
4. **Auth settings** (Authentication → URL configuration): set *Site URL* to your app URL and add `https://YOUR_DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback`) to *Redirect URLs*.
5. **Google sign-in** (optional): Authentication → Providers → Google. Create an OAuth client in Google Cloud Console with the redirect URI Supabase shows you, then paste the client ID/secret.
6. Copy the URL, anon key and service-role key into `.env.local`.
7. **Make yourself an admin** after signing up (SQL editor):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

### Data model

`languages`, `profiles`, `courses`, `units`, `lessons`, `exercises`, `vocabulary`, `vocabulary_translations`, `achievements`, `user_lesson_progress`, `exercise_attempts`, `user_vocabulary`, `vocabulary_reviews`, `daily_activity` (streaks, per local day), `xp_transactions` (XP ledger; a trigger keeps `profiles.xp_total` in sync), `user_achievements`, `tutor_conversations`, `tutor_messages`.

Security:
- **RLS on every table.** Published content is readable by everyone; only admins (`is_admin()`) can write content.
- Learners can **read** their own progress rows but **cannot write** them – progress, XP and streaks are written only by `/api/learner` with the service role, after the server reloads the learner's state and **re-validates every answer against database content**.
- A trigger prevents learners from changing their own `role` or `xp_total`.
- Leaderboard data is exposed only through the `get_leaderboard` RPC (display name + XP of learners who opted in).
- Audio uploads go to a public-read `audio` bucket; only admins can upload.

---

## Architecture

```
src/
  app/                      Next.js routes
    (auth)/                 login, register, forgot/reset password
    (app)/                  authenticated pages with the app shell
    lesson/[lessonId]       full-screen lesson player (and /lesson/review)
    onboarding, placement   full-screen flows
    api/learner             validated progress writes (Supabase mode)
    api/tutor, api/writing  Claude API (streaming chat, structured feedback)
  content/                  authored course content (TypeScript DSL) + placement test
  lib/
    engine.ts               pure learning engine: lesson completion, XP, SRS, missions → `Writes`
    actions.ts              action executor shared by browser (local) and server (Supabase)
    validation.ts           answer checking + transcription scoring
    gamification.ts         XP rules, streaks, levels, achievements, missions
    adaptive.ts             unlocking, recommendations, daily plan, review lessons
    srs.ts                  SM-2 spaced repetition
    data/                   repositories (local vs Supabase) for content, learner state, tutor history
    supabase/               browser/server clients + row mappers
  components/               UI kit, app shell, lesson player & exercises, charts
supabase/                   migration + generated seed
scripts/generate-seed.ts    TS content → seed.sql
```

The **same engine code** runs in both modes: in local mode the browser applies the engine's `Writes` to `localStorage`; in Supabase mode the API route runs it on trusted state and persists the `Writes` to Postgres, then returns them so the client updates identically.

### Adding a language course

1. Admin → *Languages*: make sure the language exists and is enabled.
2. Admin → *Courses & lessons* → **New course** (draft) → add units → add lessons and edit exercises (JSON, validated on save) → add vocabulary and upload native-speaker audio.
3. Have a fluent speaker review, then **Publish** the course, units and lessons.

Alternatively author it in TypeScript under `src/content/` (see `src/content/english/`), register it in `src/content/index.ts`, and run `npm run seed:generate`.

### Personalisation rules (transparent, rule-based)

- Missed exercises are re-queued once at the end of the lesson.
- Each mistake lowers that word's ease and makes its flashcard due immediately.
- Words missed 2+ times (or ≥40% of attempts) are *weak*; ≥5 weak words → a personal review is recommended first.
- ≥15 due words → review recommended before new lessons; lessons with best score < 60% are suggested for retry.
- Daily plans are sized to the learner's minutes-per-day goal.

### XP rules

| Activity | XP |
| --- | --- |
| Lesson (first completion) | 5 + 2 per correct first-try answer, +5 for a perfect lesson |
| Lesson repeat | half of the above |
| Review lesson | 2 per correct answer |
| Flashcard review | 1 (max 30/day) |
| Speaking drill | 2 (max 20 XP/day) |
| Tutor message | 1 (max 15/day) |
| Writing feedback | 5 (max 20 XP/day) |
| All daily missions | +15 bonus (once per day) |

Streaks are computed from `daily_activity` rows keyed by the learner's **local date in their chosen timezone**.

### Speech

- Text-to-speech uses the browser's `speechSynthesis` (or uploaded audio files when present).
- Speech recognition uses `SpeechRecognition` (Chrome, Edge, Safari). Firefox lacks it – the UI explains this and lets learners skip speaking exercises without penalty.
- Speaking feedback is **transcription-based** (which words the recogniser understood), clearly labelled; it does not claim to measure accent or phonemes.

---

## Deployment (Vercel)

1. Push the repository to GitHub and import it in Vercel.
2. Add the environment variables above (Production + Preview). Mark the service-role and Anthropic keys as server-only (never `NEXT_PUBLIC_`).
3. Set `NEXT_PUBLIC_SITE_URL` to the production URL and add `/auth/callback` on that domain to Supabase redirect URLs.
4. Deploy. The app is a standard Next.js build (`npm run build` / `npm start`), so any Node host works.

Production notes:
- The AI routes use a simple in-memory rate limiter; on multi-instance hosting, swap it for a shared store (e.g. Upstash Redis) in `src/lib/server/ai.ts`.
- Progress writes are not wrapped in a single database transaction; for very high traffic, move `persistWrites` into a Postgres function.

---

## Accessibility

Skip link, semantic landmarks, labelled controls, `aria-live` feedback, visible focus rings, keyboard shortcuts (Enter to check/continue, 1–4 to pick answers, Space to flip flashcards), screen-reader data tables behind every chart, reduced-motion support, and colour never used as the only signal.

# StudyGo

StudyGo is a student-focused study planning app built with Next.js.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to sign in.
The student workspace is at [http://localhost:3000/home](http://localhost:3000/home).
The study workspace is at [http://localhost:3000/study-materials](http://localhost:3000/study-materials).

## Quizzes from your notes

At `/mock-quiz`, select processed notes individually or filter by course and use
**Select all in view**. Selections can span courses. Create a three- or five-question
multiple-choice quiz from the selected notes' extracted key terms. Questions ask
you to match a definition to its term; no additional AI request is needed.

Select up to 50 notes, with at least four distinct terms and definitions (five for
a five-question quiz). Process notes in Study materials first. Duplicate terms or
definitions are removed so answer choices remain distinct.

Quizzes and completed results are stored in Supabase. Recent quizzes can be
resumed or reviewed, and `/quiz-results` shows completed results. Unsubmitted
answers stay in browser component state and reset after navigation or refresh.
Question snapshots preserve results when the original notes are changed or deleted.
Practice again creates a fresh quiz from the same source notes; a completed score
cannot be overwritten.

Apply the migrations to your Supabase project before using quizzes:

```bash
supabase db push --linked
```

`20261023010000_mock_quizzes.sql` adds the `mock_quizzes` table, owner-only reads,
and authenticated creation/submission functions. The database checks source-note
ownership and processing status, generates questions, validates answers, and
calculates scores. Browser clients cannot insert or update quiz rows directly.
No service-role key is needed in the app.

Validation:

```bash
cd studygo
npm run lint
npx tsc --noEmit
npm run build -- --webpack
cd ..
supabase db query --linked --file supabase/tests/mock_quizzes.sql
```

The SQL regression suite uses temporary fixtures inside a rolled-back transaction
and covers generation, duplicate terms, invalid inputs, grading, repeated submission,
user isolation, and history after source deletion. For a browser check, select notes
across two courses, finish a quiz, refresh, and review it in Quiz results. Verify
unprocessed notes are disabled and an insufficient-term selection produces an error.

When only WASM Next.js bindings are installed, preview with
`npm run dev -- --webpack`; Turbopack requires native bindings.

## Configure Google sign-in

1. Copy `.env.example` to `.env.local` and add your Supabase project URL and
   publishable key.
2. Enable Google under **Authentication → Providers** in your Supabase project
   and configure its Google OAuth client credentials.
3. Add `http://localhost:3000/auth/callback` to the Supabase project's
   **Authentication → URL Configuration → Redirect URLs**.
4. Add the deployed site's callback URL to the same redirect allow list when
   deploying.

The Google OAuth callback exchanges the authorization code for a session and
returns signed-in users to `/home`. The workspace, study-materials, mock-quiz, and quiz-results routes
require a valid Supabase session when Supabase is configured.

The study-materials page previews file selection in the browser; files are not
uploaded or persisted until storage is configured.

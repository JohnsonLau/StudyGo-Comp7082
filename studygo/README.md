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
returns signed-in users to `/home`. The workspace and study-materials routes
require a valid Supabase session when Supabase is configured.

The study-materials page previews file selection in the browser; files are not
uploaded or persisted until storage is configured.

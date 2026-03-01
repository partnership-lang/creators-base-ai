# Creators Base AI

Production-ready web app for shared creator database with Supabase Auth + DB + Storage and Google Gemini AI analysis.

## Features
- Web access via URL
- Auth: Google OAuth + Email magic link
- Shared workspace (you + friends)
- Creator CRUD with required fields
- Filters, sorting, search by name
- AI Analyze button:
  - photo -> gender/age range/race
  - free text -> instagram/email/contact/country/language/niches/budget/source + summary comment
  - strict JSON parsing

## Stack
- Next.js 14 (App Router)
- Supabase (Postgres, Auth, Storage, RLS)
- Gemini API (REST)
- Deploy: Vercel

## 1) Supabase setup
1. Create Supabase project.
2. In SQL Editor run: `supabase/schema.sql`.
3. Create storage bucket `creator-photos`.
4. Add storage policies (SQL):

```sql
alter table storage.objects enable row level security;

create policy "Read creator photos"
on storage.objects for select
to authenticated
using (bucket_id = 'creator-photos');

create policy "Upload creator photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'creator-photos');
```

5. In Auth -> Providers enable Google.
6. In Auth -> URL Configuration add:
- Site URL: `http://localhost:3000` (local) and your Vercel domain
- Redirect URLs: `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`

## 2) Environment
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Set values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

## 3) Run locally
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 4) Deploy (Vercel)
1. Push repo to GitHub.
2. Import project in Vercel.
3. Add env vars from `.env.local`.
4. Deploy.

After deploy app is available by URL and ready for team use.

## Notes
- Shared workspace is created automatically on first login.
- Owner can add friends by email in the app (`Add user`).
- Invited user gets access right after first login.
- Current schema supports 1000+ creators with indexes on workspace + date and name.

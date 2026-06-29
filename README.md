# KDP Builder

KDP Builder is a private Manali Corporate web app for preparing Amazon KDP booklet projects.

Task 01 bootstraps the app shell only:

- private Next.js app structure;
- mobile-first operational layout;
- base routes for books and settings;
- Supabase auth/config placeholders;
- initial Supabase migration for `kdp_books`, `kdp_book_settings`, `kdp_sections`, and `kdp_exports`.

Out of scope for Task 01:

- PDF export;
- OpenAI integration;
- Amazon/KDP API;
- browser automation;
- cover generation.

## Local Setup

Install dependencies after approval:

```bash
npm install
```

Create a local env file from the example and fill it with the dedicated KDP Builder Supabase project values:

```bash
cp .env.example .env.local
```

Run the app:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Supabase

The initial migration is prepared at:

```text
supabase/migrations/20260629000000_initial_schema.sql
```

Apply it manually to the dedicated KDP Builder Supabase project when ready. Do not reuse Supabase projects, storage, env values, or data from other Manali projects.

## Routes

Task 01 prepares these routes:

```text
/
/login
/libri
/libri/nuovo
/libri/[id]
/impostazioni
```

The app is private by default. When Supabase env values are missing, protected routes redirect to `/login` and show a setup notice.

# MMS1

Madrasah management system for administrators, teachers, and parents. Built
with Next.js 15, React, TypeScript, Tailwind CSS, Firebase Authentication, and
Firebase Realtime Database.

## Features

- **Administration:** manage users, students, teachers, classes, attendance,
  exams, fees, and parent leave notices.
- **Teacher workspace:** manage assigned classes, record attendance and exam
  results, and write daily Mutaba'ah lessons with evaluation, adab tags,
  homework, and optional voice notes.
- **Parent portal:** switch between linked siblings, review attendance,
  learning progress, exam results, fees, and lesson notes; acknowledge lessons,
  reply by text or voice note, and submit leave notices.
- **Access control:** role-based routes and Firebase Realtime Database rules
  scope parent access to linked students.

## Requirements

- Node.js 20 LTS or later
- A Firebase project with Email/Password Authentication and Realtime Database

## Local development

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set the Firebase web app values:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Required variables:

   ```text
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=
   ```

3. In Firebase Console, enable Email/Password sign-in and publish
   [`database.rules.json`](./database.rules.json) to Realtime Database Rules.
4. To provision the initial administrator, set `SEED_ADMIN_EMAIL` and
   `SEED_ADMIN_PASSWORD` in `.env.local`, then run:

   ```powershell
   npm run seed:admin
   ```

5. Start the development server:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`.

There is no public registration. Administrators create teacher and parent
accounts from the application. To link siblings to a parent, enter the same
parent email on each student's record before creating the parent account.

## Production deployment

The project can be imported from GitHub into Vercel. Configure the seven
`NEXT_PUBLIC_FIREBASE_*` variables above in the Vercel project settings.
`FIREBASE_SERVICE_ACCOUNT` should contain the Firebase service-account JSON for
the scheduled attendance reminder; keep it private. Set `CRON_SECRET` to a
strong random value to protect the scheduled endpoint. Never commit `.env.local`
or service-account credentials.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build locally |
| `npm run seed:admin` | Create/update the configured initial administrator |
| `npm run backup:db` | Explicitly export a local database backup |
| `npm run build:backedup` | Back up the database, then build |

Database backups are opt-in and stored under the ignored `backups/` directory.
See [`docs/README.md`](./docs/README.md) for supporting documentation and the
project directory layout.

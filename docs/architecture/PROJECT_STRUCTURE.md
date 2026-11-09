# Project structure

```text
.
├── docs/
│   ├── archive/       # Historical setup and maintenance notes
│   ├── architecture/  # Current architecture and directory guides
│   └── setup/         # Firebase and local setup references
├── public/            # Static assets, icons, and service worker
├── scripts/           # Admin setup, backups, exports, and migrations
└── src/
    ├── app/           # Next.js routes and API handlers
    ├── components/    # Shared UI and navigation
    ├── context/       # Authentication and application context
    ├── hooks/         # Reusable React hooks
    ├── lib/           # Firebase, database, and domain helpers
    └── types/         # Shared TypeScript types
```

The Next.js App Router lives under `src/app`. Role-specific pages are grouped
by route (`admin`, `teacher`, and `parent`); shared Firebase data access belongs
in `src/lib/database`, and shared UI belongs in `src/components`.

# Website — Next.js

This folder is scaffolded by the developer agent on first run:

```bash
npx create-next-app@latest website --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"
```

The agent template repo intentionally does NOT include a generated Next.js project — that gets created at bootstrap. Once scaffolded, the structure looks like:

```
website/
├── pages/             ← Pages Router OR src/app/ for App Router
│   ├── index.jsx
│   ├── about.jsx
│   ├── api/
│   └── blog/
│       ├── index.jsx
│       └── posts/<slug>.jsx
├── components/
├── lib/
│   └── supabase.js
├── styles/
├── public/images/
└── supabase/
    ├── *.sql
    └── functions/
```

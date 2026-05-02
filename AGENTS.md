# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js 16 App Router project with Prisma and Vitest. App routes and pages live in `src/app`, including API handlers under `src/app/api`. Business logic stays in `src/services/*`, shared utilities and validators live in `src/lib/*`, and interactive UI components live in `src/features/*`. Prisma schema and migrations are in `prisma/`. Product and API reference docs are in `docs/`.

Tests are colocated with the code they cover, using `*.test.ts` files such as `src/services/scheduler/scheduler.service.test.ts`. Shared test helpers are in `src/test/`.

## Build, Test, and Development Commands
- `npm run dev`: start the local Next.js dev server.
- `npm test`: run the full Vitest suite.
- `npm run build`: run the production build and type checks.
- `npx prisma validate`: validate the Prisma schema before merge.
- `npm run prisma:generate`: regenerate Prisma client after schema changes.
- `npm run prisma:migrate`: create and apply a local Prisma migration during development.

Before merging, run:
```bash
npm test
npm run build
npx prisma validate
```

## Coding Style & Naming Conventions
Use TypeScript throughout. Match the existing style: semicolons omitted, double quotes for strings, and 2-space indentation in TS/TSX. Prefer small service functions with explicit return types for API-facing logic. Keep route handlers thin and move business rules into `src/services`.

Use `kebab-case` for filenames, `PascalCase` for React components, and `camelCase` for functions and variables. Keep client-only API wrappers under `src/lib/client-api/*`. Use `zod` validators in `src/lib/validators/*` for request validation.

## Testing Guidelines
Vitest is the test framework. Add focused service and utility tests near the code you change. Name tests `*.test.ts` and describe behavior clearly, for example `it("expires stale prior-day ACTIVE suggestions")`.

Prefer deterministic unit and service tests over browser or end-to-end coverage. If a change affects scheduling, suggestion transitions, routines, or Prisma URL handling, add or update tests in the corresponding service or utility module.

## Commit & Pull Request Guidelines
Follow the current commit style: short imperative messages like `Fix stale suggestion reconciliation` or `Normalize Supabase pooler connections`.

Create a new branch only for a new phase or feature. Keep bug fixes and review fixes on that same branch. After opening a PR, review CodeRabbit comments and fix high-confidence correctness or contract issues. PRs should include a concise summary, validation steps, and screenshots only when UI behavior changed.

## Security & Configuration Tips
Do not commit real secrets. Local env values belong in `.env.local` or Vercel project settings. `DATABASE_URL` is runtime-critical; Supabase pooler behavior is normalized in `src/lib/db.ts` and `src/lib/supabase-database-url.ts`, so verify those paths when debugging deployment connection issues.

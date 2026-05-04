# MarkQuiz — AI Coding Agent Instructions

## Architecture Overview

**Monorepo** (pnpm workspaces + Turborepo) with three sub-applications:

| Package | Path | Stack | Purpose |
|---|---|---|---|
| `@markquiz/builder` | `apps/builder/` | Next.js 15 + Tailwind + Zustand | SaaS dashboard & quiz editor |
| `@markquiz/widget` | `apps/widget/` | Svelte 5 + Vite (IIFE bundle) | Embeddable quiz player |
| `@markquiz/shared` | `packages/shared/` | TypeScript only | Domain types shared between apps |

**Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions on Deno)

## Critical Commands

```bash
# Install all dependencies
pnpm install

# Start all apps in dev mode
pnpm dev

# Start only builder
pnpm --filter @markquiz/builder dev

# Build widget (output: apps/widget/dist/widget.iife.js)
pnpm --filter @markquiz/widget build

# Apply DB migrations + reset with seed data
supabase db reset

# Regenerate TypeScript types from Supabase schema
pnpm db:types

# Deploy a single Edge Function
supabase functions deploy widget-quiz
```

## Database Schema (key tables)

```
quizzes      → questions (position-ordered) → options
                    ↓
              logic_rules (source_question_id + option_id → target_question_id)

quiz_sessions → answers (option_ids[] | text_value)
             → leads (name, email, phone, custom_fields JSONB)
```

- **QuizPayload** (`packages/shared/src/types/quiz.ts`) is the single object the widget loads — quiz + questions + options + logic in one round-trip.
- `logic_rules.target_question_id = null` means "end quiz / show result".
- All tables have RLS. Widget writes go through Edge Functions using `service_role` key.

## Builder App Conventions

- **Server Components** fetch data; **Client Components** manage UI state via Zustand.
- Supabase client: use `createClient()` from `@/lib/supabase/server` in Server Components, from `@/lib/supabase/client` in Client Components. Never mix.
- Route groups: `(auth)` for login/register, `(dashboard)` for protected pages.
- The quiz editor state lives entirely in `src/store/editorStore.ts` (Zustand + Immer). Auto-saves with 1.5s debounce on `isDirty`.
- `selectedQuestionId` is the single source of truth for the right panel.

## Widget Conventions

- Built as a single IIFE file (`widget.iife.js`) — no external dependencies at runtime.
- Mounted into **Shadow DOM** for CSS isolation: `host.attachShadow({ mode: 'open' })`.
- All styles are co-located in `<style>` blocks inside `.svelte` files — they get inlined into the JS bundle by Vite.
- Uses Svelte 5 runes (`$state`, `$derived`, `$props`) — not the old Options API.
- Logic branching engine: `apps/widget/src/logic/engine.ts`. Uses a `Map<"qId:optId", LogicRule>` for O(1) lookups. Wildcard rules use key `"qId:*"`.
- API calls go to `/api/widget/*` which proxies to Supabase Edge Functions.

## Edge Functions (Deno)

Located in `supabase/functions/`. Each function is a directory with `index.ts`.
- Import map is in `supabase/functions/deno.json` — use it for `@supabase/supabase-js` and `openai`.
- `widget-quiz`: Public (no auth). Returns full `QuizPayload`. CDN-cached 60s.
- `widget-session`: Creates session, hashes IP for GDPR compliance.
- `ai-generate`: Requires Supabase JWT. Calls `gpt-4o-mini` with `response_format: json_object`.
- `webhook-deliver`: Triggered by DB webhook on `leads` INSERT. Handles `webhook` and `telegram_bot` types.
- **Never** use `SUPABASE_SERVICE_ROLE_KEY` in client-side code or widget bundle.

## Adding a New Question Type

1. Add the type to `QuestionType` union in `packages/shared/src/types/quiz.ts`.
2. Add settings interface if needed (e.g., `SliderSettings`).
3. Add rendering in `apps/widget/src/components/QuestionStep.svelte`.
4. Add settings panel in `apps/builder/src/components/editor/QuizEditor.tsx`.
5. Update DB `CHECK` constraint in `supabase/migrations/` (new migration file).

## Adding a New Integration Type

1. Add type to `IntegrationType` union in `packages/shared/src/types/quiz.ts`.
2. Add a handler in `supabase/functions/webhook-deliver/index.ts` (`deliverTo` switch).
3. Add UI config form in the builder's integrations settings.

## Environment Variables

```
# apps/builder/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, never expose to client
OPENAI_API_KEY=
```

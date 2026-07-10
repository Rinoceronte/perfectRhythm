# Dance Coach Platform — Claude Instructions

## Project Overview

A mobile-first web application for west coast swing (and future dance styles) coaching, delivered as a **white-labeled single-teacher product**: each teacher gets their own deployment (own domain, database, and branding) so students looking for that teacher land on their branded site, see their availability, and sign up. Three core feature areas:

1. **Skill Roadmap** — per-student skill tracking with effort/improvement scoring and AI-assisted prioritization
2. **Video Review** — students upload videos; the coach annotates with drawing, voice, and playback tools; a composite review video is returned
3. **Lesson Scheduling** — the coach sets availability tied to events/locations; students book within those blocks with tiered priority access

See feature-specific files: `CLAUDE-skills.md`, `CLAUDE-video.md`, `CLAUDE-schedule.md`, `CLAUDE-database.md`, `CLAUDE-integrations.md`

---

## Who Uses It

- **Students** — sign up on the teacher's site (auto-attached to their roster), upload videos, view their skill map, book lessons
- **The Teacher (instance owner)** — the coach this deployment belongs to; manages students, schedule, video reviews, and site branding via `/settings`. Referenced by `site_settings.owner_user_id`, seeded with `pnpm teacher:create`
- **Platform Admin** — future phase

> The schema is still coach-scoped (`coach_id` / `coach_students` everywhere). This multi-coach plumbing is **intentionally dormant** — it keeps a future assistant-coach option open. Do not remove coach scoping from queries; in practice all data belongs to the single owner coach.

---

## Tech Stack

| Layer              | Choice                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Framework          | SvelteKit (Svelte 5) + TypeScript                                                        |
| Styling            | Tailwind CSS v4 + shadcn-svelte                                                          |
| Database           | PostgreSQL (one per deployment)                                                          |
| ORM                | Drizzle ORM                                                                              |
| Auth               | Self-hosted sessions (scrypt password hashes + `sessions` table)                         |
| File Storage       | Supabase Storage (storage only — buckets: `videos-original`, `voice-tracks`, `branding`) |
| Video Hosting      | Mux                                                                                      |
| Video Compositing  | FFmpeg (server-side worker)                                                              |
| Canvas Annotations | Fabric.js                                                                                |
| Voice Recording    | MediaRecorder API + WaveSurfer.js                                                        |
| AI                 | Anthropic Claude API                                                                     |
| Input Validation   | Zod                                                                                      |
| Date/Time          | date-fns                                                                                 |
| Notifications      | Resend (email) + Twilio (SMS)                                                            |
| Location           | Google Places API                                                                        |
| Payments           | Stripe — future phase                                                                    |
| Deployment         | Self-hosted Node (adapter-node), one instance per teacher                                |

---

## Project Structure

```
src/
  lib/
    components/
      ui/              # shadcn-svelte primitives — do not modify
      skill/           # Skill map components
      video/           # Video upload + annotation components
      schedule/        # Scheduling + booking components
      shared/          # Shared layout, nav, loaders, etc.
    server/
      db/              # Drizzle schema + query functions
      services/        # Business logic (skills, video, schedule, ai)
      utils/           # Server-only utilities (date helpers, slot gen, etc.)
    shared/
      types/           # Shared TypeScript types (used by both client + server)
      utils/           # Client-safe utilities
      validation/      # Zod schemas (used in both API routes and client forms)
  routes/
    api/
      v1/              # All API endpoints live here — see API Discipline section
    (app)/             # Authenticated app routes
      dashboard/
      skills/
      videos/
      schedule/
    (auth)/            # Login, signup, etc.
```

---

## API Discipline Rules

> These rules exist to keep the app portable. If a native Capacitor shell is added later, the API layer must be cleanly separable without rearchitecting.

### Rule 1 — All data access goes through `/api/v1/` routes

- SvelteKit `+page.server.ts` `load` functions may call internal service functions directly for SSR page loads
- **All mutations** (create, update, delete) must go through `src/routes/api/v1/` endpoints — never inline in form actions if the same operation might be needed from a native client
- No business logic in `+page.server.ts` — it calls services, not raw DB queries

### Rule 2 — Consistent API response shape

Every API route returns:

```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { code: string, message: string, status: number } }
```

Use the helper:

```typescript
// src/lib/server/utils/api-response.ts
export function ok<T>(data: T) {
	return Response.json({ data, error: null });
}
export function err(code: string, message: string, status = 400) {
	return Response.json({ data: null, error: { code, message, status } }, { status });
}
```

### Rule 3 — All routes are versioned under `/api/v1/`

- Never create API routes outside this path
- Example: `/api/v1/skills`, `/api/v1/videos`, `/api/v1/schedule/slots`

### Rule 4 — Validate all inputs with Zod

- Every `POST`/`PATCH`/`PUT` handler parses `request.json()` through a Zod schema before touching the DB
- Schemas live in `src/lib/shared/validation/` so they can be reused on the client for form validation

### Rule 5 — Auth check on every API route

```typescript
// Always first line of every API handler
const {
	data: { session }
} = await supabase.auth.getSession();
if (!session) return err('UNAUTHORIZED', 'Not authenticated', 401);
```

### Rule 6 — No raw fetch calls in components

- Components call typed client functions from `src/lib/shared/api/` — never `fetch('/api/v1/...')` inline
- This gives a single place to update if base URLs change (e.g. for Capacitor)

---

## Svelte 5 Conventions

- Use runes: `$state`, `$derived`, `$effect`, `$props` — no legacy `writable` stores
- Components use `$props()` destructuring, not `export let`
- Prefer `$derived` over `$effect` for computed values
- Event handlers: `onclick` not `on:click`

---

## Naming Conventions

| Thing      | Convention  | Example                |
| ---------- | ----------- | ---------------------- |
| Components | PascalCase  | `SkillCard.svelte`     |
| Routes     | kebab-case  | `skill-map/`           |
| DB tables  | snake_case  | `skill_assessments`    |
| TS types   | PascalCase  | `SkillAssessment`      |
| API routes | kebab-case  | `/api/v1/skill-map`    |
| Env vars   | UPPER_SNAKE | `SUPABASE_SERVICE_KEY` |

---

## Environment Variables

```
# Supabase
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=         # Server-only

# Mux
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

# Anthropic
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Google
GOOGLE_PLACES_API_KEY=
```

- Variables prefixed `PUBLIC_` are safe to expose to the client
- All others are server-only — never import in `.svelte` components or client-side files

---

## Role System

Roles live in the `users.role` column and reach handlers through session validation (`locals.safeGetSession()` → `user.user_metadata.role`, populated from the DB, not a JWT).

```typescript
type UserRole = 'student' | 'coach' | 'admin';
```

Check roles server-side only — never trust client-passed role claims. **Public signup is student-only**: the signup endpoint hardcodes `role: 'student'` and auto-attaches the new student to the owner coach's roster. The teacher account is created with `pnpm teacher:create`.

---

## White-Label Branding

- Branding (site name, tagline, logo, accent color, owner) lives in the singleton `site_settings` table (`id = 1`), served by `src/lib/server/services/site-settings.ts` (in-process cache, invalidated on save).
- Every page receives it as `data.branding` via the root layout; `hooks.server.ts` puts it on `locals.siteSettings`.
- The accent color is exposed as the `--brand` CSS variable → Tailwind `bg-brand` / `text-brand` utilities. Use `brand` for primary CTAs and highlights; leave the neutral zinc palette alone.
- Never hardcode a site name in UI — use `data.branding.siteName`.
- `/` is the public (unauthenticated) landing page; the dashboard lives at `/dashboard`. Public pages must only use `getPublicScheduleSummary()` — never student-scoped slot queries.
- The teacher edits branding at `/settings` (coach-only); logos upload to the public `branding` storage bucket.

---

## Critical Cross-Cutting Rules

1. **Coach scoping** — Every query that returns student data must be scoped through the coach↔student relationship (`coach_students`). The schema supports multiple coaches (dormant); in practice all data belongs to the owner coach. Never bypass the scoping.

2. **Invisible block** — If a coach has invisible-blocked a student, that student must always see that coach's availability as fully booked. The block must never be detectable client-side. Implement at the query layer, not the UI layer.

3. **Skill authority hierarchy** — Coach manual edits > AI suggestions > Student self-assessments. Once a coach locks a skill value, AI must not overwrite it. See `CLAUDE-skills.md`.

4. **2am day boundary** — A calendar "day" ends at 2:00 AM the following morning. All scheduling logic must use the `toScheduleDate()` utility, never raw `new Date()`. See `CLAUDE-schedule.md`.

5. **Notification routing** — All notifications go through `src/lib/server/services/notifications.ts` — never call Resend or Twilio directly from route handlers.

---

## Developer Notes

- Built solo using Claude Code + Zed editor
- Prefer explicit over clever — self-documenting code over abstractions
- When in doubt, do less and do it well
- Mobile-first: design for 390px width before desktop

# Database — Claude Instructions

See `CLAUDE.md` for project-wide conventions.

---

## Stack
- **PostgreSQL** via **Supabase** (hosted)
- **Drizzle ORM** for type-safe queries
- **Supabase Auth** for users/sessions
- **Supabase Storage** for file uploads

---

## Drizzle Setup

```typescript
// src/lib/server/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/server/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

---

## Core Tables Summary

| Table | Purpose |
|---|---|
| `users` | Auth users (synced from Supabase Auth via trigger) |
| `coach_students` | Coach↔student relationships (many-to-many) |
| `skills` | Skill map entries per coach↔student pair |
| `videos` | Uploaded student videos |
| `video_reviews` | Coach review sessions with annotations |
| `events` | Dance events/competitions |
| `availability_blocks` | Coach availability windows |
| `lesson_slots` | Generated individual lesson slots |
| `booking_requests` | Student lesson booking requests |
| `booking_interests` | Pre-open interest registrations |
| `invisible_blocks` | Coach invisible blocks on students |

---

## Users Table

Supabase Auth manages the auth record. Mirror display data to a `users` table for joins:

```typescript
// src/lib/server/db/schema/users.ts
export const users = pgTable('users', {
  id:          uuid('id').primaryKey(),  // matches Supabase Auth user id
  email:       text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  role:        userRoleEnum('role').notNull().default('student'),
  avatarUrl:   text('avatar_url'),
  bio:         text('bio'),
  phone:       text('phone'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
})

export const userRoleEnum = pgEnum('user_role', ['student', 'coach', 'admin'])
```

Sync via Supabase trigger on `auth.users` insert → insert into `public.users`.

---

## Coach↔Student Relationship

```typescript
// src/lib/server/db/schema/relationships.ts
export const coachStudents = pgTable('coach_students', {
  id:        uuid('id').primaryKey().defaultRandom(),
  coachId:   uuid('coach_id').notNull().references(() => users.id),
  studentId: uuid('student_id').notNull().references(() => users.id),
  status:    text('status').notNull().default('active'),  // active | inactive | pending
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniquePair: unique().on(t.coachId, t.studentId),
}))
```

All skill map data and video reviews are scoped to a `coach_student_id` — never to a raw `student_id` alone.

---

## Role-Based Access via JWT Claims

Supabase custom claims allow role checking in RLS policies:

```sql
-- Function to get role from JWT
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    'student'
  )
$$ LANGUAGE sql STABLE;
```

Set the claim on sign-up / role assignment:

```typescript
// src/lib/server/services/auth.ts
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!  // service key — server only
)

export async function setUserRole(userId: string, role: 'student' | 'coach'): Promise<void> {
  await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: { role }
  })
}
```

---

## Row-Level Security (RLS) Policies

Enable RLS on all tables. Key patterns:

```sql
-- Users can read their own record; coaches can read their students
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: read own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users: coach reads students" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coach_students
      WHERE coach_id = auth.uid() AND student_id = users.id
    )
  );

-- Skills: scoped to the coach↔student relationship
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skills: coach can CRUD their students" ON skills
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM coach_students cs
      WHERE cs.id = skills.coach_student_id
        AND cs.coach_id = auth.uid()
    )
  );

CREATE POLICY "skills: student can read own" ON skills
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coach_students cs
      WHERE cs.id = skills.coach_student_id
        AND cs.student_id = auth.uid()
    )
  );

-- Invisible blocks: coach only, never exposed to student
ALTER TABLE invisible_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invisible_blocks: coach only" ON invisible_blocks
  FOR ALL USING (coach_id = auth.uid());
-- No student-readable policy — students cannot query this table at all
```

---

## Supabase Storage Buckets

| Bucket | Access | Contents |
|---|---|---|
| `videos-original` | Private (signed URLs) | Raw student video uploads |
| `videos-composite` | Private (signed URLs) | Finished review videos |
| `voice-tracks` | Private | Coach voice recordings |
| `avatars` | Public | User profile images |

```typescript
// Get a signed upload URL (server-side)
const { data, error } = await supabase.storage
  .from('videos-original')
  .createSignedUploadUrl(`${studentId}/${videoId}/original.mp4`)
```

---

## Indexes

Add these indexes at migration time:

```sql
-- Skills: fast lookup by relationship
CREATE INDEX idx_skills_coach_student ON skills(coach_student_id);
CREATE INDEX idx_skills_priority ON skills(coach_student_id, priority_score DESC);

-- Videos: fast lookup by student
CREATE INDEX idx_videos_student ON videos(student_id);

-- Lesson slots: fast availability lookup
CREATE INDEX idx_slots_availability ON lesson_slots(availability_block_id, status);
CREATE INDEX idx_slots_time ON lesson_slots(start_time) WHERE status = 'available';

-- Booking requests: fast lookup for coach/student
CREATE INDEX idx_bookings_coach ON booking_requests(coach_id, status);
CREATE INDEX idx_bookings_student ON booking_requests(student_id, status);

-- Invisible blocks: fast check
CREATE INDEX idx_invisible_blocks_lookup ON invisible_blocks(coach_id, student_id);
```

---

## Migrations

Use Drizzle Kit for all schema changes:

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Never edit migration files after applying them
# Never make schema changes directly in Supabase dashboard — use Drizzle
```

---

## Query Patterns

Always scope to the authenticated user. Never return cross-user data:

```typescript
// Good — scoped to auth context
export async function getStudentSkills(coachId: string, studentId: string) {
  return db.query.skills.findMany({
    where: and(
      eq(skills.coachStudentId,
        db.select({ id: coachStudents.id })
          .from(coachStudents)
          .where(and(
            eq(coachStudents.coachId, coachId),
            eq(coachStudents.studentId, studentId)
          ))
      )
    ),
    orderBy: [desc(skills.priorityScore)]
  })
}

// Bad — never do this
export async function getAllSkillsForStudent(studentId: string) {
  // This leaks skills from other coaches!
  return db.query.skills.findMany({ where: eq(skills.studentId, studentId) })
}
```

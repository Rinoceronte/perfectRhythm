# Skill Map Feature — Claude Instructions

See `CLAUDE.md` for project-wide conventions.

---

## Overview
Each student has a skill map: a list of dance skills, each scored on multiple axes. The map is used to prioritize what the student should focus on next. Coaches, AI, and students can all contribute scores — but with strict authority rules.

---

## Authority Hierarchy (Critical)

```
Coach manual edit  ← highest authority
       ↓
AI suggestion      ← can update only if coach hasn't locked
       ↓
Student self-score ← lowest authority, always overridable
```

Implementation rules:
- Each skill entry has a `coachLocked: boolean` field
- When a coach manually sets any value on a skill, set `coachLocked = true`
- AI update functions must check `coachLocked` before writing — if true, skip silently
- Students can edit their own scores but these are flagged as `source: 'student'`
- UI should visually indicate lock status to coaches (they can unlock if needed)

---

## Data Model

```typescript
// src/lib/shared/types/skills.ts

type SkillSource = 'coach' | 'ai' | 'student'

interface Skill {
  id: string
  coachStudentId: string      // links to the coach↔student relationship
  name: string
  category: SkillCategory
  currentScore: number        // 1–10, current ability level
  effortToImprove: number     // 1–10, how hard improvement will be (10 = very hard)
  improvementBenefit: number  // 1–10, how much improvement helps overall (10 = high impact)
  priorityScore: number       // derived, see Priority Calculation
  source: SkillSource         // who last set the values
  coachLocked: boolean        // if true, AI cannot modify
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

type SkillCategory =
  | 'timing'
  | 'footwork'
  | 'connection'
  | 'musicality'
  | 'styling'
  | 'partnering'
  | 'body_mechanics'
  | 'patterns'
  | 'improvisation'
  | 'performance'
  | 'custom'
```

---

## Priority Calculation

The priority score determines the display order — highest priority shown first.

```typescript
// src/lib/server/services/skills.ts

/**
 * Higher priority = lower effort + higher benefit.
 * Both axes are 1–10. We invert effort so low effort = high score.
 */
export function calculatePriority(effortToImprove: number, improvementBenefit: number): number {
  const effortScore = 11 - effortToImprove  // invert: effort 3 → score 8
  return (effortScore + improvementBenefit) / 2
}

// Example:
// Head articulations: effort=7, benefit=1 → priority = ((11-7) + 1) / 2 = 2.5
// Critical timing:    effort=3, benefit=5 → priority = ((11-3) + 5) / 2 = 6.5
// → Critical timing appears higher in the list
```

Priority score is always stored on the record (not computed at query time) so it can be indexed and sorted efficiently.

---

## Drizzle Schema

```typescript
// src/lib/server/db/schema/skills.ts
import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const skillSourceEnum = pgEnum('skill_source', ['coach', 'ai', 'student'])

export const skillCategoryEnum = pgEnum('skill_category', [
  'timing', 'footwork', 'connection', 'musicality', 'styling',
  'partnering', 'body_mechanics', 'patterns', 'improvisation', 'performance', 'custom'
])

export const skills = pgTable('skills', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  coachStudentId:     uuid('coach_student_id').notNull().references(() => coachStudents.id),
  name:               text('name').notNull(),
  category:           skillCategoryEnum('category').notNull(),
  currentScore:       integer('current_score').notNull().default(5),
  effortToImprove:    integer('effort_to_improve').notNull().default(5),
  improvementBenefit: integer('improvement_benefit').notNull().default(5),
  priorityScore:      integer('priority_score').notNull().default(5),  // stored, not computed
  source:             skillSourceEnum('source').notNull().default('student'),
  coachLocked:        boolean('coach_locked').notNull().default(false),
  notes:              text('notes'),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
})
```

---

## API Endpoints

All under `/api/v1/skills/`

```
GET    /api/v1/skills?studentId=&coachId=    List skills for a coach↔student pair
POST   /api/v1/skills                        Create a new skill
PATCH  /api/v1/skills/:id                    Update a skill (sets coachLocked if coach)
DELETE /api/v1/skills/:id                    Delete a skill
POST   /api/v1/skills/ai-suggest             Trigger AI skill suggestion for a student
POST   /api/v1/skills/reorder                Manually reorder skills (coach/student)
```

### PATCH /api/v1/skills/:id
```typescript
// Zod schema: src/lib/shared/validation/skills.ts
const UpdateSkillSchema = z.object({
  currentScore:       z.number().int().min(1).max(10).optional(),
  effortToImprove:    z.number().int().min(1).max(10).optional(),
  improvementBenefit: z.number().int().min(1).max(10).optional(),
  notes:              z.string().max(1000).optional(),
  coachLocked:        z.boolean().optional(),  // coach only
})

// Handler logic:
// 1. Parse + validate body
// 2. If requester is coach → set source='coach', coachLocked=true (unless explicitly unlocking)
// 3. If requester is student → set source='student', never touch coachLocked
// 4. Recalculate priorityScore
// 5. Update record
```

---

## AI Skill Suggestion

```typescript
// src/lib/server/services/skills/ai-suggest.ts

/**
 * Takes the student's video review transcript + existing skill map,
 * returns suggested updates. Only updates skills where coachLocked=false.
 */
export async function aiSuggestSkills(
  coachStudentId: string,
  videoReviewTranscript?: string
): Promise<SkillSuggestion[]> {
  const existing = await getSkillsForCoachStudent(coachStudentId)
  
  const prompt = buildSkillPrompt(existing, videoReviewTranscript)
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })
  
  const suggestions = parseSkillResponse(response)
  
  // Filter out any skills the coach has locked
  return suggestions.filter(s => {
    const existing = existingMap.get(s.skillId)
    return !existing?.coachLocked
  })
}
```

### AI Prompt Pattern
```typescript
function buildSkillPrompt(skills: Skill[], transcript?: string): string {
  return `
You are a west coast swing dance coach assistant. Based on the student's current skill map${transcript ? ' and their video review' : ''}, suggest updated scores.

Current skill map:
${JSON.stringify(skills.map(s => ({ id: s.id, name: s.name, currentScore: s.currentScore })), null, 2)}

${transcript ? `Video review notes:\n${transcript}` : ''}

Return a JSON array of suggested updates. Only include skills that should change.
Format: [{ "skillId": "...", "currentScore": 1-10, "effortToImprove": 1-10, "improvementBenefit": 1-10, "reasoning": "..." }]

Do not include skills you are uncertain about. Only suggest changes you can justify from the available information.
  `.trim()
}
```

---

## WCS Skill Category Suggestions
When a new coach↔student relationship is created, offer to seed the skill map with these defaults (all starting at score 5, unlocked):

**Timing**
- Pulse / compression timing, Slot discipline, Triple step timing, Walk walk timing, Syncopations

**Connection**
- Lead clarity, Follow sensitivity, Frame consistency, Elastic connection, Recovery from mistakes

**Footwork**
- Heel/toe placement, Weight transfers, Footwork styling, Balance in turns

**Body Mechanics**
- Posture, Core engagement, Shoulder alignment, Hip movement

**Musicality**
- Phrase awareness, Accent hits, Musical interpretation, Song structure recognition

**Patterns**
- Basic 6-count, 8-count, Whip, Tuck turn, Sugar push, Side pass, Underarm turn

**Styling**
- Arm styling, Head articulation, Body rolls, Level changes

**Partnering**
- Spatial awareness, Traffic management, Improvisation, Creativity

---

## Component Notes
- `SkillMap.svelte` — main list view, sorted by `priorityScore` desc
- `SkillCard.svelte` — individual skill with inline editing
- `SkillCategoryGroup.svelte` — optional grouped view by category
- `SkillEditModal.svelte` — full edit form (coach view shows lock toggle)
- Show lock icon on coach-locked skills; tooltip explains AI won't override
- Student view: can edit own scores but sees "Coach has reviewed this" badge on locked skills

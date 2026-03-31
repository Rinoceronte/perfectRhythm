# Scheduling Feature — Claude Instructions

See `CLAUDE.md` for project-wide conventions.

---

## Overview
Coaches create lesson availability tied to dance events or locations. Students request lessons within those blocks. The system uses a tiered booking release — repeat/priority students get early access, then general availability opens in batches.

---

## Key Concepts

### "Day ends at 2am"
A dance event "day" runs from morning until 2:00 AM the **following** calendar day. When displaying or grouping by date, any time from 00:00–01:59 belongs to the previous day's schedule.

```typescript
// src/lib/server/utils/schedule-date.ts

/**
 * Convert a JS Date to a "schedule date" string (YYYY-MM-DD).
 * Dates between midnight and 2am are considered part of the previous day.
 */
export function toScheduleDate(date: Date): string {
  const adjusted = new Date(date)
  if (adjusted.getHours() < 2) {
    adjusted.setDate(adjusted.getDate() - 1)
  }
  return adjusted.toISOString().split('T')[0]
}

/**
 * The start of a schedule day (6am, giving a comfortable buffer after the 2am cutoff).
 */
export function scheduledayStart(dateStr: string): Date {
  return new Date(`${dateStr}T06:00:00`)
}

/**
 * The end of a schedule day (2am the following morning).
 */
export function scheduledayEnd(dateStr: string): Date {
  const next = new Date(`${dateStr}T02:00:00`)
  next.setDate(next.getDate() + 1)
  return next
}
```

**Rule: Never use `new Date()` raw in scheduling logic. Always use these utilities.**

---

## Data Model

```typescript
// src/lib/shared/types/schedule.ts

interface Event {
  id: string
  coachId: string
  name: string               // e.g. "SwingDiego 2025"
  location: string           // venue name
  city: string
  stateOrRegion: string
  country: string
  lat: number | null
  lng: number | null
  startDate: string          // YYYY-MM-DD (schedule date)
  endDate: string            // YYYY-MM-DD (schedule date)
  isRecurring: boolean
  externalEventId: string | null  // if imported from external calendar
}

interface AvailabilityBlock {
  id: string
  coachId: string
  eventId: string | null     // either tied to an event...
  location: string | null    // ...or a standalone location
  scheduleDate: string       // YYYY-MM-DD (schedule date, uses 2am rule)
  startTime: string          // HH:MM (24h), e.g. "10:00"
  endTime: string            // HH:MM (24h), e.g. "23:00" or "01:30" (next morning)
  lessonDurationMinutes: number   // coach sets, e.g. 45
  gapMinutes: number              // buffer between lessons, default 0
  maxStudents: number | null      // null = unlimited
  bookingOpenAt: Date | null      // when general booking opens
  priorityBookingOpenAt: Date | null  // when priority students can book
  isPublished: boolean
}

interface LessonSlot {
  id: string
  availabilityBlockId: string
  startTime: Date
  endTime: Date
  status: 'available' | 'pending' | 'confirmed' | 'cancelled'
  studentId: string | null
  bookedAt: Date | null
}

interface BookingRequest {
  id: string
  slotId: string
  studentId: string
  coachId: string
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled'
  requestedAt: Date
  respondedAt: Date | null
  notes: string | null
}

interface InvisibleBlock {
  id: string
  coachId: string
  studentId: string
  createdAt: Date
  // No additional fields — existence of the record is the block
}
```

---

## Drizzle Schema

```typescript
// src/lib/server/db/schema/schedule.ts

export const events = pgTable('events', {
  id:              uuid('id').primaryKey().defaultRandom(),
  coachId:         uuid('coach_id').notNull().references(() => users.id),
  name:            text('name').notNull(),
  location:        text('location').notNull(),
  city:            text('city').notNull(),
  stateOrRegion:   text('state_or_region').notNull(),
  country:         text('country').notNull().default('US'),
  lat:             real('lat'),
  lng:             real('lng'),
  startDate:       text('start_date').notNull(),  // stored as YYYY-MM-DD string
  endDate:         text('end_date').notNull(),
  isRecurring:     boolean('is_recurring').notNull().default(false),
  externalEventId: text('external_event_id'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
})

export const availabilityBlocks = pgTable('availability_blocks', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  coachId:                 uuid('coach_id').notNull().references(() => users.id),
  eventId:                 uuid('event_id').references(() => events.id),
  location:                text('location'),
  scheduleDate:            text('schedule_date').notNull(),
  startTime:               text('start_time').notNull(),
  endTime:                 text('end_time').notNull(),
  lessonDurationMinutes:   integer('lesson_duration_minutes').notNull().default(45),
  gapMinutes:              integer('gap_minutes').notNull().default(0),
  maxStudents:             integer('max_students'),
  bookingOpenAt:           timestamp('booking_open_at'),
  priorityBookingOpenAt:   timestamp('priority_booking_open_at'),
  isPublished:             boolean('is_published').notNull().default(false),
  createdAt:               timestamp('created_at').defaultNow().notNull(),
})

export const lessonSlots = pgTable('lesson_slots', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  availabilityBlockId:   uuid('availability_block_id').notNull().references(() => availabilityBlocks.id),
  startTime:             timestamp('start_time').notNull(),
  endTime:               timestamp('end_time').notNull(),
  status:                text('status').notNull().default('available'),
  studentId:             uuid('student_id').references(() => users.id),
  bookedAt:              timestamp('booked_at'),
})

export const bookingRequests = pgTable('booking_requests', {
  id:           uuid('id').primaryKey().defaultRandom(),
  slotId:       uuid('slot_id').notNull().references(() => lessonSlots.id),
  studentId:    uuid('student_id').notNull().references(() => users.id),
  coachId:      uuid('coach_id').notNull().references(() => users.id),
  status:       text('status').notNull().default('pending'),
  requestedAt:  timestamp('requested_at').defaultNow().notNull(),
  respondedAt:  timestamp('responded_at'),
  notes:        text('notes'),
})

export const invisibleBlocks = pgTable('invisible_blocks', {
  id:        uuid('id').primaryKey().defaultRandom(),
  coachId:   uuid('coach_id').notNull().references(() => users.id),
  studentId: uuid('student_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniquePair: unique().on(t.coachId, t.studentId),
}))
```

---

## Slot Generation

When a coach publishes an availability block, generate lesson slots:

```typescript
// src/lib/server/services/schedule/slots.ts

export function generateSlots(block: AvailabilityBlock): SlotInput[] {
  const slots: SlotInput[] = []
  const slotDurationMs = block.lessonDurationMinutes * 60 * 1000
  const gapMs = block.gapMinutes * 60 * 1000

  // Parse start/end into full Date objects (handle overnight: endTime < startTime means next morning)
  const blockStart = parseBlockTime(block.scheduleDate, block.startTime)
  const blockEnd = parseBlockTime(block.scheduleDate, block.endTime, blockStart)

  let cursor = blockStart
  while (cursor.getTime() + slotDurationMs <= blockEnd.getTime()) {
    slots.push({
      availabilityBlockId: block.id,
      startTime: new Date(cursor),
      endTime: new Date(cursor.getTime() + slotDurationMs),
      status: 'available',
    })
    cursor = new Date(cursor.getTime() + slotDurationMs + gapMs)
  }

  return slots
}

/**
 * Handle times that cross midnight (e.g., startTime="22:00", endTime="01:00")
 */
function parseBlockTime(scheduleDate: string, timeStr: string, reference?: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const base = new Date(`${scheduleDate}T${timeStr}:00`)
  // If this time is before the reference (crossed midnight), add a day
  if (reference && base < reference) {
    base.setDate(base.getDate() + 1)
  }
  return base
}
```

---

## Booking Priority System

### Tier 1: Priority Students
- Students who have previously booked (and completed) a lesson with this coach
- Get access `priorityBookingOpenAt` (coach-set, typically 24h before general)

### Tier 2: General — Batched Release
- When `bookingOpenAt` arrives, release slots to interested students in batches
- Students can "register interest" before booking opens
- Batch: up to 10 students notified per hour, in order of when they registered interest

```typescript
// src/lib/server/services/schedule/booking-release.ts
// Triggered by cron job every hour

export async function processBatchRelease(): Promise<void> {
  // Find all blocks where bookingOpenAt has passed and still have unreleased interested students
  const blocks = await getBlocksWithPendingRelease()

  for (const block of blocks) {
    const nextBatch = await getNextInterestBatch(block.id, BATCH_SIZE) // BATCH_SIZE = 10
    if (nextBatch.length === 0) continue

    await notifyBatch(nextBatch, block)
    await markBatchNotified(nextBatch, block.id)
  }
}
```

---

## Invisible Block (Critical)

A coach can silently block a student. The blocked student **always** sees the coach's availability as fully booked.

### Implementation — query layer only

```typescript
// src/lib/server/services/schedule/availability.ts

export async function getSlotsForStudent(
  coachId: string,
  studentId: string,
  scheduleDate: string
): Promise<LessonSlot[]> {

  // Check invisible block FIRST — before any other logic
  const isBlocked = await checkInvisibleBlock(coachId, studentId)
  if (isBlocked) {
    // Return empty array — student sees "no availability"
    // Do NOT return an error or any indication they are blocked
    return []
  }

  return await getAvailableSlots(coachId, scheduleDate)
}

async function checkInvisibleBlock(coachId: string, studentId: string): Promise<boolean> {
  const block = await db.query.invisibleBlocks.findFirst({
    where: and(
      eq(invisibleBlocks.coachId, coachId),
      eq(invisibleBlocks.studentId, studentId)
    )
  })
  return !!block
}
```

**Rules:**
- Never expose invisible block status in any API response to students
- Never return a different error code — always look like normal "no availability"
- Coach-side UI shows a list of invisible-blocked students (coach-only endpoint)
- Only the coach who created the block can see or remove it

---

## API Endpoints

```
# Events
GET    /api/v1/events                    List events (with filters: coach, date range, location)
POST   /api/v1/events                    Create event (coach only)
PATCH  /api/v1/events/:id               Update event
DELETE /api/v1/events/:id               Delete event

# Availability
GET    /api/v1/availability              List blocks (coach sees own; students see published)
POST   /api/v1/availability              Create availability block (coach only)
PATCH  /api/v1/availability/:id         Update block
POST   /api/v1/availability/:id/publish  Publish block and generate slots
DELETE /api/v1/availability/:id         Delete block (also deletes generated slots)

# Slots + Booking
GET    /api/v1/schedule/slots            Get available slots (applies invisible block filter)
POST   /api/v1/schedule/interest         Register interest in a block before it opens
POST   /api/v1/schedule/book             Request a lesson slot
PATCH  /api/v1/schedule/bookings/:id     Confirm or decline a booking (coach only)
DELETE /api/v1/schedule/bookings/:id     Cancel a booking

# Invisible Blocks (coach only)
GET    /api/v1/coach/invisible-blocks    List all invisible blocks for this coach
POST   /api/v1/coach/invisible-blocks    Create an invisible block
DELETE /api/v1/coach/invisible-blocks/:id  Remove an invisible block
```

---

## Repeat Student Detection

```typescript
// A student is a "priority student" for a coach if:
// - They have at least 1 completed (status='confirmed', in the past) booking with that coach

export async function isPriorityStudent(coachId: string, studentId: string): Promise<boolean> {
  const pastLesson = await db.query.bookingRequests.findFirst({
    where: and(
      eq(bookingRequests.coachId, coachId),
      eq(bookingRequests.studentId, studentId),
      eq(bookingRequests.status, 'confirmed'),
      lt(lessonSlots.startTime, new Date())  // join to check it's in the past
    )
  })
  return !!pastLesson
}
```

---

## Component Notes
- `CoachScheduleBuilder.svelte` — create/edit availability blocks with time range picker
- `EventPicker.svelte` — search or create events, attach to availability
- `StudentBookingView.svelte` — shows available slots to student (invisible block applied server-side)
- `BookingCalendar.svelte` — calendar view for coach to see all their upcoming lessons
- `InvisibleBlockManager.svelte` — coach-only, shows blocked students with remove option (never shown to students)
- Time range picker must support overnight ranges (e.g., 10pm–1am)

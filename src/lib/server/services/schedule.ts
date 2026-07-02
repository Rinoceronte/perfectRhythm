// Scheduling and booking business logic
import crypto from 'crypto';
import { db } from '$lib/server/db';
import {
	events,
	coachEvents,
	availabilityBlocks,
	lessonSlots,
	bookingRequests,
	bookingInterests,
	eventInterests,
	invisibleBlocks,
	users,
	coachStudents
} from '$lib/server/db/schema';
import { eq, and, gte, lte, lt, inArray, ilike } from 'drizzle-orm';
import { parseBlockTime } from '$lib/server/utils/date';
import type {
	Event,
	AvailabilityBlock,
	LessonSlot,
	BookingRequest,
	BookingInterest,
	EventInterest,
	InvisibleBlock,
	BookingWithDetails,
	BlockWithSlots,
	CoachBookSlotResult
} from '$lib/shared/types';
import type {
	CreateEventInput,
	UpdateEventInput,
	CreateAvailabilityBlockInput,
	UpdateAvailabilityBlockInput,
	CoachBookSlotInput
} from '$lib/shared/validation/schedule';

// ---- Events ----

export async function getEventsForCoach(coachId: string): Promise<Event[]> {
	const rows = await db
		.select({ event: events })
		.from(coachEvents)
		.innerJoin(events, eq(coachEvents.eventId, events.id))
		.where(eq(coachEvents.coachId, coachId));
	return rows.map((r) => r.event as Event);
}

export async function searchEvents(query: string): Promise<Event[]> {
	const rows = await db
		.select()
		.from(events)
		.where(ilike(events.name, `%${query}%`))
		.orderBy(events.name)
		.limit(20);
	return rows as Event[];
}

export async function getEventById(id: string): Promise<Event | null> {
	const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
	return (rows[0] as Event) ?? null;
}

export async function createEvent(coachId: string, input: CreateEventInput): Promise<Event> {
	// Check if this coach is already linked to a matching event
	const alreadyLinked = await db
		.select({ eventId: coachEvents.eventId })
		.from(coachEvents)
		.innerJoin(events, eq(coachEvents.eventId, events.id))
		.where(
			and(
				eq(coachEvents.coachId, coachId),
				ilike(events.name, input.name),
				lte(events.startDate, input.endDate),
				gte(events.endDate, input.startDate)
			)
		)
		.limit(1);

	if (alreadyLinked.length > 0) {
		throw new Error('DUPLICATE_EVENT');
	}

	// Check if a matching event already exists (created by another coach)
	const existing = await db
		.select()
		.from(events)
		.where(
			and(
				ilike(events.name, input.name),
				lte(events.startDate, input.endDate),
				gte(events.endDate, input.startDate)
			)
		)
		.limit(1);

	let event: Event;

	if (existing.length > 0) {
		// Link coach to existing event
		event = existing[0] as Event;
	} else {
		// Create new event
		const [row] = await db
			.insert(events)
			.values({
				name: input.name,
				location: input.location,
				city: input.city,
				stateOrRegion: input.stateOrRegion,
				country: input.country ?? 'US',
				lat: input.lat ?? null,
				lng: input.lng ?? null,
				startDate: input.startDate,
				endDate: input.endDate,
				isRecurring: input.isRecurring ?? false,
				externalEventId: input.externalEventId ?? null
			})
			.returning();
		event = row as Event;
	}

	// Link coach to event
	await db
		.insert(coachEvents)
		.values({ coachId, eventId: event.id })
		.onConflictDoNothing();

	return event;
}

export async function updateEvent(
	id: string,
	input: UpdateEventInput
): Promise<Event | null> {
	const [row] = await db
		.update(events)
		.set({
			...(input.name !== undefined && { name: input.name }),
			...(input.location !== undefined && { location: input.location }),
			...(input.city !== undefined && { city: input.city }),
			...(input.stateOrRegion !== undefined && { stateOrRegion: input.stateOrRegion }),
			...(input.country !== undefined && { country: input.country }),
			...(input.lat !== undefined && { lat: input.lat }),
			...(input.lng !== undefined && { lng: input.lng }),
			...(input.startDate !== undefined && { startDate: input.startDate }),
			...(input.endDate !== undefined && { endDate: input.endDate }),
			...(input.isRecurring !== undefined && { isRecurring: input.isRecurring }),
			...(input.externalEventId !== undefined && { externalEventId: input.externalEventId })
		})
		.where(eq(events.id, id))
		.returning();
	return (row as Event) ?? null;
}

export async function unlinkCoachFromEvent(coachId: string, eventId: string): Promise<boolean> {
	const result = await db
		.delete(coachEvents)
		.where(and(eq(coachEvents.coachId, coachId), eq(coachEvents.eventId, eventId)))
		.returning({ id: coachEvents.id });
	return result.length > 0;
}

// ---- Availability Blocks ----

export async function getBlocksForCoach(coachId: string): Promise<AvailabilityBlock[]> {
	const rows = await db
		.select()
		.from(availabilityBlocks)
		.where(eq(availabilityBlocks.coachId, coachId));
	return rows as AvailabilityBlock[];
}

export async function getPublishedBlocksForCoachInRange(
	coachId: string,
	startDate: string,
	endDate: string
): Promise<AvailabilityBlock[]> {
	const rows = await db
		.select()
		.from(availabilityBlocks)
		.where(
			and(
				eq(availabilityBlocks.coachId, coachId),
				eq(availabilityBlocks.isPublished, true),
				gte(availabilityBlocks.scheduleDate, startDate),
				lte(availabilityBlocks.scheduleDate, endDate)
			)
		);
	return rows as AvailabilityBlock[];
}

export async function getBlockById(id: string): Promise<AvailabilityBlock | null> {
	const rows = await db
		.select()
		.from(availabilityBlocks)
		.where(eq(availabilityBlocks.id, id))
		.limit(1);
	return (rows[0] as AvailabilityBlock) ?? null;
}

export async function createAvailabilityBlock(
	coachId: string,
	input: CreateAvailabilityBlockInput
): Promise<AvailabilityBlock> {
	const [row] = await db
		.insert(availabilityBlocks)
		.values({
			coachId,
			eventId: input.eventId ?? null,
			location: input.location ?? null,
			scheduleDate: input.scheduleDate,
			startTime: input.startTime,
			endTime: input.endTime,
			lessonDurationMinutes: input.lessonDurationMinutes ?? 45,
			gapMinutes: input.gapMinutes ?? 0,
			maxStudents: input.maxStudents ?? null,
			bookingOpenAt: input.bookingOpenAt ? new Date(input.bookingOpenAt) : null,
			priorityBookingOpenAt: input.priorityBookingOpenAt
				? new Date(input.priorityBookingOpenAt)
				: null,
			isPublished: false
		})
		.returning();
	return row as AvailabilityBlock;
}

export async function updateAvailabilityBlock(
	id: string,
	input: UpdateAvailabilityBlockInput
): Promise<AvailabilityBlock | null> {
	const [row] = await db
		.update(availabilityBlocks)
		.set({
			...(input.eventId !== undefined && { eventId: input.eventId }),
			...(input.location !== undefined && { location: input.location }),
			...(input.scheduleDate !== undefined && { scheduleDate: input.scheduleDate }),
			...(input.startTime !== undefined && { startTime: input.startTime }),
			...(input.endTime !== undefined && { endTime: input.endTime }),
			...(input.lessonDurationMinutes !== undefined && {
				lessonDurationMinutes: input.lessonDurationMinutes
			}),
			...(input.gapMinutes !== undefined && { gapMinutes: input.gapMinutes }),
			...(input.maxStudents !== undefined && { maxStudents: input.maxStudents }),
			...(input.bookingOpenAt !== undefined && {
				bookingOpenAt: input.bookingOpenAt ? new Date(input.bookingOpenAt) : null
			}),
			...(input.priorityBookingOpenAt !== undefined && {
				priorityBookingOpenAt: input.priorityBookingOpenAt
					? new Date(input.priorityBookingOpenAt)
					: null
			})
		})
		.where(eq(availabilityBlocks.id, id))
		.returning();
	return (row as AvailabilityBlock) ?? null;
}

export async function deleteAvailabilityBlock(id: string): Promise<boolean> {
	// Cascade: delete slots first (booking requests reference slots, they'll also need deletion)
	const slots = await db
		.select({ id: lessonSlots.id })
		.from(lessonSlots)
		.where(eq(lessonSlots.availabilityBlockId, id));

	if (slots.length > 0) {
		const slotIds = slots.map((s) => s.id);
		await db.delete(bookingRequests).where(inArray(bookingRequests.slotId, slotIds));
		await db.delete(lessonSlots).where(eq(lessonSlots.availabilityBlockId, id));
	}

	await db.delete(bookingInterests).where(eq(bookingInterests.availabilityBlockId, id));

	const result = await db
		.delete(availabilityBlocks)
		.where(eq(availabilityBlocks.id, id))
		.returning({ id: availabilityBlocks.id });
	return result.length > 0;
}

// ---- Slot Generation ----

interface SlotInput {
	availabilityBlockId: string;
	startTime: Date;
	endTime: Date;
	status: 'available';
}

export function generateSlots(block: AvailabilityBlock): SlotInput[] {
	const slots: SlotInput[] = [];
	const slotDurationMs = block.lessonDurationMinutes * 60 * 1000;
	const gapMs = block.gapMinutes * 60 * 1000;

	const blockStart = parseBlockTime(block.scheduleDate, block.startTime);
	const blockEnd = parseBlockTime(block.scheduleDate, block.endTime, blockStart);

	let cursor = blockStart;
	while (cursor.getTime() + slotDurationMs <= blockEnd.getTime()) {
		slots.push({
			availabilityBlockId: block.id,
			startTime: new Date(cursor),
			endTime: new Date(cursor.getTime() + slotDurationMs),
			status: 'available'
		});
		cursor = new Date(cursor.getTime() + slotDurationMs + gapMs);
	}

	return slots;
}

export async function publishBlock(id: string): Promise<BlockWithSlots | null> {
	const block = await getBlockById(id);
	if (!block) return null;

	// Delete any previously generated slots (re-publish scenario)
	const existingSlots = await db
		.select({ id: lessonSlots.id })
		.from(lessonSlots)
		.where(eq(lessonSlots.availabilityBlockId, id));

	if (existingSlots.length > 0) {
		const slotIds = existingSlots.map((s) => s.id);
		await db.delete(bookingRequests).where(inArray(bookingRequests.slotId, slotIds));
		await db.delete(lessonSlots).where(eq(lessonSlots.availabilityBlockId, id));
	}

	const slotInputs = generateSlots(block);

	let newSlots: LessonSlot[] = [];
	if (slotInputs.length > 0) {
		newSlots = (await db.insert(lessonSlots).values(slotInputs).returning()) as LessonSlot[];
	}

	const [updatedBlock] = await db
		.update(availabilityBlocks)
		.set({ isPublished: true })
		.where(eq(availabilityBlocks.id, id))
		.returning();

	const event = updatedBlock.eventId ? await getEventById(updatedBlock.eventId) : null;

	return {
		...(updatedBlock as AvailabilityBlock),
		slots: newSlots,
		event
	};
}

// ---- Slots ----

export async function getSlotsForBlock(blockId: string): Promise<LessonSlot[]> {
	const rows = await db
		.select()
		.from(lessonSlots)
		.where(eq(lessonSlots.availabilityBlockId, blockId));
	return rows as LessonSlot[];
}

/**
 * Get available slots for a student — applies invisible block check.
 * Blocked students silently receive empty results.
 */
export async function getSlotsForStudent(
	coachId: string,
	studentId: string,
	scheduleDate: string
): Promise<LessonSlot[]> {
	const blocked = await checkInvisibleBlock(coachId, studentId);
	if (blocked) return [];

	const now = new Date();

	// Find all published blocks for this coach on this date
	const blocks = await db
		.select()
		.from(availabilityBlocks)
		.where(
			and(
				eq(availabilityBlocks.coachId, coachId),
				eq(availabilityBlocks.scheduleDate, scheduleDate),
				eq(availabilityBlocks.isPublished, true)
			)
		);

	if (blocks.length === 0) return [];

	const isPriority = await isPriorityStudent(coachId, studentId);

	// Filter blocks the student currently has access to
	const accessibleBlockIds: string[] = [];
	for (const block of blocks) {
		if (isPriority && block.priorityBookingOpenAt && block.priorityBookingOpenAt <= now) {
			accessibleBlockIds.push(block.id);
		} else if (block.bookingOpenAt && block.bookingOpenAt <= now) {
			accessibleBlockIds.push(block.id);
		} else if (!block.bookingOpenAt && !block.priorityBookingOpenAt) {
			// No booking window set — published block is immediately open to all
			accessibleBlockIds.push(block.id);
		}
	}

	if (accessibleBlockIds.length === 0) return [];

	const rows = await db
		.select()
		.from(lessonSlots)
		.where(
			and(
				inArray(lessonSlots.availabilityBlockId, accessibleBlockIds),
				eq(lessonSlots.status, 'available')
			)
		);

	return rows as LessonSlot[];
}

// ---- Priority / repeat student ----

export async function isPriorityStudent(coachId: string, studentId: string): Promise<boolean> {
	// A student is priority if they have at least one confirmed past booking with this coach
	const now = new Date();
	const result = await db
		.select({ id: bookingRequests.id })
		.from(bookingRequests)
		.innerJoin(lessonSlots, eq(bookingRequests.slotId, lessonSlots.id))
		.where(
			and(
				eq(bookingRequests.coachId, coachId),
				eq(bookingRequests.studentId, studentId),
				eq(bookingRequests.status, 'confirmed'),
				lt(lessonSlots.startTime, now)
			)
		)
		.limit(1);
	return result.length > 0;
}

// ---- Booking ----

export async function bookSlot(
	slotId: string,
	studentId: string,
	coachId: string,
	notes?: string
): Promise<BookingRequest> {
	const now = new Date();

	// Auto-confirm — slot is published so coach already approved availability
	await db
		.update(lessonSlots)
		.set({ status: 'confirmed', studentId, bookedAt: now })
		.where(eq(lessonSlots.id, slotId));

	const [booking] = await db
		.insert(bookingRequests)
		.values({
			slotId,
			studentId,
			coachId,
			status: 'confirmed',
			respondedAt: now,
			notes: notes ?? null
		})
		.returning();

	// TODO: send notification to coach via notifications service

	return booking as BookingRequest;
}

export async function respondToBooking(
	bookingId: string,
	status: 'confirmed' | 'declined'
): Promise<BookingRequest | null> {
	const [booking] = await db
		.update(bookingRequests)
		.set({ status, respondedAt: new Date() })
		.where(eq(bookingRequests.id, bookingId))
		.returning();

	if (!booking) return null;

	// Update slot status accordingly
	const slotStatus = status === 'confirmed' ? 'confirmed' : 'available';
	await db
		.update(lessonSlots)
		.set({
			status: slotStatus,
			...(status === 'declined' && { studentId: null, bookedAt: null })
		})
		.where(eq(lessonSlots.id, booking.slotId));

	return booking as BookingRequest;
}

export async function cancelBooking(bookingId: string): Promise<BookingRequest | null> {
	const [booking] = await db
		.update(bookingRequests)
		.set({ status: 'cancelled', respondedAt: new Date() })
		.where(eq(bookingRequests.id, bookingId))
		.returning();

	if (!booking) return null;

	// Free up the slot
	await db
		.update(lessonSlots)
		.set({ status: 'available', studentId: null, bookedAt: null })
		.where(eq(lessonSlots.id, booking.slotId));

	return booking as BookingRequest;
}

export async function getBookingById(id: string): Promise<BookingRequest | null> {
	const rows = await db
		.select()
		.from(bookingRequests)
		.where(eq(bookingRequests.id, id))
		.limit(1);
	return (rows[0] as BookingRequest) ?? null;
}

export async function getBookingsForCoach(coachId: string): Promise<BookingWithDetails[]> {
	const rows = await db
		.select({
			booking: bookingRequests,
			slot: lessonSlots,
			student: { displayName: users.displayName, avatarUrl: users.avatarUrl }
		})
		.from(bookingRequests)
		.innerJoin(lessonSlots, eq(bookingRequests.slotId, lessonSlots.id))
		.innerJoin(users, eq(bookingRequests.studentId, users.id))
		.where(eq(bookingRequests.coachId, coachId));

	return rows.map((r) => ({
		...(r.booking as BookingRequest),
		slot: r.slot as LessonSlot,
		studentDisplayName: r.student.displayName,
		studentAvatarUrl: r.student.avatarUrl
	}));
}

export async function getBookingsForStudent(studentId: string): Promise<BookingRequest[]> {
	const rows = await db
		.select()
		.from(bookingRequests)
		.where(eq(bookingRequests.studentId, studentId));
	return rows as BookingRequest[];
}

// ---- Booking Interest ----

export async function registerInterest(
	availabilityBlockId: string,
	studentId: string
): Promise<BookingInterest> {
	// Upsert — ignore conflict if already registered
	const [row] = await db
		.insert(bookingInterests)
		.values({ availabilityBlockId, studentId })
		.onConflictDoNothing()
		.returning();

	// If already existed, fetch it
	if (!row) {
		const existing = await db
			.select()
			.from(bookingInterests)
			.where(
				and(
					eq(bookingInterests.availabilityBlockId, availabilityBlockId),
					eq(bookingInterests.studentId, studentId)
				)
			)
			.limit(1);
		return existing[0] as BookingInterest;
	}

	return row as BookingInterest;
}

// ---- Event Interest (waiting list) ----

export async function registerEventInterest(
	eventId: string,
	coachId: string,
	studentId: string
): Promise<EventInterest> {
	const [row] = await db
		.insert(eventInterests)
		.values({ eventId, coachId, studentId })
		.onConflictDoNothing()
		.returning();

	if (!row) {
		const existing = await db
			.select()
			.from(eventInterests)
			.where(
				and(
					eq(eventInterests.eventId, eventId),
					eq(eventInterests.coachId, coachId),
					eq(eventInterests.studentId, studentId)
				)
			)
			.limit(1);
		return existing[0] as EventInterest;
	}

	return row as EventInterest;
}

export async function checkEventInterest(
	eventId: string,
	coachId: string,
	studentId: string
): Promise<boolean> {
	const rows = await db
		.select({ id: eventInterests.id })
		.from(eventInterests)
		.where(
			and(
				eq(eventInterests.eventId, eventId),
				eq(eventInterests.coachId, coachId),
				eq(eventInterests.studentId, studentId)
			)
		)
		.limit(1);
	return rows.length > 0;
}

export async function cancelEventInterest(
	eventId: string,
	coachId: string,
	studentId: string
): Promise<boolean> {
	const rows = await db
		.delete(eventInterests)
		.where(
			and(
				eq(eventInterests.eventId, eventId),
				eq(eventInterests.coachId, coachId),
				eq(eventInterests.studentId, studentId)
			)
		)
		.returning({ id: eventInterests.id });
	return rows.length > 0;
}

export async function getEventInterestCount(eventId: string, coachId: string): Promise<number> {
	const rows = await db
		.select({ id: eventInterests.id })
		.from(eventInterests)
		.where(
			and(eq(eventInterests.eventId, eventId), eq(eventInterests.coachId, coachId))
		);
	return rows.length;
}

// ---- Invisible Blocks ----

export async function checkInvisibleBlock(coachId: string, studentId: string): Promise<boolean> {
	const block = await db
		.select({ id: invisibleBlocks.id })
		.from(invisibleBlocks)
		.where(
			and(eq(invisibleBlocks.coachId, coachId), eq(invisibleBlocks.studentId, studentId))
		)
		.limit(1);
	return block.length > 0;
}

export async function getInvisibleBlocksForCoach(coachId: string): Promise<
	Array<InvisibleBlock & { studentDisplayName: string; studentAvatarUrl: string | null }>
> {
	const rows = await db
		.select({
			block: invisibleBlocks,
			student: { displayName: users.displayName, avatarUrl: users.avatarUrl }
		})
		.from(invisibleBlocks)
		.innerJoin(users, eq(invisibleBlocks.studentId, users.id))
		.where(eq(invisibleBlocks.coachId, coachId));

	return rows.map((r) => ({
		...(r.block as InvisibleBlock),
		studentDisplayName: r.student.displayName,
		studentAvatarUrl: r.student.avatarUrl
	}));
}

export async function createInvisibleBlock(
	coachId: string,
	studentId: string
): Promise<InvisibleBlock> {
	const [row] = await db
		.insert(invisibleBlocks)
		.values({ coachId, studentId })
		.onConflictDoNothing()
		.returning();

	if (!row) {
		const existing = await db
			.select()
			.from(invisibleBlocks)
			.where(
				and(eq(invisibleBlocks.coachId, coachId), eq(invisibleBlocks.studentId, studentId))
			)
			.limit(1);
		return existing[0] as InvisibleBlock;
	}

	return row as InvisibleBlock;
}

export async function removeInvisibleBlock(id: string, coachId: string): Promise<boolean> {
	const result = await db
		.delete(invisibleBlocks)
		.where(and(eq(invisibleBlocks.id, id), eq(invisibleBlocks.coachId, coachId)))
		.returning({ id: invisibleBlocks.id });
	return result.length > 0;
}

// ---- Ownership checks ----

export async function verifyCoachOwnsBlock(
	coachId: string,
	blockId: string
): Promise<boolean> {
	const rows = await db
		.select({ id: availabilityBlocks.id })
		.from(availabilityBlocks)
		.where(and(eq(availabilityBlocks.id, blockId), eq(availabilityBlocks.coachId, coachId)))
		.limit(1);
	return rows.length > 0;
}

export async function verifyCoachLinkedToEvent(coachId: string, eventId: string): Promise<boolean> {
	const rows = await db
		.select({ id: coachEvents.id })
		.from(coachEvents)
		.where(and(eq(coachEvents.eventId, eventId), eq(coachEvents.coachId, coachId)))
		.limit(1);
	return rows.length > 0;
}

export async function verifyCoachOwnsBooking(
	coachId: string,
	bookingId: string
): Promise<boolean> {
	const rows = await db
		.select({ id: bookingRequests.id })
		.from(bookingRequests)
		.where(
			and(eq(bookingRequests.id, bookingId), eq(bookingRequests.coachId, coachId))
		)
		.limit(1);
	return rows.length > 0;
}

export async function verifyStudentOwnsBooking(
	studentId: string,
	bookingId: string
): Promise<boolean> {
	const rows = await db
		.select({ id: bookingRequests.id })
		.from(bookingRequests)
		.where(
			and(eq(bookingRequests.id, bookingId), eq(bookingRequests.studentId, studentId))
		)
		.limit(1);
	return rows.length > 0;
}

// ---- Coach-initiated Booking ----

/**
 * Find a student by email, or create a stub account (no password).
 * Returns the user row and whether it was newly created.
 */
export async function findOrCreateStudent(
	email: string,
	displayName?: string
): Promise<{ id: string; displayName: string; avatarUrl: string | null; created: boolean }> {
	const existing = await db
		.select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
		.from(users)
		.where(eq(users.email, email.toLowerCase()))
		.limit(1);

	if (existing.length > 0) {
		return { ...existing[0], created: false };
	}

	const [row] = await db
		.insert(users)
		.values({
			id: crypto.randomUUID(),
			email: email.toLowerCase(),
			displayName: displayName || email.split('@')[0],
			role: 'student'
		})
		.returning({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl });

	return { ...row, created: true };
}

/**
 * Coach books a slot for a student by email.
 * Finds or creates the student, ensures a coach_students link,
 * and creates the booking.
 */
export async function coachBookSlot(
	coachId: string,
	input: CoachBookSlotInput
): Promise<CoachBookSlotResult> {
	// Verify the coach owns this slot
	const slotCoachId = await getCoachIdForSlot(input.slotId);
	if (slotCoachId !== coachId) {
		throw new Error('SLOT_NOT_OWNED');
	}

	// Check slot is available
	const slotRows = await db
		.select()
		.from(lessonSlots)
		.where(eq(lessonSlots.id, input.slotId))
		.limit(1);

	if (slotRows.length === 0) throw new Error('SLOT_NOT_FOUND');
	if (slotRows[0].status !== 'available') throw new Error('SLOT_NOT_AVAILABLE');

	// Find or create student
	const student = await findOrCreateStudent(input.studentEmail, input.studentDisplayName);

	// Ensure coach_students relationship exists
	await db
		.insert(coachStudents)
		.values({ coachId, studentId: student.id })
		.onConflictDoNothing();

	// Book the slot
	const now = new Date();
	await db
		.update(lessonSlots)
		.set({ status: 'confirmed', studentId: student.id, bookedAt: now })
		.where(eq(lessonSlots.id, input.slotId));

	const [booking] = await db
		.insert(bookingRequests)
		.values({
			slotId: input.slotId,
			studentId: student.id,
			coachId,
			status: 'confirmed',
			respondedAt: now,
			notes: input.notes ?? null
		})
		.returning();

	return {
		booking: {
			...(booking as BookingRequest),
			slot: slotRows[0] as LessonSlot,
			studentDisplayName: student.displayName,
			studentAvatarUrl: student.avatarUrl
		},
		studentCreated: student.created
	};
}

/** Get the coachId for a slot (via block) */
export async function getCoachIdForSlot(slotId: string): Promise<string | null> {
	const rows = await db
		.select({ coachId: availabilityBlocks.coachId })
		.from(lessonSlots)
		.innerJoin(availabilityBlocks, eq(lessonSlots.availabilityBlockId, availabilityBlocks.id))
		.where(eq(lessonSlots.id, slotId))
		.limit(1);
	return rows[0]?.coachId ?? null;
}

/** Verify a slot is available and booking is currently open for this student */
export async function verifySlotBookable(
	slotId: string,
	studentId: string
): Promise<{ ok: boolean; reason?: string }> {
	const slotRows = await db
		.select({ slot: lessonSlots, block: availabilityBlocks })
		.from(lessonSlots)
		.innerJoin(availabilityBlocks, eq(lessonSlots.availabilityBlockId, availabilityBlocks.id))
		.where(eq(lessonSlots.id, slotId))
		.limit(1);

	if (slotRows.length === 0) return { ok: false, reason: 'Slot not found' };

	const { slot, block } = slotRows[0];

	if (slot.status !== 'available') return { ok: false, reason: 'Slot not available' };

	const now = new Date();
	const isPriority = await isPriorityStudent(block.coachId, studentId);

	const priorityOpen = block.priorityBookingOpenAt && block.priorityBookingOpenAt <= now;
	const generalOpen = block.bookingOpenAt && block.bookingOpenAt <= now;

	if (isPriority && priorityOpen) return { ok: true };
	if (generalOpen) return { ok: true };
	if (!block.bookingOpenAt && !block.priorityBookingOpenAt) return { ok: true };

	return { ok: false, reason: 'Booking not yet open' };
}

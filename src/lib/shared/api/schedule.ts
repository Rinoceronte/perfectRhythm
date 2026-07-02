import type {
	ApiResponse,
	Event,
	AvailabilityBlock,
	LessonSlot,
	BookingRequest,
	BookingInterest,
	EventInterest,
	InvisibleBlock,
	BlockWithSlots,
	CoachBookSlotResult
} from '$lib/shared/types';
import type {
	CreateEventInput,
	UpdateEventInput,
	CreateAvailabilityBlockInput,
	UpdateAvailabilityBlockInput,
	BookSlotInput,
	RegisterInterestInput,
	RegisterEventInterestInput,
	RespondToBookingInput,
	CreateInvisibleBlockInput,
	CoachBookSlotInput
} from '$lib/shared/validation/schedule';

// ---- Events ----

const EVENTS_BASE = '/api/v1/events';

export async function fetchEvents(): Promise<ApiResponse<Event[]>> {
	const res = await fetch(EVENTS_BASE);
	return res.json();
}

export async function createEvent(input: CreateEventInput): Promise<ApiResponse<Event>> {
	const res = await fetch(EVENTS_BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function updateEvent(
	id: string,
	input: UpdateEventInput
): Promise<ApiResponse<Event>> {
	const res = await fetch(`${EVENTS_BASE}/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function deleteEvent(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
	const res = await fetch(`${EVENTS_BASE}/${id}`, { method: 'DELETE' });
	return res.json();
}

// ---- Availability ----

const AVAIL_BASE = '/api/v1/availability';

export async function fetchAvailabilityBlocks(): Promise<ApiResponse<AvailabilityBlock[]>> {
	const res = await fetch(AVAIL_BASE);
	return res.json();
}

export async function fetchPublishedBlocksForCoach(
	coachId: string,
	startDate: string,
	endDate: string
): Promise<ApiResponse<AvailabilityBlock[]>> {
	const params = new URLSearchParams({ coachId, startDate, endDate });
	const res = await fetch(`${AVAIL_BASE}?${params}`);
	return res.json();
}

export async function createAvailabilityBlock(
	input: CreateAvailabilityBlockInput
): Promise<ApiResponse<AvailabilityBlock>> {
	const res = await fetch(AVAIL_BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function updateAvailabilityBlock(
	id: string,
	input: UpdateAvailabilityBlockInput
): Promise<ApiResponse<AvailabilityBlock>> {
	const res = await fetch(`${AVAIL_BASE}/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function publishAvailabilityBlock(id: string): Promise<ApiResponse<BlockWithSlots>> {
	const res = await fetch(`${AVAIL_BASE}/${id}/publish`, { method: 'POST' });
	return res.json();
}

export async function deleteAvailabilityBlock(
	id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
	const res = await fetch(`${AVAIL_BASE}/${id}`, { method: 'DELETE' });
	return res.json();
}

// ---- Slots ----

const SLOTS_BASE = '/api/v1/schedule/slots';

export async function fetchSlotsForBlock(blockId: string): Promise<ApiResponse<LessonSlot[]>> {
	const params = new URLSearchParams({ blockId });
	const res = await fetch(`${SLOTS_BASE}?${params}`);
	return res.json();
}

export async function fetchSlotsForStudent(
	coachId: string,
	scheduleDate: string
): Promise<ApiResponse<LessonSlot[]>> {
	const params = new URLSearchParams({ coachId, scheduleDate });
	const res = await fetch(`${SLOTS_BASE}?${params}`);
	return res.json();
}

// ---- Booking ----

export async function fetchBookings(): Promise<ApiResponse<BookingRequest[]>> {
	const res = await fetch('/api/v1/schedule/bookings');
	return res.json();
}

export async function registerInterest(
	input: RegisterInterestInput
): Promise<ApiResponse<BookingInterest>> {
	const res = await fetch('/api/v1/schedule/interest', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function registerEventInterest(
	input: RegisterEventInterestInput
): Promise<ApiResponse<EventInterest>> {
	const res = await fetch('/api/v1/schedule/event-interest', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function checkEventInterest(
	eventId: string,
	coachId: string
): Promise<ApiResponse<{ interested: boolean }>> {
	const params = new URLSearchParams({ eventId, coachId });
	const res = await fetch(`/api/v1/schedule/event-interest?${params}`);
	return res.json();
}

export async function cancelEventInterest(
	eventId: string,
	coachId: string
): Promise<ApiResponse<{ deleted: boolean }>> {
	const params = new URLSearchParams({ eventId, coachId });
	const res = await fetch(`/api/v1/schedule/event-interest?${params}`, { method: 'DELETE' });
	return res.json();
}

export async function coachBookSlot(input: CoachBookSlotInput): Promise<ApiResponse<CoachBookSlotResult>> {
	const res = await fetch('/api/v1/schedule/bookings', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function bookSlot(input: BookSlotInput): Promise<ApiResponse<BookingRequest>> {
	const res = await fetch('/api/v1/schedule/book', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function respondToBooking(
	id: string,
	input: RespondToBookingInput
): Promise<ApiResponse<BookingRequest>> {
	const res = await fetch(`/api/v1/schedule/bookings/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function cancelBooking(id: string): Promise<ApiResponse<BookingRequest>> {
	const res = await fetch(`/api/v1/schedule/bookings/${id}`, { method: 'DELETE' });
	return res.json();
}

// ---- Invisible Blocks ----

const IB_BASE = '/api/v1/coach/invisible-blocks';

export async function fetchInvisibleBlocks(): Promise<
	ApiResponse<Array<InvisibleBlock & { studentDisplayName: string; studentAvatarUrl: string | null }>>
> {
	const res = await fetch(IB_BASE);
	return res.json();
}

export async function createInvisibleBlock(
	input: CreateInvisibleBlockInput
): Promise<ApiResponse<InvisibleBlock>> {
	const res = await fetch(IB_BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function removeInvisibleBlock(
	id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
	const res = await fetch(`${IB_BASE}/${id}`, { method: 'DELETE' });
	return res.json();
}

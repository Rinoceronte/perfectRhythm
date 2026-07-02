import { z } from 'zod';

// ---- Events ----

export const CreateEventSchema = z.object({
	name: z.string().min(1).max(200),
	location: z.string().min(1).max(200),
	city: z.string().min(1).max(100),
	stateOrRegion: z.string().min(1).max(100),
	country: z.string().min(1).max(100).default('US'),
	lat: z.number().nullable().optional(),
	lng: z.number().nullable().optional(),
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
	isRecurring: z.boolean().default(false),
	isLocal: z.boolean().default(false),
	externalEventId: z.string().nullable().optional()
});

export const UpdateEventSchema = CreateEventSchema.partial();

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

// ---- Availability Blocks ----

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const CreateAvailabilityBlockSchema = z.object({
	eventId: z.string().uuid().nullable().optional(),
	location: z.string().max(200).nullable().optional(),
	scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
	startTime: z.string().regex(timeRegex, 'Must be HH:MM (24h)'),
	endTime: z.string().regex(timeRegex, 'Must be HH:MM (24h)'),
	lessonDurationMinutes: z.number().int().min(15).max(180).default(45),
	gapMinutes: z.number().int().min(0).max(60).default(0),
	maxStudents: z.number().int().min(1).nullable().optional(),
	bookingOpenAt: z.string().datetime().nullable().optional(),
	priorityBookingOpenAt: z.string().datetime().nullable().optional()
});

export const UpdateAvailabilityBlockSchema = CreateAvailabilityBlockSchema.partial();

export type CreateAvailabilityBlockInput = z.infer<typeof CreateAvailabilityBlockSchema>;
export type UpdateAvailabilityBlockInput = z.infer<typeof UpdateAvailabilityBlockSchema>;

// ---- Booking ----

export const BookSlotSchema = z.object({
	slotId: z.string().uuid(),
	coachId: z.string().uuid(),
	notes: z.string().max(500).optional()
});

export const RegisterInterestSchema = z.object({
	availabilityBlockId: z.string().uuid()
});

export const RegisterEventInterestSchema = z.object({
	eventId: z.string().uuid(),
	coachId: z.string().uuid()
});

export const RespondToBookingSchema = z.object({
	status: z.enum(['confirmed', 'declined'])
});

export type BookSlotInput = z.infer<typeof BookSlotSchema>;
export type RegisterInterestInput = z.infer<typeof RegisterInterestSchema>;
export type RegisterEventInterestInput = z.infer<typeof RegisterEventInterestSchema>;
export type RespondToBookingInput = z.infer<typeof RespondToBookingSchema>;

// ---- Invisible Blocks ----

export const CreateInvisibleBlockSchema = z.object({
	studentId: z.string().uuid()
});

export type CreateInvisibleBlockInput = z.infer<typeof CreateInvisibleBlockSchema>;

// ---- Coach-initiated Booking ----

export const CoachBookSlotSchema = z.object({
	slotId: z.string().uuid(),
	studentEmail: z.string().email(),
	studentDisplayName: z.string().min(1).max(200).optional(),
	notes: z.string().max(500).optional()
});

export type CoachBookSlotInput = z.infer<typeof CoachBookSlotSchema>;

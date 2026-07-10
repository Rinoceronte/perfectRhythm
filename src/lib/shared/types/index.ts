export type UserRole = 'student' | 'coach' | 'admin';

export type CompetitionLevel =
	| 'newcomer'
	| 'novice'
	| 'intermediate'
	| 'advanced'
	| 'allstar'
	| 'champion';

export const COMPETITION_LEVELS: CompetitionLevel[] = [
	'newcomer',
	'novice',
	'intermediate',
	'advanced',
	'allstar',
	'champion'
];

// ---- Site settings (white-label branding) ----

/** Public profile of the teacher who owns this deployment */
export interface SiteOwner {
	id: string;
	displayName: string;
	bio: string | null;
	avatarUrl: string | null;
}

export interface SiteSettings {
	siteName: string;
	tagline: string | null;
	logoPath: string | null;
	logoUrl: string | null;
	accentColor: string | null;
	owner: SiteOwner | null;
}

export interface ApiSuccess<T> {
	data: T;
	error: null;
}

export interface ApiError {
	data: null;
	error: {
		code: string;
		message: string;
		status: number;
	};
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---- Skills ----

export type SkillSource = 'coach' | 'ai' | 'student';

export interface SkillCategory {
	id: string;
	name: string;
	createdAt: Date;
}

export interface SkillDefinition {
	id: string;
	name: string;
	categoryId: string;
	createdAt: Date;
}

export interface SkillDefinitionWithCategory extends SkillDefinition {
	categoryName: string;
}

export interface StudentSkill {
	id: string;
	coachStudentId: string;
	skillDefinitionId: string;
	currentScore: number;
	effortToImprove: number;
	improvementBenefit: number;
	priorityScore: number;
	coachPriority: number | null;
	studentPriority: number | null;
	source: SkillSource;
	coachLocked: boolean;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/** Get effective priority for a single skill (used when manual priority is set). */
export function getManualPriority(
	skill: StudentSkill
): { value: number; source: 'coach' | 'student' } | null {
	if (skill.coachPriority != null) return { value: skill.coachPriority, source: 'coach' };
	if (skill.studentPriority != null) return { value: skill.studentPriority, source: 'student' };
	return null;
}

/**
 * Assign effective priorities to a list of skills.
 * All priorities are on a 1–10 scale where 1 = focus first.
 * Manual priorities (coach > student) override the auto-calculated value.
 * Auto priorities are spread across 1–10 relative to each other:
 *   highest priorityScore → 1, lowest → 10, same score → same number.
 * Manual and auto share the same scale so priority 1 means the same thing.
 */
export function assignEffectivePriorities(
	skills: StudentSkill[]
): Map<string, { value: number; source: 'coach' | 'student' | 'system' }> {
	const result = new Map<string, { value: number; source: 'coach' | 'student' | 'system' }>();

	// Collect system skills (no manual override)
	const systemSkills: { id: string; priorityScore: number }[] = [];
	for (const skill of skills) {
		const manual = getManualPriority(skill);
		if (manual) {
			result.set(skill.id, manual);
		} else {
			systemSkills.push({ id: skill.id, priorityScore: skill.priorityScore });
		}
	}

	if (systemSkills.length === 0) return result;

	// Find the distinct scores and map them to 1–10
	const distinctScores = [...new Set(systemSkills.map((s) => s.priorityScore))].sort(
		(a, b) => b - a
	);

	// If only one distinct score, all are priority 1
	if (distinctScores.length === 1) {
		for (const s of systemSkills) {
			result.set(s.id, { value: 1, source: 'system' });
		}
		return result;
	}

	// Map distinct scores evenly across 1–10
	// Highest score → 1, lowest score → 10
	const scoreToRank = new Map<number, number>();
	for (let i = 0; i < distinctScores.length; i++) {
		const rank = Math.round(1 + (i / (distinctScores.length - 1)) * 9);
		scoreToRank.set(distinctScores[i], rank);
	}

	for (const s of systemSkills) {
		result.set(s.id, { value: scoreToRank.get(s.priorityScore)!, source: 'system' });
	}

	return result;
}

export interface StudentSkillWithDetails extends StudentSkill {
	skillName: string;
	categoryId: string;
	categoryName: string;
}

export interface SkillSuggestion {
	skillId: string;
	currentScore: number;
	effortToImprove: number;
	improvementBenefit: number;
	reasoning: string;
}

// ---- Schedule ----

export interface Event {
	id: string;
	name: string;
	location: string;
	city: string;
	stateOrRegion: string;
	country: string;
	lat: number | null;
	lng: number | null;
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
	isRecurring: boolean;
	isLocal: boolean;
	externalEventId: string | null;
	createdAt: Date;
}

export interface AvailabilityBlock {
	id: string;
	coachId: string;
	eventId: string | null;
	location: string | null;
	scheduleDate: string; // YYYY-MM-DD (2am rule)
	startTime: string; // HH:MM 24h
	endTime: string; // HH:MM 24h
	lessonDurationMinutes: number;
	gapMinutes: number;
	maxStudents: number | null;
	bookingOpenAt: Date | null;
	priorityBookingOpenAt: Date | null;
	isPublished: boolean;
	createdAt: Date;
}

export type LessonSlotStatus = 'available' | 'pending' | 'confirmed' | 'cancelled';

export interface LessonSlot {
	id: string;
	availabilityBlockId: string;
	startTime: Date;
	endTime: Date;
	status: LessonSlotStatus;
	studentId: string | null;
	bookedAt: Date | null;
}

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';

export interface BookingRequest {
	id: string;
	slotId: string;
	studentId: string;
	coachId: string;
	status: BookingStatus;
	requestedAt: Date;
	respondedAt: Date | null;
	notes: string | null;
	studentNotesBefore: string | null;
	studentNotesAfter: string | null;
}

export interface InvisibleBlock {
	id: string;
	coachId: string;
	studentId: string;
	createdAt: Date;
}

export interface EventInterest {
	id: string;
	eventId: string;
	coachId: string;
	studentId: string;
	createdAt: Date;
}

export interface BookingInterest {
	id: string;
	availabilityBlockId: string;
	studentId: string;
	createdAt: Date;
}

/** Slot enriched with block context, for display */
export interface SlotWithBlock extends LessonSlot {
	block: AvailabilityBlock;
}

/** Booking enriched with slot + student info for coach view */
export interface BookingWithDetails extends BookingRequest {
	slot: LessonSlot;
	studentDisplayName: string;
	studentAvatarUrl: string | null;
}

/** Availability block with its generated slots for coach builder */
export interface BlockWithSlots extends AvailabilityBlock {
	slots: LessonSlot[];
	event: Event | null;
}

/** Result of a coach-initiated booking (find-or-create student flow) */
export interface CoachBookSlotResult {
	booking: BookingWithDetails;
	studentCreated: boolean;
}

// ---- Video ----

export type VideoStatus =
	| 'uploading'
	| 'processing'
	| 'ready'
	| 'review_in_progress'
	| 'reviewed'
	| 'error';
export type ReviewStatus = 'pending' | 'in_progress' | 'compositing' | 'complete';
export type AnnotationType = 'draw' | 'arrow' | 'text' | 'highlight';

export interface DrawAnnotation {
	path: string; // SVG path data from Fabric.js
}

export interface TextAnnotation {
	text: string;
	fontSize: number;
	x: number;
	y: number;
}

export interface Annotation {
	id: string;
	timestampMs: number;
	type: AnnotationType;
	data: DrawAnnotation | TextAnnotation;
	durationMs: number;
	color: string;
}

export interface Video {
	id: string;
	studentId: string;
	title: string;
	description: string | null;
	supabaseStoragePath: string;
	muxAssetId: string | null;
	muxPlaybackId: string | null;
	durationSeconds: number | null;
	status: VideoStatus;
	createdAt: Date;
}

export interface VideoReview {
	id: string;
	videoId: string;
	coachId: string;
	status: ReviewStatus;
	annotations: Annotation[];
	voiceTrackPath: string | null;
	compositeMuxAssetId: string | null;
	compositeMuxPlaybackId: string | null;
	createdAt: Date;
	completedAt: Date | null;
}

export interface VideoWithReviews extends Video {
	reviews: VideoReview[];
}

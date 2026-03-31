import {
	pgTable,
	pgEnum,
	uuid,
	text,
	integer,
	boolean,
	real,
	timestamp,
	jsonb,
	unique,
	index
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---- Enums ----

export const userRoleEnum = pgEnum('user_role', ['student', 'coach', 'admin']);

export const skillSourceEnum = pgEnum('skill_source', ['coach', 'ai', 'student']);

// skillCategoryEnum removed — categories are now in skill_categories table

export const competitionLevelEnum = pgEnum('competition_level', [
	'newcomer',
	'novice',
	'intermediate',
	'advanced',
	'allstar',
	'champion'
]);

export const videoStatusEnum = pgEnum('video_status', [
	'uploading',
	'processing',
	'ready',
	'review_in_progress',
	'reviewed',
	'error'
]);

export const reviewStatusEnum = pgEnum('review_status', [
	'pending',
	'in_progress',
	'compositing',
	'complete'
]);

// ---- Tables ----

export const users = pgTable('users', {
	id: uuid('id').primaryKey(),
	email: text('email').notNull().unique(),
	displayName: text('display_name').notNull(),
	role: userRoleEnum('role').notNull().default('student'),
	avatarUrl: text('avatar_url'),
	bio: text('bio'),
	leaderLevel: competitionLevelEnum('leader_level'),
	followerLevel: competitionLevelEnum('follower_level'),
	yearsDancing: integer('years_dancing'),
	phone: text('phone'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const coachStudents = pgTable(
	'coach_students',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		coachId: uuid('coach_id')
			.notNull()
			.references(() => users.id),
		studentId: uuid('student_id')
			.notNull()
			.references(() => users.id),
		status: text('status').notNull().default('active'),
		notes: text('notes'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [unique('coach_students_coach_student_unique').on(t.coachId, t.studentId)]
);

export const skillCategories = pgTable('skill_categories', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const skillDefinitions = pgTable(
	'skill_definitions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => skillCategories.id),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [unique('skill_definitions_name_category_unique').on(t.name, t.categoryId)]
);

export const studentSkills = pgTable(
	'student_skills',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		coachStudentId: uuid('coach_student_id')
			.notNull()
			.references(() => coachStudents.id),
		skillDefinitionId: uuid('skill_definition_id')
			.notNull()
			.references(() => skillDefinitions.id),
		currentScore: integer('current_score').notNull().default(5),
		effortToImprove: integer('effort_to_improve').notNull().default(5),
		improvementBenefit: integer('improvement_benefit').notNull().default(5),
		priorityScore: integer('priority_score').notNull().default(5),
		source: skillSourceEnum('source').notNull().default('student'),
		coachLocked: boolean('coach_locked').notNull().default(false),
		coachPriority: integer('coach_priority'),
		studentPriority: integer('student_priority'),
		notes: text('notes'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(t) => [
		unique('student_skills_coach_student_definition_unique').on(t.coachStudentId, t.skillDefinitionId),
		index('idx_student_skills_coach_student').on(t.coachStudentId),
		index('idx_student_skills_priority').on(t.coachStudentId, t.priorityScore.desc())
	]
);

export const videos = pgTable(
	'videos',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => users.id),
		title: text('title').notNull(),
		description: text('description'),
		supabaseStoragePath: text('supabase_storage_path').notNull(),
		muxAssetId: text('mux_asset_id'),
		muxPlaybackId: text('mux_playback_id'),
		durationSeconds: integer('duration_seconds'),
		status: videoStatusEnum('status').notNull().default('uploading'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [index('idx_videos_student').on(t.studentId)]
);

export const videoReviews = pgTable('video_reviews', {
	id: uuid('id').primaryKey().defaultRandom(),
	videoId: uuid('video_id')
		.notNull()
		.references(() => videos.id),
	coachId: uuid('coach_id')
		.notNull()
		.references(() => users.id),
	status: reviewStatusEnum('status').notNull().default('pending'),
	annotations: jsonb('annotations').notNull().default([]),
	voiceTrackPath: text('voice_track_path'),
	compositeMuxAssetId: text('composite_mux_asset_id'),
	compositeMuxPlaybackId: text('composite_mux_playback_id'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	completedAt: timestamp('completed_at')
});

export const events = pgTable('events', {
	id: uuid('id').primaryKey().defaultRandom(),
	coachId: uuid('coach_id')
		.notNull()
		.references(() => users.id),
	name: text('name').notNull(),
	location: text('location').notNull(),
	city: text('city').notNull(),
	stateOrRegion: text('state_or_region').notNull(),
	country: text('country').notNull().default('US'),
	lat: real('lat'),
	lng: real('lng'),
	startDate: text('start_date').notNull(),
	endDate: text('end_date').notNull(),
	isRecurring: boolean('is_recurring').notNull().default(false),
	externalEventId: text('external_event_id'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const availabilityBlocks = pgTable('availability_blocks', {
	id: uuid('id').primaryKey().defaultRandom(),
	coachId: uuid('coach_id')
		.notNull()
		.references(() => users.id),
	eventId: uuid('event_id').references(() => events.id),
	location: text('location'),
	scheduleDate: text('schedule_date').notNull(),
	startTime: text('start_time').notNull(),
	endTime: text('end_time').notNull(),
	lessonDurationMinutes: integer('lesson_duration_minutes').notNull().default(45),
	gapMinutes: integer('gap_minutes').notNull().default(0),
	maxStudents: integer('max_students'),
	bookingOpenAt: timestamp('booking_open_at'),
	priorityBookingOpenAt: timestamp('priority_booking_open_at'),
	isPublished: boolean('is_published').notNull().default(false),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const lessonSlots = pgTable(
	'lesson_slots',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		availabilityBlockId: uuid('availability_block_id')
			.notNull()
			.references(() => availabilityBlocks.id),
		startTime: timestamp('start_time').notNull(),
		endTime: timestamp('end_time').notNull(),
		status: text('status').notNull().default('available'),
		studentId: uuid('student_id').references(() => users.id),
		bookedAt: timestamp('booked_at')
	},
	(t) => [
		index('idx_slots_availability').on(t.availabilityBlockId, t.status),
		index('idx_slots_time')
			.on(t.startTime)
			.where(sql`${t.status} = 'available'`)
	]
);

export const bookingRequests = pgTable(
	'booking_requests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slotId: uuid('slot_id')
			.notNull()
			.references(() => lessonSlots.id),
		studentId: uuid('student_id')
			.notNull()
			.references(() => users.id),
		coachId: uuid('coach_id')
			.notNull()
			.references(() => users.id),
		status: text('status').notNull().default('pending'),
		requestedAt: timestamp('requested_at').defaultNow().notNull(),
		respondedAt: timestamp('responded_at'),
		notes: text('notes')
	},
	(t) => [
		index('idx_bookings_coach').on(t.coachId, t.status),
		index('idx_bookings_student').on(t.studentId, t.status)
	]
);

export const bookingInterests = pgTable(
	'booking_interests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		availabilityBlockId: uuid('availability_block_id')
			.notNull()
			.references(() => availabilityBlocks.id),
		studentId: uuid('student_id')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [
		unique('booking_interests_block_student_unique').on(t.availabilityBlockId, t.studentId)
	]
);

export const eventInterests = pgTable(
	'event_interests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id),
		coachId: uuid('coach_id')
			.notNull()
			.references(() => users.id),
		studentId: uuid('student_id')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [
		unique('event_interests_event_coach_student_unique').on(t.eventId, t.coachId, t.studentId),
		index('idx_event_interests_coach_event').on(t.coachId, t.eventId)
	]
);

export const invisibleBlocks = pgTable(
	'invisible_blocks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		coachId: uuid('coach_id')
			.notNull()
			.references(() => users.id),
		studentId: uuid('student_id')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [
		unique('invisible_blocks_coach_student_unique').on(t.coachId, t.studentId),
		index('idx_invisible_blocks_lookup').on(t.coachId, t.studentId)
	]
);

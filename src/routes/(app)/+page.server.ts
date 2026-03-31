import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, videos, videoReviews, bookingRequests, lessonSlots, coachStudents, studentSkills, skillDefinitions, skillCategories } from '$lib/server/db/schema';
import { eq, and, desc, gte, or, sql } from 'drizzle-orm';
import { subMonths } from 'date-fns';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return { role: null as never };

	const role = (user.user_metadata?.role as 'student' | 'coach') ?? 'student';
	const userId = user.id;

	if (role === 'coach') {
		const now = new Date();

		// Pending booking requests
		const pendingBookings = await db
			.select({
				booking: bookingRequests,
				slot: lessonSlots,
				student: { displayName: users.displayName }
			})
			.from(bookingRequests)
			.innerJoin(lessonSlots, eq(bookingRequests.slotId, lessonSlots.id))
			.innerJoin(users, eq(bookingRequests.studentId, users.id))
			.where(and(eq(bookingRequests.coachId, userId), eq(bookingRequests.status, 'pending')))
			.orderBy(lessonSlots.startTime)
			.limit(10);

		// Upcoming confirmed lessons
		const upcomingLessons = await db
			.select({
				booking: bookingRequests,
				slot: lessonSlots,
				student: { displayName: users.displayName }
			})
			.from(bookingRequests)
			.innerJoin(lessonSlots, eq(bookingRequests.slotId, lessonSlots.id))
			.innerJoin(users, eq(bookingRequests.studentId, users.id))
			.where(
				and(
					eq(bookingRequests.coachId, userId),
					eq(bookingRequests.status, 'confirmed'),
					gte(lessonSlots.startTime, now)
				)
			)
			.orderBy(lessonSlots.startTime)
			.limit(5);

		// Videos awaiting review (pending reviews assigned to this coach)
		const pendingReviews = await db
			.select({
				review: videoReviews,
				video: { id: videos.id, title: videos.title },
				student: { displayName: users.displayName }
			})
			.from(videoReviews)
			.innerJoin(videos, eq(videoReviews.videoId, videos.id))
			.innerJoin(users, eq(videos.studentId, users.id))
			.where(
				and(
					eq(videoReviews.coachId, userId),
					or(eq(videoReviews.status, 'pending'), eq(videoReviews.status, 'in_progress'))
				)
			)
			.orderBy(desc(videoReviews.createdAt))
			.limit(5);

		// Active student count — confirmed lesson in last 6 months
		const sixMonthsAgo = subMonths(new Date(), 6).toISOString();
		const activeStudentRows = await db
			.select({ studentId: coachStudents.studentId })
			.from(coachStudents)
			.where(
				and(
					eq(coachStudents.coachId, userId),
					sql`EXISTS (
						SELECT 1 FROM ${bookingRequests}
						INNER JOIN ${lessonSlots} ON ${bookingRequests.slotId} = ${lessonSlots.id}
						WHERE ${bookingRequests.studentId} = ${coachStudents.studentId}
						  AND ${bookingRequests.coachId} = ${coachStudents.coachId}
						  AND ${bookingRequests.status} = 'confirmed'
						  AND ${lessonSlots.startTime} >= ${sixMonthsAgo}
					)`
				)
			);

		return {
			role: 'coach' as const,
			displayName: user.user_metadata?.display_name ?? 'Coach',
			pendingBookings: pendingBookings.map((r) => ({
				id: r.booking.id,
				studentName: r.student.displayName,
				startTime: r.slot.startTime.toISOString(),
				endTime: r.slot.endTime.toISOString()
			})),
			upcomingLessons: upcomingLessons.map((r) => ({
				id: r.booking.id,
				studentName: r.student.displayName,
				startTime: r.slot.startTime.toISOString(),
				endTime: r.slot.endTime.toISOString()
			})),
			pendingReviews: pendingReviews.map((r) => ({
				reviewId: r.review.id,
				videoId: r.video.id,
				videoTitle: r.video.title,
				studentName: r.student.displayName,
				status: r.review.status
			})),
			activeStudentCount: activeStudentRows.length
		};
	}

	// Student dashboard
	const now = new Date();

	// My upcoming confirmed bookings
	const upcomingLessons = await db
		.select({
			booking: bookingRequests,
			slot: lessonSlots,
			coach: { displayName: users.displayName }
		})
		.from(bookingRequests)
		.innerJoin(lessonSlots, eq(bookingRequests.slotId, lessonSlots.id))
		.innerJoin(users, eq(bookingRequests.coachId, users.id))
		.where(
			and(
				eq(bookingRequests.studentId, userId),
				or(eq(bookingRequests.status, 'confirmed'), eq(bookingRequests.status, 'pending')),
				gte(lessonSlots.startTime, now)
			)
		)
		.orderBy(lessonSlots.startTime)
		.limit(5);

	// My skills (across all coach relationships)
	const myCoachRelationships = await db
		.select({ id: coachStudents.id })
		.from(coachStudents)
		.where(eq(coachStudents.studentId, userId));

	const relationshipIds = myCoachRelationships.map((r) => r.id);

	let skillsByCategory: { categoryName: string; avgScore: number; skills: { name: string; currentScore: number }[] }[] = [];
	if (relationshipIds.length > 0) {
		const { inArray } = await import('drizzle-orm');
		const skillRows = await db
			.select({
				name: skillDefinitions.name,
				categoryName: skillCategories.name,
				currentScore: studentSkills.currentScore
			})
			.from(studentSkills)
			.innerJoin(skillDefinitions, eq(studentSkills.skillDefinitionId, skillDefinitions.id))
			.innerJoin(skillCategories, eq(skillDefinitions.categoryId, skillCategories.id))
			.where(inArray(studentSkills.coachStudentId, relationshipIds))
			.orderBy(skillCategories.name, skillDefinitions.name);

		// Group by category with average score
		const grouped = new Map<string, { name: string; currentScore: number }[]>();
		for (const row of skillRows) {
			const list = grouped.get(row.categoryName) ?? [];
			list.push({ name: row.name, currentScore: row.currentScore });
			grouped.set(row.categoryName, list);
		}
		skillsByCategory = [...grouped.entries()].map(([categoryName, skills]) => ({
			categoryName,
			avgScore: Math.round((skills.reduce((sum, s) => sum + s.currentScore, 0) / skills.length) * 10) / 10,
			skills
		}));
	}

	// My recent videos
	const recentVideos = await db
		.select()
		.from(videos)
		.where(eq(videos.studentId, userId))
		.orderBy(desc(videos.createdAt))
		.limit(5);

	return {
		role: 'student' as const,
		displayName: user.user_metadata?.display_name ?? 'Student',
		upcomingLessons: upcomingLessons.map((r) => ({
			id: r.booking.id,
			coachName: r.coach.displayName,
			startTime: r.slot.startTime.toISOString(),
			endTime: r.slot.endTime.toISOString(),
			status: r.booking.status
		})),
		skillsByCategory,
		recentVideos: recentVideos.map((v) => ({
			id: v.id,
			title: v.title,
			status: v.status,
			muxPlaybackId: v.muxPlaybackId,
			createdAt: v.createdAt!.toISOString()
		}))
	};
};

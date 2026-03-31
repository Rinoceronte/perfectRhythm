import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, coachStudents, bookingRequests, lessonSlots } from '$lib/server/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { subMonths } from 'date-fns';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/login');

	const role = (user.user_metadata?.role as 'student' | 'coach') ?? 'student';
	if (role !== 'coach') redirect(303, '/');

	const sixMonthsAgo = subMonths(new Date(), 6);

	// Get all students with their last confirmed lesson date
	const students = await db
		.select({
			coachStudentId: coachStudents.id,
			studentId: coachStudents.studentId,
			createdAt: coachStudents.createdAt,
			displayName: users.displayName,
			email: users.email,
			avatarUrl: users.avatarUrl,
			lastLessonAt: sql<string | null>`
				(SELECT MAX(${lessonSlots.startTime})
				 FROM ${bookingRequests}
				 INNER JOIN ${lessonSlots} ON ${bookingRequests.slotId} = ${lessonSlots.id}
				 WHERE ${bookingRequests.studentId} = ${coachStudents.studentId}
				   AND ${bookingRequests.coachId} = ${coachStudents.coachId}
				   AND ${bookingRequests.status} = 'confirmed')
			`.as('last_lesson_at')
		})
		.from(coachStudents)
		.innerJoin(users, eq(coachStudents.studentId, users.id))
		.where(eq(coachStudents.coachId, user.id))
		.orderBy(users.displayName);

	return {
		students: students.map((s) => {
			const lastLesson = s.lastLessonAt ? new Date(s.lastLessonAt) : null;
			return {
				coachStudentId: s.coachStudentId,
				studentId: s.studentId,
				displayName: s.displayName,
				email: s.email,
				avatarUrl: s.avatarUrl,
				since: s.createdAt!.toISOString(),
				lastLessonAt: lastLesson?.toISOString() ?? null,
				isActive: lastLesson != null && lastLesson >= sixMonthsAgo
			};
		})
	};
};

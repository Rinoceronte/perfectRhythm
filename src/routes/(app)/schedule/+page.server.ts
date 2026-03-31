import type { PageServerLoad } from './$types';
import {
	getEventsForCoach,
	getBlocksForCoach,
	getBookingsForCoach,
	getInvisibleBlocksForCoach
} from '$lib/server/services/schedule';
import { db } from '$lib/server/db';
import { coachStudents, users, events } from '$lib/server/db/schema';
import { eq, gte } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	// Layout already redirects unauthenticated users; user is always defined here
	const role = user!.user_metadata?.role as string;

	if (role === 'coach') {
		const [events, blocks, bookings, invisibleBlockList] = await Promise.all([
			getEventsForCoach(user!.id),
			getBlocksForCoach(user!.id),
			getBookingsForCoach(user!.id),
			getInvisibleBlocksForCoach(user!.id)
		]);

		return {
			role: 'coach' as const,
			events,
			blocks,
			bookings,
			invisibleBlocks: invisibleBlockList
		};
	}

	// Student — load all coaches on the platform with their upcoming events
	const allCoaches = await db
		.select({
			coachId: users.id,
			coachName: users.displayName,
			coachAvatarUrl: users.avatarUrl,
			coachBio: users.bio
		})
		.from(users)
		.where(eq(users.role, 'coach'));

	// Load upcoming events for all coaches (for filtering)
	const today = new Date().toISOString().slice(0, 10);
	const upcomingEvents = await db
		.select({
			id: events.id,
			coachId: events.coachId,
			name: events.name,
			location: events.location,
			city: events.city,
			stateOrRegion: events.stateOrRegion,
			startDate: events.startDate,
			endDate: events.endDate
		})
		.from(events)
		.where(gte(events.endDate, today));

	return {
		role: 'student' as const,
		coaches: allCoaches,
		upcomingEvents
	};
};

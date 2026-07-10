import type { PageServerLoad } from './$types';
import {
	getEventsForCoach,
	getBlocksForCoach,
	getBookingsForCoach,
	getInvisibleBlocksForCoach
} from '$lib/server/services/schedule';
import { getOwnerCoach } from '$lib/server/services/site-settings';
import { db } from '$lib/server/db';
import { events, coachEvents } from '$lib/server/db/schema';
import { eq, and, gte } from 'drizzle-orm';

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

	// Student — single-teacher deployment: load the owner coach and their upcoming events
	const owner = await getOwnerCoach();
	if (!owner) {
		return { role: 'student' as const, coach: null, upcomingEvents: [] };
	}

	const coachRow = {
		coachId: owner.id,
		coachName: owner.displayName,
		coachAvatarUrl: owner.avatarUrl,
		coachBio: owner.bio
	};

	const today = new Date().toISOString().slice(0, 10);
	const upcomingEvents = await db
		.select({
			id: events.id,
			coachId: coachEvents.coachId,
			name: events.name,
			location: events.location,
			city: events.city,
			stateOrRegion: events.stateOrRegion,
			startDate: events.startDate,
			endDate: events.endDate
		})
		.from(coachEvents)
		.innerJoin(events, eq(coachEvents.eventId, events.id))
		.where(and(eq(coachEvents.coachId, owner.id), gte(events.endDate, today)));

	return {
		role: 'student' as const,
		coach: coachRow,
		upcomingEvents
	};
};

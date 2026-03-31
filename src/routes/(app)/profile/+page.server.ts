import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/login');

	const [profile] = await db
		.select({
			id: users.id,
			displayName: users.displayName,
			email: users.email,
			bio: users.bio,
			leaderLevel: users.leaderLevel,
			followerLevel: users.followerLevel,
			yearsDancing: users.yearsDancing
		})
		.from(users)
		.where(eq(users.id, user.id))
		.limit(1);

	return { profile };
};

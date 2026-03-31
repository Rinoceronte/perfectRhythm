import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { updateProfileSchema } from '$lib/shared/validation/profile';

/**
 * PATCH /api/v1/profile
 * Update the current user's profile fields (bio, dance roles/levels, years dancing).
 */
export const PATCH: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json();
	const parsed = updateProfileSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.issues[0].message);
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	const input = parsed.data;

	if (input.bio !== undefined) updates.bio = input.bio;
	if (input.leaderLevel !== undefined) updates.leaderLevel = input.leaderLevel;
	if (input.followerLevel !== undefined) updates.followerLevel = input.followerLevel;
	if (input.yearsDancing !== undefined) updates.yearsDancing = input.yearsDancing;

	const [updated] = await db
		.update(users)
		.set(updates)
		.where(eq(users.id, user.id))
		.returning({
			id: users.id,
			bio: users.bio,
			leaderLevel: users.leaderLevel,
			followerLevel: users.followerLevel,
			yearsDancing: users.yearsDancing
		});

	return ok(updated);
};

import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq, ilike } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') {
		return err('FORBIDDEN', 'Coach access required', 403);
	}

	const email = url.searchParams.get('email')?.toLowerCase();
	const name = url.searchParams.get('name');

	if (email) {
		const rows = await db
			.select({ id: users.id, displayName: users.displayName })
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (rows.length === 0) return ok(null);
		return ok({ displayName: rows[0].displayName });
	}

	if (name && name.length >= 2) {
		const rows = await db
			.select({ email: users.email, displayName: users.displayName })
			.from(users)
			.where(ilike(users.displayName, `%${name}%`))
			.limit(10);

		return ok(rows);
	}

	return err('VALIDATION_ERROR', 'Provide email or name parameter');
};

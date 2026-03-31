import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { registerInterest } from '$lib/server/services/schedule';
import { RegisterInterestSchema } from '$lib/shared/validation/schedule';

/**
 * POST /api/v1/schedule/interest
 * Register a student's interest in a block before it opens.
 * Students only.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = RegisterInterestSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const interest = await registerInterest(parsed.data.availabilityBlockId, user.id);
	return ok(interest);
};

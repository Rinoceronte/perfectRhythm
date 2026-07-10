import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { updateSiteSettingsSchema } from '$lib/shared/validation/settings';
import { updateSiteSettings } from '$lib/server/services/site-settings';

/**
 * PATCH /api/v1/settings
 * Update this deployment's white-label branding. Coach only.
 */
export const PATCH: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);
	if (user.user_metadata?.role !== 'coach') {
		return err('FORBIDDEN', 'Only the coach can update site settings', 403);
	}

	const body = await request.json().catch(() => null);
	const parsed = updateSiteSettingsSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.issues[0].message);
	}

	const updated = await updateSiteSettings(parsed.data);
	return ok(updated);
};

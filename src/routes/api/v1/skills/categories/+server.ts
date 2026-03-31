import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { getCategories, getOrCreateCategory } from '$lib/server/services/skills';
import { CreateSkillCategorySchema } from '$lib/shared/validation/skills';

/**
 * GET /api/v1/skills/categories
 * Returns all skill categories. Any authenticated user may call this.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const categories = await getCategories();
	return ok(categories);
};

/**
 * POST /api/v1/skills/categories
 * Creates a new skill category. Any authenticated user may create categories.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = CreateSkillCategorySchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const category = await getOrCreateCategory(parsed.data.name);
	return ok(category);
};

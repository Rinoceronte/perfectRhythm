import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { getDefinitions, getOrCreateDefinition } from '$lib/server/services/skills';
import { CreateSkillDefinitionSchema } from '$lib/shared/validation/skills';

/**
 * GET /api/v1/skills/definitions?categoryId=
 * Returns all skill definitions with category name. Optionally filter by categoryId.
 * Any authenticated user may call this.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const categoryId = url.searchParams.get('categoryId') ?? undefined;
	const definitions = await getDefinitions(categoryId);
	return ok(definitions);
};

/**
 * POST /api/v1/skills/definitions
 * Creates a new skill definition. Any authenticated user may create definitions.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = CreateSkillDefinitionSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const definition = await getOrCreateDefinition(parsed.data.name, parsed.data.categoryId);
	return ok(definition);
};

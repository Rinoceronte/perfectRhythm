import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { verifyCoachOwnsRelationship, applyAiSuggestions } from '$lib/server/services/skills';
import { aiSuggestSkills } from '$lib/server/services/ai';
import { AiSuggestSchema } from '$lib/shared/validation/skills';

/**
 * POST /api/v1/skills/ai-suggest
 * Triggers AI skill suggestion for a coach-student pair.
 * Only coaches may invoke this. Suggestions are applied immediately (skipping locked skills).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = AiSuggestSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const { coachStudentId, videoReviewTranscript } = parsed.data;

	const isCoach = await verifyCoachOwnsRelationship(user.id, coachStudentId);
	if (!isCoach) return err('FORBIDDEN', 'Only coaches can trigger AI suggestions', 403);

	const suggestions = await aiSuggestSkills(coachStudentId, videoReviewTranscript);
	await applyAiSuggestions(coachStudentId, suggestions);

	return ok({ applied: suggestions.length, suggestions });
};

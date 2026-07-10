import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { ConfirmUploadSchema } from '$lib/shared/validation/video';
import { confirmUploadAndIngest, isVideoOwner } from '$lib/server/services/video';
import { db } from '$lib/server/db';
import { videos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/v1/videos/confirm
 * Client calls this after successfully uploading to Supabase Storage.
 * Updates the storage path, then kicks off Mux ingest.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = ConfirmUploadSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const { videoId, supabaseStoragePath } = parsed.data;

	// Ensure caller owns this video
	const owns = await isVideoOwner(user.id, videoId);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	// Update storage path to the confirmed path
	await db.update(videos).set({ supabaseStoragePath }).where(eq(videos.id, videoId));

	// Kick off Mux ingest
	const video = await confirmUploadAndIngest(locals.supabase, videoId);

	return ok(video);
};

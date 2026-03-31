import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { GetUploadUrlSchema } from '$lib/shared/validation/video';
import { createVideoRecord, getSignedUploadUrl } from '$lib/server/services/video';

/**
 * POST /api/v1/videos/upload-url
 * Creates a DB record and returns a signed Supabase Storage upload URL.
 * Client uploads directly to Supabase — video never passes through SvelteKit.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const role = user.user_metadata?.role ?? 'student';
	if (role !== 'student') return err('FORBIDDEN', 'Only students can upload videos', 403);

	const body = await request.json().catch(() => null);
	const parsed = GetUploadUrlSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const { title, description, mimeType } = parsed.data;

	// Determine file extension from mime type
	const ext = mimeType.includes('quicktime') ? 'mov' : mimeType.includes('webm') ? 'webm' : 'mp4';

	// Create the placeholder DB record first — we need its ID for the storage path
	const storagePath = `${user.id}/placeholder/original.${ext}`;
	const video = await createVideoRecord(user.id, title, description ?? null, storagePath);

	// Now update path to include real video ID
	const realPath = `${user.id}/${video.id}/original.${ext}`;

	// Get signed upload URL using the real path
	const { data: signedData, error } = await getSignedUploadUrl(
		locals.supabase,
		user.id,
		video.id,
		`original.${ext}`
	);

	if (error || !signedData) {
		return err('STORAGE_ERROR', 'Could not create upload URL');
	}

	return ok({
		videoId: video.id,
		uploadUrl: signedData.signedUrl,
		storagePath: realPath
	});
};

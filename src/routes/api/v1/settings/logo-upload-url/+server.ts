import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { z } from 'zod';
import { getBrandingUploadUrl, isAllowedLogoExtension } from '$lib/server/services/site-settings';

const logoUploadSchema = z.object({
	ext: z.string().min(1).max(10)
});

/**
 * POST /api/v1/settings/logo-upload-url
 * Returns a signed Supabase Storage upload URL for a new logo. Coach only.
 * Client uploads directly to Supabase, then saves the path via PATCH /api/v1/settings.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);
	if (user.user_metadata?.role !== 'coach') {
		return err('FORBIDDEN', 'Only the coach can update site settings', 403);
	}

	const body = await request.json().catch(() => null);
	const parsed = logoUploadSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.issues[0].message);

	const ext = parsed.data.ext;
	if (!isAllowedLogoExtension(ext)) {
		return err('VALIDATION_ERROR', 'Logo must be a png, jpg, jpeg, svg, or webp file');
	}

	const { data: signedData, error, path } = await getBrandingUploadUrl(ext);
	if (error || !signedData) {
		return err('STORAGE_ERROR', 'Could not create upload URL');
	}

	return ok({ uploadUrl: signedData.signedUrl, storagePath: path });
};

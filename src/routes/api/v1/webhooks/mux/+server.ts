import type { RequestHandler } from '@sveltejs/kit';
import { err } from '$lib/server/utils/api-response';
import { verifyMuxWebhook } from '$lib/server/services/video/mux';
import { markVideoReady, markVideoError, markReviewCompositeDone } from '$lib/server/services/video';
import { MUX_WEBHOOK_SECRET } from '$env/static/private';

/**
 * POST /api/v1/webhooks/mux
 * Handles Mux webhook events. No session auth — verified by signature.
 */
export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();
	const signature = request.headers.get('mux-signature') ?? '';

	if (!verifyMuxWebhook(rawBody, signature, MUX_WEBHOOK_SECRET)) {
		return err('UNAUTHORIZED', 'Invalid webhook signature', 401);
	}

	let event: { type: string; data: Record<string, unknown> };
	try {
		event = JSON.parse(rawBody);
	} catch {
		return err('BAD_REQUEST', 'Invalid JSON body');
	}

	const { type, data } = event;

	if (type === 'video.asset.ready') {
		const assetId = data.id as string;
		const playbackIds = data.playback_ids as Array<{ id: string }> | undefined;
		const playbackId = playbackIds?.[0]?.id ?? '';
		const durationSeconds = Math.floor((data.duration as number | undefined) ?? 0);

		await markVideoReady(assetId, playbackId, durationSeconds);

		// Notify student that their video is ready
		// (We find the video via assetId in the notification service lookup)
		// Notification routing handled by notifications service — not inline here
	}

	if (type === 'video.asset.errored') {
		const assetId = data.id as string;
		await markVideoError(assetId);
	}

	// Composite video is ready (uploaded by our compositing worker)
	// We use the passthrough field to carry the reviewId
	if (type === 'video.asset.ready' && data.passthrough) {
		const passthrough = JSON.parse(data.passthrough as string) as { reviewId?: string };
		if (passthrough.reviewId) {
			const playbackIds = data.playback_ids as Array<{ id: string }> | undefined;
			const playbackId = playbackIds?.[0]?.id ?? '';
			await markReviewCompositeDone(passthrough.reviewId, data.id as string, playbackId);
		}
	}

	return new globalThis.Response(null, { status: 200 });
};

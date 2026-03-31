import Mux from '@mux/mux-node';
import { MUX_TOKEN_ID, MUX_TOKEN_SECRET } from '$env/static/private';

const mux = new Mux({
	tokenId: MUX_TOKEN_ID,
	tokenSecret: MUX_TOKEN_SECRET
});

export async function ingestVideo(supabasePublicUrl: string): Promise<{ assetId: string }> {
	const asset = await mux.video.assets.create({
		inputs: [{ url: supabasePublicUrl }],
		playback_policies: ['signed'],
		mp4_support: 'capped-1080p'
	});
	return { assetId: asset.id };
}

export async function getAsset(assetId: string) {
	return mux.video.assets.retrieve(assetId);
}

export async function deleteAsset(assetId: string): Promise<void> {
	await mux.video.assets.delete(assetId);
}

export function getPlaybackUrl(playbackId: string): string {
	return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function getThumbnailUrl(playbackId: string, time = 0): string {
	return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
}

export function verifyMuxWebhook(
	rawBody: string,
	signature: string,
	secret: string
): boolean {
	try {
		const webhooks = new Mux.Webhooks(secret);
		webhooks.verifySignature(rawBody, { 'mux-signature': signature });
		return true;
	} catch {
		return false;
	}
}

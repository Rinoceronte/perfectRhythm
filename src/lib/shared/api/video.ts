import type { ApiResponse, Video, VideoReview, VideoWithReviews, Annotation } from '$lib/shared/types';

const BASE = '/api/v1/videos';

// ---- Upload flow ----

export async function getUploadUrl(input: {
	title: string;
	description?: string | null;
	mimeType?: string;
}): Promise<ApiResponse<{ videoId: string; uploadUrl: string; storagePath: string }>> {
	const res = await fetch(`${BASE}/upload-url`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function confirmUpload(input: {
	videoId: string;
	supabaseStoragePath: string;
}): Promise<ApiResponse<Video>> {
	const res = await fetch(`${BASE}/confirm`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

/**
 * Upload a file directly to Supabase Storage using a signed URL.
 * Calls onProgress with 0-100 as upload progresses.
 */
export async function uploadToSignedUrl(
	signedUrl: string,
	file: File,
	onProgress?: (pct: number) => void
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', signedUrl);
		xhr.setRequestHeader('Content-Type', file.type);

		if (onProgress) {
			xhr.upload.addEventListener('progress', (e) => {
				if (e.lengthComputable) {
					onProgress(Math.round((e.loaded / e.total) * 100));
				}
			});
		}

		xhr.addEventListener('load', () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else reject(new Error(`Upload failed: ${xhr.status}`));
		});
		xhr.addEventListener('error', () => reject(new Error('Upload network error')));
		xhr.send(file);
	});
}

// ---- Video CRUD ----

export async function fetchVideos(): Promise<ApiResponse<Video[]>> {
	const res = await fetch(BASE);
	return res.json();
}

export async function fetchVideo(id: string): Promise<ApiResponse<VideoWithReviews>> {
	const res = await fetch(`${BASE}/${id}`);
	return res.json();
}

export async function deleteVideo(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
	const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
	return res.json();
}

// ---- Reviews ----

export async function fetchReviews(videoId: string): Promise<ApiResponse<VideoReview[]>> {
	const res = await fetch(`${BASE}/${videoId}/reviews`);
	return res.json();
}

export async function createReview(videoId: string): Promise<ApiResponse<VideoReview>> {
	const res = await fetch(`${BASE}/${videoId}/reviews`, { method: 'POST' });
	return res.json();
}

export async function saveAnnotations(
	videoId: string,
	reviewId: string,
	annotations: Annotation[],
	voiceTrackPath?: string | null
): Promise<ApiResponse<VideoReview>> {
	const res = await fetch(`${BASE}/${videoId}/reviews/${reviewId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ annotations, voiceTrackPath })
	});
	return res.json();
}

export async function completeReview(
	videoId: string,
	reviewId: string
): Promise<ApiResponse<VideoReview>> {
	const res = await fetch(`${BASE}/${videoId}/reviews/${reviewId}/complete`, { method: 'POST' });
	return res.json();
}

export async function getVoiceUploadUrl(
	videoId: string,
	reviewId: string
): Promise<ApiResponse<{ uploadUrl: string; storagePath: string }>> {
	const res = await fetch(`${BASE}/${videoId}/reviews/${reviewId}/voice-url`, { method: 'POST' });
	return res.json();
}

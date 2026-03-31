// Video review and annotation business logic

import { db } from '$lib/server/db';
import { videos, videoReviews, coachStudents } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { ingestVideo } from '$lib/server/services/video/mux';
import type { Annotation, Video, VideoReview } from '$lib/shared/types';

// ---- Supabase Storage helpers ----

export function getSignedUploadUrl(
	supabase: ReturnType<typeof createSupabaseServerClient>,
	studentId: string,
	videoId: string,
	filename = 'original.mp4'
) {
	const path = `${studentId}/${videoId}/${filename}`;
	return supabase.storage.from('videos-original').createSignedUploadUrl(path);
}

export function getPublicVideoUrl(
	supabase: ReturnType<typeof createSupabaseServerClient>,
	storagePath: string
) {
	// Returns a signed URL valid for 1 hour — used to pass to Mux for ingest
	return supabase.storage.from('videos-original').createSignedUrl(storagePath, 3600);
}

export async function getVoiceTrackUploadUrl(
	supabase: ReturnType<typeof createSupabaseServerClient>,
	coachId: string,
	reviewId: string
) {
	const path = `${coachId}/${reviewId}/voice.webm`;
	const result = await supabase.storage.from('voice-tracks').createSignedUploadUrl(path);
	return { ...result, path };
}

// ---- Video CRUD ----

export async function createVideoRecord(
	studentId: string,
	title: string,
	description: string | null,
	storagePath: string
): Promise<Video> {
	const [video] = await db
		.insert(videos)
		.values({
			studentId,
			title,
			description,
			supabaseStoragePath: storagePath,
			status: 'uploading'
		})
		.returning();
	return video as Video;
}

export async function getVideoById(id: string): Promise<Video | null> {
	const video = await db.query.videos.findFirst({
		where: eq(videos.id, id)
	});
	return (video as Video) ?? null;
}

export async function getVideosForStudent(studentId: string): Promise<Video[]> {
	return db.query.videos.findMany({
		where: eq(videos.studentId, studentId),
		orderBy: [desc(videos.createdAt)]
	}) as Promise<Video[]>;
}

export async function getVideosForCoach(coachId: string): Promise<Video[]> {
	// Coach sees videos belonging to their students
	const relationships = await db.query.coachStudents.findMany({
		where: and(eq(coachStudents.coachId, coachId), eq(coachStudents.status, 'active'))
	});
	const studentIds = relationships.map((r) => r.studentId);
	if (studentIds.length === 0) return [];

	return db.query.videos.findMany({
		where: (v, { inArray }) => inArray(v.studentId, studentIds),
		orderBy: [desc(videos.createdAt)]
	}) as Promise<Video[]>;
}

export async function confirmUploadAndIngest(
	supabase: ReturnType<typeof createSupabaseServerClient>,
	videoId: string,
	studentId: string
): Promise<Video> {
	// Mark as processing
	await db.update(videos).set({ status: 'processing' }).where(eq(videos.id, videoId));

	const video = await getVideoById(videoId);
	if (!video) throw new Error('Video not found');

	// Get a short-lived signed URL for Mux to pull from
	const { data: signedData, error } = await getPublicVideoUrl(supabase, video.supabaseStoragePath);
	if (error || !signedData) throw new Error('Could not create signed URL for Mux ingest');

	const { assetId } = await ingestVideo(signedData.signedUrl);

	const [updated] = await db
		.update(videos)
		.set({ muxAssetId: assetId })
		.where(eq(videos.id, videoId))
		.returning();
	return updated as Video;
}

export async function markVideoReady(
	assetId: string,
	playbackId: string,
	durationSeconds: number
): Promise<void> {
	await db
		.update(videos)
		.set({ muxPlaybackId: playbackId, durationSeconds, status: 'ready' })
		.where(eq(videos.muxAssetId, assetId));
}

export async function markVideoError(assetId: string): Promise<void> {
	await db.update(videos).set({ status: 'error' }).where(eq(videos.muxAssetId, assetId));
}

export async function deleteVideo(
	supabase: ReturnType<typeof createSupabaseServerClient>,
	videoId: string
): Promise<void> {
	const video = await getVideoById(videoId);
	if (!video) return;

	// Delete from Supabase Storage
	await supabase.storage.from('videos-original').remove([video.supabaseStoragePath]);

	// Delete from DB (cascades reviews via FK)
	await db.delete(videos).where(eq(videos.id, videoId));
}

// ---- Access control ----

/** Returns true if the user is the student who owns the video */
export async function isVideoOwner(userId: string, videoId: string): Promise<boolean> {
	const video = await getVideoById(videoId);
	return video?.studentId === userId;
}

/** Returns true if the coach has an active relationship with the video's student */
export async function coachCanAccessVideo(coachId: string, videoId: string): Promise<boolean> {
	const video = await getVideoById(videoId);
	if (!video) return false;

	const rel = await db.query.coachStudents.findFirst({
		where: and(
			eq(coachStudents.coachId, coachId),
			eq(coachStudents.studentId, video.studentId),
			eq(coachStudents.status, 'active')
		)
	});
	return !!rel;
}

// ---- Reviews ----

export async function createReview(videoId: string, coachId: string): Promise<VideoReview> {
	// Mark video as under review
	await db
		.update(videos)
		.set({ status: 'review_in_progress' })
		.where(eq(videos.id, videoId));

	const [review] = await db
		.insert(videoReviews)
		.values({
			videoId,
			coachId,
			status: 'in_progress',
			annotations: []
		})
		.returning();
	return review as VideoReview;
}

export async function getReviewsForVideo(videoId: string): Promise<VideoReview[]> {
	return db.query.videoReviews.findMany({
		where: eq(videoReviews.videoId, videoId),
		orderBy: [desc(videoReviews.createdAt)]
	}) as Promise<VideoReview[]>;
}

export async function getReviewById(reviewId: string): Promise<VideoReview | null> {
	const review = await db.query.videoReviews.findFirst({
		where: eq(videoReviews.id, reviewId)
	});
	return (review as VideoReview) ?? null;
}

export async function saveAnnotations(
	reviewId: string,
	annotations: Annotation[],
	voiceTrackPath?: string | null
): Promise<VideoReview> {
	const updates: Partial<typeof videoReviews.$inferInsert> = {
		annotations: annotations as unknown as typeof videoReviews.$inferInsert['annotations'],
		status: 'in_progress'
	};
	if (voiceTrackPath !== undefined) {
		updates.voiceTrackPath = voiceTrackPath;
	}

	const [review] = await db
		.update(videoReviews)
		.set(updates)
		.where(eq(videoReviews.id, reviewId))
		.returning();
	return review as VideoReview;
}

export async function completeReview(reviewId: string): Promise<VideoReview> {
	const [review] = await db
		.update(videoReviews)
		.set({ status: 'compositing' })
		.where(eq(videoReviews.id, reviewId))
		.returning();
	return review as VideoReview;
}

export async function markReviewCompositeDone(
	reviewId: string,
	compositeMuxAssetId: string,
	compositeMuxPlaybackId: string
): Promise<void> {
	await db
		.update(videoReviews)
		.set({
			status: 'complete',
			compositeMuxAssetId,
			compositeMuxPlaybackId,
			completedAt: new Date()
		})
		.where(eq(videoReviews.id, reviewId));

	// Mark the parent video as reviewed
	const review = await getReviewById(reviewId);
	if (review) {
		await db
			.update(videos)
			.set({ status: 'reviewed' })
			.where(eq(videos.id, review.videoId));
	}
}

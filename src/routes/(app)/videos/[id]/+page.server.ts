import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getVideoById,
	getReviewsForVideo,
	isVideoOwner,
	coachCanAccessVideo
} from '$lib/server/services/video';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) error(401, 'Not authenticated');

	const { id } = params;

	const video = await getVideoById(id);
	if (!video) error(404, 'Video not found');

	const role = user.user_metadata?.role ?? 'student';

	if (role === 'student') {
		if (video.studentId !== user.id) error(403, 'Access denied');
		const reviews = await getReviewsForVideo(id);
		return { video, reviews, role, userId: user.id };
	}

	// Coach
	const canAccess = await coachCanAccessVideo(user.id, id);
	if (!canAccess) error(403, 'Access denied');

	const allReviews = await getReviewsForVideo(id);
	const myReviews = allReviews.filter((r) => r.coachId === user.id);

	return { video, reviews: myReviews, role, userId: user.id };
};

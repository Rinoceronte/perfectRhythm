<script lang="ts">
	import type { PageData } from './$types';
	import type { VideoReview } from '$lib/shared/types';
	import VideoPlayer from '$lib/components/video/VideoPlayer.svelte';
	import VideoReviewStudio from '$lib/components/video/VideoReviewStudio.svelte';
import { createReview, deleteVideo } from '$lib/shared/api/video';

	let { data }: { data: PageData } = $props();

	let reviews = $state(data.reviews);
	let activeReview = $state<VideoReview | null>(null);
	let creatingReview = $state(false);
	let deleting = $state(false);
	let errorMsg = $state<string | null>(null);

	// Coach: open existing in-progress review or create new one
	async function openReviewStudio() {
		const existing = reviews.find((r) => r.status === 'in_progress');
		if (existing) {
			activeReview = existing;
			return;
		}
		creatingReview = true;
		errorMsg = null;
		const res = await createReview(data.video.id);
		creatingReview = false;
		if (res.error) {
			errorMsg = res.error.message;
			return;
		}
		activeReview = res.data;
		reviews = [res.data, ...reviews];
	}

	async function handleDelete() {
		if (!confirm('Delete this video and all reviews? This cannot be undone.')) return;
		deleting = true;
		const res = await deleteVideo(data.video.id);
		if (res.error) {
			errorMsg = res.error.message;
			deleting = false;
			return;
		}
		window.location.href = '/videos';
	}

	const STATUS_LABEL: Record<string, string> = {
		uploading:          'Uploading',
		processing:         'Processing…',
		ready:              'Ready',
		review_in_progress: 'In Review',
		reviewed:           'Reviewed',
		error:              'Error'
	};

	function formatDate(d: Date) {
		return new Date(d).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Student view: track playback time for annotation display on completed reviews
	let currentTimeMs = $state(0);
	let durationMs = $state(0);
</script>

<div class="max-w-4xl mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex items-start justify-between mb-4 gap-4">
		<div>
			<a href="/videos" class="text-sm text-blue-600 hover:underline">&larr; Back to Videos</a>
			<h1 class="text-xl font-bold text-gray-900 mt-1">{data.video.title}</h1>
			{#if data.video.description}
				<p class="text-sm text-gray-500 mt-0.5">{data.video.description}</p>
			{/if}
			<p class="text-xs text-gray-400 mt-1">
				{formatDate(data.video.createdAt)} ·
				<span>{STATUS_LABEL[data.video.status] ?? data.video.status}</span>
			</p>
		</div>

		<div class="flex gap-2 flex-shrink-0">
			{#if data.role === 'coach' && (data.video.status === 'ready' || data.video.status === 'review_in_progress')}
				<button
					onclick={openReviewStudio}
					disabled={creatingReview}
					class="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
				>
					{creatingReview ? 'Opening…' : reviews.some((r) => r.status === 'in_progress') ? 'Continue Review' : 'Start Review'}
				</button>
			{/if}
			{#if data.role === 'student'}
				<button
					onclick={handleDelete}
					disabled={deleting}
					class="px-3 py-1.5 rounded-md border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
				>
					{deleting ? 'Deleting…' : 'Delete'}
				</button>
			{/if}
		</div>
	</div>

	{#if errorMsg}
		<p class="mb-4 text-sm text-red-600">{errorMsg}</p>
	{/if}

	<!-- Coach: full review studio when a review is active -->
	{#if activeReview && data.role === 'coach'}
		<div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 min-h-[600px]">
			<VideoReviewStudio video={data.video} review={activeReview} />
		</div>

	<!-- Video is still processing -->
	{:else if data.video.status === 'uploading' || data.video.status === 'processing'}
		<div class="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
			<svg class="w-10 h-10 animate-spin opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
			</svg>
			<p class="text-sm">Your video is being processed. Check back shortly.</p>
		</div>

	<!-- Video is ready or reviewed — show player + reviews -->
	{:else if data.video.muxPlaybackId}
		<div class="flex flex-col gap-6">
			<!-- Player -->
			<div class="bg-black rounded-lg overflow-hidden">
				<VideoPlayer
					playbackId={data.video.muxPlaybackId}
					onTimeUpdate={(ms) => (currentTimeMs = ms)}
					onDurationReady={(ms) => (durationMs = ms)}
				/>
			</div>

			<!-- Reviews list -->
			{#if reviews.length > 0}
				<div>
					<h2 class="text-base font-semibold text-gray-800 mb-3">
						{data.role === 'coach' ? 'Your Reviews' : 'Coach Reviews'}
					</h2>
					<ul class="space-y-3">
						{#each reviews as review (review.id)}
							<li class="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
								<div class="flex items-center justify-between mb-2">
									<span class="text-sm font-medium text-gray-700">
										Review from {formatDate(review.createdAt)}
									</span>
									<span class="text-xs px-2 py-0.5 rounded-full font-medium
										{review.status === 'complete' ? 'bg-green-100 text-green-800' :
										 review.status === 'compositing' ? 'bg-blue-100 text-blue-800' :
										 'bg-yellow-100 text-yellow-800'}">
										{review.status === 'complete' ? 'Complete' :
										 review.status === 'compositing' ? 'Generating video…' :
										 review.status === 'in_progress' ? 'In progress' : review.status}
									</span>
								</div>

								{#if review.status === 'complete' && review.compositeMuxPlaybackId}
									<!-- Completed review: show composite video -->
									<div class="mt-2">
										<p class="text-xs text-gray-500 mb-2">Review video with annotations:</p>
										<div class="bg-black rounded overflow-hidden">
											<VideoPlayer playbackId={review.compositeMuxPlaybackId} />
										</div>
									</div>
								{:else if review.annotations.length > 0}
									<p class="text-xs text-gray-500">
										{review.annotations.length} annotation{review.annotations.length !== 1 ? 's' : ''}
									</p>
								{/if}

								{#if data.role === 'coach' && review.status === 'in_progress'}
									<button
										onclick={() => (activeReview = review)}
										class="mt-2 text-sm text-blue-600 hover:underline"
									>
										Continue this review →
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{:else if data.role === 'student'}
				<p class="text-sm text-gray-400 italic">No reviews yet — your coach will review this video soon.</p>
			{/if}
		</div>

	{:else if data.video.status === 'error'}
		<div class="text-center py-16 text-red-500">
			<p class="text-sm">There was an error processing this video. Please try uploading again.</p>
		</div>
	{/if}
</div>

<script lang="ts">
	import type { PageData } from './$types';
	import type { Video } from '$lib/shared/types';
	import VideoUploadForm from '$lib/components/video/VideoUploadForm.svelte';
	import { resolve } from '$app/paths';

	let { data }: { data: PageData } = $props();

	let videos = $state<Video[]>(data.videos);
	let showUpload = $state(false);

	const STATUS_LABEL: Record<string, string> = {
		uploading: 'Uploading',
		processing: 'Processing',
		ready: 'Ready',
		review_in_progress: 'In Review',
		reviewed: 'Reviewed',
		error: 'Error'
	};

	const STATUS_COLOR: Record<string, string> = {
		uploading: 'bg-yellow-100 text-yellow-800',
		processing: 'bg-blue-100 text-blue-800',
		ready: 'bg-green-100 text-green-800',
		review_in_progress: 'bg-purple-100 text-purple-800',
		reviewed: 'bg-gray-100 text-gray-700',
		error: 'bg-red-100 text-red-800'
	};

	function handleUploaded(videoId: string) {
		showUpload = false;
		videos = [
			{
				id: videoId,
				studentId: data.userId,
				title: '(processing…)',
				description: null,
				supabaseStoragePath: '',
				muxAssetId: null,
				muxPlaybackId: null,
				durationSeconds: null,
				status: 'processing',
				createdAt: new Date()
			},
			...videos
		];
	}

	function formatDate(d: Date) {
		return new Date(d).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatDuration(s: number | null) {
		if (!s) return '';
		const m = Math.floor(s / 60);
		const rem = s % 60;
		return `${m}:${rem.toString().padStart(2, '0')}`;
	}
</script>

<div class="mx-auto max-w-3xl px-4 py-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Videos</h1>
		{#if data.role === 'student'}
			<button
				onclick={() => (showUpload = !showUpload)}
				class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
			>
				{showUpload ? 'Cancel' : '+ Upload Video'}
			</button>
		{/if}
	</div>

	{#if showUpload}
		<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="mb-4 text-base font-semibold text-gray-800">Upload a new video</h2>
			<VideoUploadForm onUploaded={handleUploaded} />
		</div>
	{/if}

	{#if videos.length === 0}
		<div class="py-16 text-center text-gray-400">
			<svg class="mx-auto mb-3 h-12 w-12 opacity-40" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"
				/>
			</svg>
			<p class="text-sm">
				{data.role === 'student'
					? 'Upload your first video to get coach feedback.'
					: 'No student videos yet.'}
			</p>
		</div>
	{:else}
		<ul class="space-y-3">
			{#each videos as video (video.id)}
				<li>
					<a
						href={resolve('/(app)/videos/[id]', { id: video.id })}
						class="flex gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow"
					>
						<!-- Thumbnail -->
						<div class="h-16 w-24 flex-shrink-0 overflow-hidden rounded bg-gray-100">
							{#if video.muxPlaybackId}
								<img
									src="https://image.mux.com/{video.muxPlaybackId}/thumbnail.jpg?time=0"
									alt={video.title}
									class="h-full w-full object-cover"
								/>
							{:else}
								<div class="flex h-full w-full items-center justify-center text-gray-300">
									<svg class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
										<path d="M8 5v14l11-7z" />
									</svg>
								</div>
							{/if}
						</div>

						<!-- Info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-start justify-between gap-2">
								<p class="truncate font-medium text-gray-900">{video.title}</p>
								<span
									class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {STATUS_COLOR[
										video.status
									] ?? 'bg-gray-100 text-gray-600'}"
								>
									{STATUS_LABEL[video.status] ?? video.status}
								</span>
							</div>
							{#if video.description}
								<p class="mt-0.5 truncate text-sm text-gray-500">{video.description}</p>
							{/if}
							<div class="mt-1 flex gap-3 text-xs text-gray-400">
								<span>{formatDate(video.createdAt)}</span>
								{#if video.durationSeconds}
									<span>{formatDuration(video.durationSeconds)}</span>
								{/if}
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

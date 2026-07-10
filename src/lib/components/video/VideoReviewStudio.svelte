<script lang="ts">
	import { onMount } from 'svelte';
	import type { Annotation, AnnotationType, Video, VideoReview } from '$lib/shared/types';
	import VideoPlayer from './VideoPlayer.svelte';
	import AnnotationCanvas from './AnnotationCanvas.svelte';
	import ReviewToolbar from './ReviewToolbar.svelte';
	import VoiceRecorder from './VoiceRecorder.svelte';
	import AnnotationTimeline from './AnnotationTimeline.svelte';
	import {
		saveAnnotations,
		completeReview,
		getVoiceUploadUrl,
		uploadToSignedUrl
	} from '$lib/shared/api/video';

	interface Props {
		video: Video;
		review: VideoReview;
	}

	let { video, review }: Props = $props();

	// ---- State ----
	let currentTimeMs = $state(0);
	let durationMs = $state(0);
	let activeTool = $state<AnnotationType | 'select' | 'erase'>('select');
	let activeColor = $state('#ef4444');
	let annotations = $state<Annotation[]>([...review.annotations]);
	let voiceTrackPath = $state<string | null>(review.voiceTrackPath);
	let pendingVoiceBlob = $state<Blob | null>(null);

	let saving = $state(false);
	let completing = $state(false);
	let saveError = $state<string | null>(null);
	let lastSaved = $state<Date | null>(null);

	let playerRef: VideoPlayer | undefined;
	let canvasRef: AnnotationCanvas | undefined;

	// ---- Resize canvas to match video container ----
	let videoWrapEl = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		if (!videoWrapEl || !canvasRef) return;
		const { offsetWidth: w, offsetHeight: h } = videoWrapEl;
		canvasRef.resizeTo(w, h);
	});

	// ---- Annotation handlers ----
	function handleAnnotationAdded(ann: Annotation) {
		annotations = [...annotations, ann];
	}

	function handleAnnotationRemoved(id: string) {
		annotations = annotations.filter((a) => a.id !== id);
	}

	function handleClearAll() {
		canvasRef?.clearAll();
		annotations = [];
	}

	// ---- Voice track ----
	async function handleRecordingReady(blob: Blob) {
		pendingVoiceBlob = blob;
	}

	async function uploadVoiceTrack(): Promise<string | null> {
		if (!pendingVoiceBlob) return voiceTrackPath;

		const res = await getVoiceUploadUrl(video.id, review.id);
		if (res.error) return null;

		const { uploadUrl, storagePath } = res.data;
		await uploadToSignedUrl(
			uploadUrl,
			new File([pendingVoiceBlob], 'voice.webm', { type: 'audio/webm' })
		);
		pendingVoiceBlob = null;
		return storagePath;
	}

	// ---- Save / Complete ----
	async function handleSave() {
		saving = true;
		saveError = null;
		try {
			const latestVoicePath = await uploadVoiceTrack();
			const res = await saveAnnotations(video.id, review.id, annotations, latestVoicePath);
			if (res.error) {
				saveError = res.error.message;
				return;
			}
			voiceTrackPath = latestVoicePath;
			lastSaved = new Date();
		} finally {
			saving = false;
		}
	}

	async function handleComplete() {
		if (!confirm('Mark this review as complete? This will trigger composite video generation.'))
			return;

		completing = true;
		saveError = null;
		try {
			// Save latest annotations first
			const latestVoicePath = await uploadVoiceTrack();
			await saveAnnotations(video.id, review.id, annotations, latestVoicePath);

			const res = await completeReview(video.id, review.id);
			if (res.error) {
				saveError = res.error.message;
				return;
			}
			// Redirect to video detail page after completing
			window.location.href = `/videos/${video.id}`;
		} finally {
			completing = false;
		}
	}

	// Auto-save every 60s while the studio is open
	onMount(() => {
		const interval = setInterval(() => {
			if (annotations.length > 0 || pendingVoiceBlob) handleSave();
		}, 60_000);
		return () => clearInterval(interval);
	});
</script>

<div class="flex h-full flex-col gap-3">
	<!-- Top bar -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="font-semibold text-gray-900">{video.title}</h2>
			<p class="text-xs text-gray-500">Review in progress</p>
		</div>
		<div class="flex items-center gap-2">
			{#if lastSaved}
				<span class="text-xs text-gray-400">Saved {lastSaved.toLocaleTimeString()}</span>
			{/if}
			<button
				onclick={handleSave}
				disabled={saving}
				class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
			<button
				onclick={handleComplete}
				disabled={completing || saving}
				class="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
			>
				{completing ? 'Submitting…' : 'Complete Review'}
			</button>
		</div>
	</div>

	{#if saveError}
		<p class="text-sm text-red-600">{saveError}</p>
	{/if}

	<!-- Main area: toolbar + video/canvas + right panel -->
	<div class="flex min-h-0 flex-1 gap-3">
		<!-- Toolbar (left) -->
		<ReviewToolbar
			{activeTool}
			{activeColor}
			onToolChange={(t) => (activeTool = t)}
			onColorChange={(c) => (activeColor = c)}
			onClear={handleClearAll}
		/>

		<!-- Video + canvas (center) -->
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			<!-- Video + annotation overlay -->
			<div
				bind:this={videoWrapEl}
				class="relative aspect-video overflow-hidden rounded-lg bg-black"
			>
				{#if video.muxPlaybackId}
					<VideoPlayer
						bind:this={playerRef}
						playbackId={video.muxPlaybackId}
						onTimeUpdate={(ms) => (currentTimeMs = ms)}
						onDurationReady={(ms) => (durationMs = ms)}
					/>
					<AnnotationCanvas
						bind:this={canvasRef}
						{currentTimeMs}
						{activeTool}
						{activeColor}
						{annotations}
						interactive={true}
						onAnnotationAdded={handleAnnotationAdded}
						onAnnotationRemoved={handleAnnotationRemoved}
					/>
				{:else}
					<div class="flex h-full items-center justify-center text-sm text-white">
						Video is still processing…
					</div>
				{/if}
			</div>

			<!-- Timeline -->
			<AnnotationTimeline
				{annotations}
				{durationMs}
				{currentTimeMs}
				onSeek={(ms) => playerRef?.seekTo(ms)}
			/>
		</div>

		<!-- Right panel: voice recorder -->
		<div class="w-64 flex-shrink-0">
			<VoiceRecorder onRecordingReady={handleRecordingReady} />
			<p class="mt-2 text-xs text-gray-400">
				Record a continuous voice-over. It will be mixed with the video when you complete the
				review.
			</p>
		</div>
	</div>
</div>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		playbackId: string;
		/** Called whenever the current time changes (roughly per animation frame during play) */
		onTimeUpdate?: (currentTimeMs: number) => void;
		/** Called when metadata is loaded and duration is known */
		onDurationReady?: (durationMs: number) => void;
	}

	let { playbackId, onTimeUpdate, onDurationReady }: Props = $props();

	let videoEl = $state<HTMLVideoElement | undefined>(undefined);
	let isPlaying = $state(false);
	let currentTimeMs = $state(0);
	let durationMs = $state(0);
	let playbackRate = $state(1);
	let rafId = 0;

	const RATES = [0.25, 0.5, 1, 1.5, 2];

	// Mux HLS URL — works natively on Safari; others need hls.js
	const hlsSrc = `https://stream.mux.com/${playbackId}.m3u8`;

	function tick() {
		if (!videoEl) return;
		currentTimeMs = videoEl.currentTime * 1000;
		onTimeUpdate?.(currentTimeMs);
		if (isPlaying) {
			rafId = requestAnimationFrame(tick);
		}
	}

	function play() {
		videoEl?.play();
	}

	function pause() {
		videoEl?.pause();
	}

	function togglePlay() {
		if (isPlaying) pause();
		else play();
	}

	function seek(ms: number) {
		if (!videoEl) return;
		videoEl.currentTime = ms / 1000;
		currentTimeMs = ms;
		onTimeUpdate?.(ms);
	}

	function stepFrame(direction: 1 | -1) {
		// Assume 30fps — step ~33ms
		seek(currentTimeMs + direction * 33);
	}

	function setRate(rate: number) {
		playbackRate = rate;
		if (videoEl) videoEl.playbackRate = rate;
	}

	function handleScrub(e: Event) {
		const input = e.target as HTMLInputElement;
		seek(Number(input.value));
	}

	function formatTime(ms: number) {
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const rem = s % 60;
		return `${m}:${rem.toString().padStart(2, '0')}`;
	}

	// Expose current time and seek for parent use
	export function getCurrentTimeMs() {
		return currentTimeMs;
	}
	export function seekTo(ms: number) {
		seek(ms);
	}
	export function getVideoElement() {
		return videoEl;
	}

	onMount(async () => {
		if (!videoEl) return;

		videoEl.addEventListener('play', () => {
			isPlaying = true;
			rafId = requestAnimationFrame(tick);
		});
		videoEl.addEventListener('pause', () => {
			isPlaying = false;
			cancelAnimationFrame(rafId);
		});
		videoEl.addEventListener('loadedmetadata', () => {
			durationMs = (videoEl?.duration ?? 0) * 1000;
			onDurationReady?.(durationMs);
		});

		// Load HLS on browsers that don't support it natively (Chrome, Firefox)
		if (!videoEl.canPlayType('application/vnd.apple.mpegurl')) {
			const { default: Hls } = await import('hls.js');
			if (Hls.isSupported()) {
				const hls = new Hls();
				hls.loadSource(hlsSrc);
				hls.attachMedia(videoEl);
			}
		} else {
			videoEl.src = hlsSrc;
		}
	});

	onDestroy(() => {
		cancelAnimationFrame(rafId);
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.target !== document.body) return;
		if (e.key === ' ') { e.preventDefault(); togglePlay(); }
		if (e.key === 'ArrowLeft') { e.preventDefault(); stepFrame(-1); }
		if (e.key === 'ArrowRight') { e.preventDefault(); stepFrame(1); }
	}}
/>

<div class="flex flex-col gap-2 w-full select-none">
	<!-- Video element -->
	<div class="relative bg-black rounded-lg overflow-hidden aspect-video">
		<video
			bind:this={videoEl}
			class="w-full h-full object-contain"
			playsinline
		></video>
	</div>

	<!-- Timeline scrubber -->
	<input
		type="range"
		min="0"
		max={durationMs || 1}
		value={currentTimeMs}
		oninput={handleScrub}
		class="w-full accent-blue-500 h-1.5 cursor-pointer"
	/>

	<!-- Controls row -->
	<div class="flex items-center gap-3 text-sm">
		<!-- Step back -->
		<button
			onclick={() => stepFrame(-1)}
			class="p-1.5 rounded hover:bg-gray-100"
			title="Step back 1 frame (←)"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
				<path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
			</svg>
		</button>

		<!-- Play/pause -->
		<button
			onclick={togglePlay}
			class="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
			title="Play/Pause (Space)"
		>
			{#if isPlaying}
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
					<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
				</svg>
			{:else}
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
					<path d="M8 5v14l11-7z"/>
				</svg>
			{/if}
		</button>

		<!-- Step forward -->
		<button
			onclick={() => stepFrame(1)}
			class="p-1.5 rounded hover:bg-gray-100"
			title="Step forward 1 frame (→)"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
				<path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.89V8.11L8.5 12zM16 6h2v12h-2z"/>
			</svg>
		</button>

		<!-- Time display -->
		<span class="text-gray-600 tabular-nums text-xs">
			{formatTime(currentTimeMs)} / {formatTime(durationMs)}
		</span>

		<!-- Spacer -->
		<div class="flex-1"></div>

		<!-- Speed selector -->
		<div class="flex gap-1">
			{#each RATES as rate}
				<button
					onclick={() => setRate(rate)}
					class="px-2 py-0.5 rounded text-xs font-medium transition-colors
						{playbackRate === rate
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					{rate}×
				</button>
			{/each}
		</div>
	</div>
</div>

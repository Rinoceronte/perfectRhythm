<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		/** Called when a recording blob is ready */
		onRecordingReady: (blob: Blob) => void;
	}

	let { onRecordingReady }: Props = $props();

	let waveformEl = $state<HTMLDivElement | undefined>(undefined);
	let recording = $state(false);
	let hasRecording = $state(false);
	let durationSec = $state(0);
	let errorMsg = $state<string | null>(null);

	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];
	let wavesurfer: import('wavesurfer.js').default | null = null;
	let timerInterval = 0;
	let recordedBlob: Blob | null = null;
	let stream: MediaStream | null = null;

	async function initWaveSurfer() {
		if (!waveformEl) return;
		const WaveSurfer = (await import('wavesurfer.js')).default;
		wavesurfer = WaveSurfer.create({
			container: waveformEl,
			waveColor: '#93c5fd',
			progressColor: '#3b82f6',
			height: 48,
			barWidth: 2,
			barGap: 1,
			cursorWidth: 0,
			interact: false
		});
	}

	async function startRecording() {
		errorMsg = null;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			errorMsg = 'Microphone access denied';
			return;
		}

		chunks = [];
		mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
		mediaRecorder.ondataavailable = (e) => {
			if (e.data.size > 0) chunks.push(e.data);
		};
		mediaRecorder.onstop = () => {
			recordedBlob = new Blob(chunks, { type: 'audio/webm' });
			hasRecording = true;
			onRecordingReady(recordedBlob);

			// Load waveform
			if (wavesurfer && recordedBlob) {
				wavesurfer.loadBlob(recordedBlob);
			}

			// Release mic
			stream?.getTracks().forEach((t) => t.stop());
		};

		mediaRecorder.start(100);
		recording = true;
		durationSec = 0;
		timerInterval = window.setInterval(() => durationSec++, 1000);
	}

	function stopRecording() {
		mediaRecorder?.stop();
		recording = false;
		clearInterval(timerInterval);
	}

	function playback() {
		wavesurfer?.play();
	}

	function formatDuration(s: number) {
		const m = Math.floor(s / 60);
		const rem = s % 60;
		return `${m}:${rem.toString().padStart(2, '0')}`;
	}

	onMount(initWaveSurfer);

	onDestroy(() => {
		clearInterval(timerInterval);
		mediaRecorder?.stop();
		stream?.getTracks().forEach((t) => t.stop());
		wavesurfer?.destroy();
	});
</script>

<div class="flex flex-col gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
	<div class="flex items-center gap-3">
		<!-- Record / Stop button -->
		{#if recording}
			<button
				onclick={stopRecording}
				class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
			>
				<span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
				Stop {formatDuration(durationSec)}
			</button>
		{:else}
			<button
				onclick={startRecording}
				class="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 text-sm font-medium hover:bg-gray-100 transition-colors"
			>
				<span class="w-3 h-3 rounded-full bg-red-500"></span>
				{hasRecording ? 'Re-record' : 'Record voice-over'}
			</button>
		{/if}

		{#if hasRecording && !recording}
			<button
				onclick={playback}
				class="px-3 py-1.5 rounded-md border border-gray-300 text-sm hover:bg-gray-100 transition-colors"
			>
				Play back
			</button>
		{/if}
	</div>

	<!-- Waveform -->
	<div bind:this={waveformEl} class="w-full min-h-12 rounded overflow-hidden">
		{#if !hasRecording && !recording}
			<div class="h-12 flex items-center justify-center text-xs text-gray-400">
				No recording yet
			</div>
		{/if}
	</div>

	{#if errorMsg}
		<p class="text-xs text-red-600">{errorMsg}</p>
	{/if}
</div>

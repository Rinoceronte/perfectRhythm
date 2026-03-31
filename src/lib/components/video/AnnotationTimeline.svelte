<script lang="ts">
	import type { Annotation } from '$lib/shared/types';

	interface Props {
		annotations: Annotation[];
		durationMs: number;
		currentTimeMs: number;
		onSeek: (ms: number) => void;
	}

	let { annotations, durationMs, currentTimeMs, onSeek }: Props = $props();

	const HEIGHT = 32; // px

	function leftPct(ms: number) {
		if (!durationMs) return 0;
		return (ms / durationMs) * 100;
	}

	function widthPct(durationAnnotationMs: number) {
		if (!durationMs) return 0;
		return (durationAnnotationMs / durationMs) * 100;
	}

	const TYPE_COLORS: Record<string, string> = {
		draw: '#3b82f6',
		arrow: '#f97316',
		text: '#a855f7',
		highlight: '#eab308'
	};

	function handleClick(e: MouseEvent) {
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const pct = (e.clientX - rect.left) / rect.width;
		onSeek(pct * durationMs);
	}
</script>

<div class="flex flex-col gap-1">
	<p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Annotations</p>

	<!-- Timeline bar -->
	<div
		role="slider"
		aria-valuenow={currentTimeMs}
		aria-valuemin={0}
		aria-valuemax={durationMs}
		tabindex="0"
		class="relative w-full bg-gray-100 rounded cursor-pointer"
		style="height: {HEIGHT}px"
		onclick={handleClick}
		onkeydown={(e) => {
			if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTimeMs - 1000));
			if (e.key === 'ArrowRight') onSeek(Math.min(durationMs, currentTimeMs + 1000));
		}}
	>
		<!-- Annotation chips -->
		{#each annotations as ann (ann.id)}
			<div
				title="{ann.type} @ {(ann.timestampMs / 1000).toFixed(1)}s"
				class="absolute top-1 rounded-sm opacity-75 hover:opacity-100 transition-opacity"
				style="
					left: {leftPct(ann.timestampMs)}%;
					width: max({widthPct(ann.durationMs)}%, 4px);
					height: {HEIGHT - 8}px;
					background-color: {TYPE_COLORS[ann.type] ?? '#6b7280'};
				"
			></div>
		{/each}

		<!-- Playhead -->
		<div
			class="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
			style="left: {leftPct(currentTimeMs)}%"
		></div>
	</div>

	{#if annotations.length === 0}
		<p class="text-xs text-gray-400 italic">No annotations yet — start drawing on the video</p>
	{:else}
		<p class="text-xs text-gray-500">{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</p>
	{/if}
</div>

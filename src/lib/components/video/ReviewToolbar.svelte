<script lang="ts">
	import type { AnnotationType } from '$lib/shared/types';

	interface Props {
		activeTool: AnnotationType | 'select' | 'erase';
		activeColor: string;
		onToolChange: (tool: AnnotationType | 'select' | 'erase') => void;
		onColorChange: (color: string) => void;
		onClear: () => void;
	}

	let { activeTool, activeColor, onToolChange, onColorChange, onClear }: Props = $props();

	const TOOLS: { id: AnnotationType | 'select' | 'erase'; label: string; icon: string }[] = [
		{ id: 'select', label: 'Select', icon: 'M4 4l5 14 3-7 7-3z' },
		{
			id: 'draw',
			label: 'Draw',
			icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'
		},
		{
			id: 'arrow',
			label: 'Arrow',
			icon: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z'
		},
		{ id: 'text', label: 'Text', icon: 'M5 4v3h5.5v12h3V7H19V4z' },
		{
			id: 'highlight',
			label: 'Highlight',
			icon: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'
		},
		{
			id: 'erase',
			label: 'Erase',
			icon: 'M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.77-.78 2.04 0 2.83L5.03 20H20v-2h-8.36l9.77-9.76c.79-.79.79-2.05 0-2.83l-2.86-2.82c-.39-.39-.9-.59-1.41-.59z'
		}
	];

	const COLORS = [
		'#ef4444',
		'#f97316',
		'#eab308',
		'#22c55e',
		'#3b82f6',
		'#a855f7',
		'#ffffff',
		'#000000'
	];
</script>

<div class="flex w-12 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
	<!-- Tool buttons -->
	{#each TOOLS as tool (tool.id)}
		<button
			onclick={() => onToolChange(tool.id)}
			title={tool.label}
			class="rounded p-2 transition-colors
				{activeTool === tool.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}"
		>
			<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
				<path d={tool.icon} />
			</svg>
		</button>
	{/each}

	<div class="flex flex-col gap-1.5 border-t border-gray-200 pt-2">
		<!-- Color swatches -->
		{#each COLORS as color (color)}
			<button
				onclick={() => onColorChange(color)}
				title={color}
				style="background-color: {color};"
				class="mx-auto h-6 w-6 rounded-full border-2 transition-all
					{activeColor === color ? 'scale-110 border-blue-500' : 'border-gray-300'}"
			></button>
		{/each}
	</div>

	<div class="border-t border-gray-200 pt-2">
		<!-- Clear all -->
		<button
			onclick={onClear}
			title="Clear all annotations"
			class="rounded p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
		>
			<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
				/>
			</svg>
		</button>
	</div>
</div>

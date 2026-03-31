<script lang="ts">
	import type { InvisibleBlock } from '$lib/shared/types';
	import { createInvisibleBlock, removeInvisibleBlock } from '$lib/shared/api/schedule';

	type BlockWithStudent = InvisibleBlock & {
		studentDisplayName: string;
		studentAvatarUrl: string | null;
	};

	type StudentResult = {
		studentId: string;
		displayName: string;
		avatarUrl: string | null;
	};

	interface Props {
		blocks: BlockWithStudent[];
	}

	let { blocks = $bindable([]) }: Props = $props();

	let query = $state('');
	let results = $state<StudentResult[]>([]);
	let searching = $state(false);
	let showResults = $state(false);
	let adding = $state(false);
	let addError = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function handleInput() {
		addError = '';
		if (query.trim().length < 2) {
			results = [];
			showResults = false;
			return;
		}
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => searchStudents(query.trim()), 250);
	}

	async function searchStudents(q: string) {
		searching = true;
		try {
			const res = await fetch(`/api/v1/coach/students?q=${encodeURIComponent(q)}`);
			const json = await res.json();
			if (json.data) {
				// Filter out already-blocked students
				const blockedIds = new Set(blocks.map((b) => b.studentId));
				results = json.data.filter((s: StudentResult) => !blockedIds.has(s.studentId));
				showResults = true;
			}
		} catch {
			results = [];
		}
		searching = false;
	}

	async function handleSelect(student: StudentResult) {
		adding = true;
		addError = '';
		showResults = false;
		query = '';
		results = [];

		const res = await createInvisibleBlock({ studentId: student.studentId });
		if (res.error) {
			addError = res.error.message;
		} else {
			blocks = [
				...blocks,
				{
					...res.data,
					studentDisplayName: student.displayName,
					studentAvatarUrl: student.avatarUrl
				}
			];
		}
		adding = false;
	}

	async function handleRemove(block: BlockWithStudent) {
		const res = await removeInvisibleBlock(block.id);
		if (res.error) {
			alert(res.error.message);
			return;
		}
		blocks = blocks.filter((b) => b.id !== block.id);
	}
</script>

<div class="space-y-4">
	<div>
		<h2 class="text-base font-semibold text-slate-800">Invisible blocks</h2>
		<p class="mt-0.5 text-sm text-slate-500">
			Blocked students see your availability as fully booked. This is never visible to them.
		</p>
	</div>

	<!-- Search -->
	<div class="relative">
		<input
			type="text"
			bind:value={query}
			oninput={handleInput}
			onfocus={() => { if (results.length > 0) showResults = true; }}
			onblur={() => setTimeout(() => (showResults = false), 200)}
			placeholder="Search student by name..."
			disabled={adding}
			class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none disabled:opacity-50"
		/>
		{#if searching}
			<span class="absolute right-3 top-2.5 text-xs text-slate-400">Searching...</span>
		{/if}

		{#if showResults}
			<div class="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
				{#if results.length === 0}
					<p class="px-3 py-2 text-sm text-slate-400">No students found</p>
				{:else}
					{#each results as student}
						<button
							onclick={() => handleSelect(student)}
							class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
						>
							{#if student.avatarUrl}
								<img
									src={student.avatarUrl}
									alt={student.displayName}
									class="h-7 w-7 rounded-full object-cover"
								/>
							{:else}
								<div
									class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500"
								>
									{student.displayName.charAt(0).toUpperCase()}
								</div>
							{/if}
							<span class="text-sm font-medium text-slate-700">{student.displayName}</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
	{#if addError}
		<p class="text-sm text-red-500">{addError}</p>
	{/if}

	{#if blocks.length === 0}
		<p class="text-sm text-slate-400">No students are currently blocked.</p>
	{:else}
		<div class="space-y-2">
			{#each blocks as block (block.id)}
				<div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
					<div class="flex items-center gap-3">
						{#if block.studentAvatarUrl}
							<img
								src={block.studentAvatarUrl}
								alt={block.studentDisplayName}
								class="h-8 w-8 rounded-full object-cover"
							/>
						{:else}
							<div
								class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500"
							>
								{block.studentDisplayName.charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="text-sm font-medium text-slate-700">{block.studentDisplayName}</span>
					</div>
					<button
						onclick={() => handleRemove(block)}
						class="text-xs text-red-500 hover:underline"
						>Remove block</button
					>
				</div>
			{/each}
		</div>
	{/if}
</div>

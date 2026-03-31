<script lang="ts">
	import type { StudentSkillWithDetails } from '$lib/shared/types';
	import { updateStudentSkill, deleteStudentSkill } from '$lib/shared/api/skills';

	interface Props {
		skill: StudentSkillWithDetails;
		isCoach: boolean;
		expanded: boolean;
		onToggle: () => void;
		priority?: { value: number; source: 'coach' | 'student' | 'system' };
		onUpdated: (skill: StudentSkillWithDetails) => void;
		onDeleted: (id: string) => void;
	}

	let { skill, isCoach, expanded, onToggle, priority, onUpdated, onDeleted }: Props = $props();

	let saving = $state(false);
	let deleting = $state(false);

	// Local editable values — initialized from skill, updated on save
	let currentScore = $state(skill.currentScore);
	let effortToImprove = $state(skill.effortToImprove);
	let improvementBenefit = $state(skill.improvementBenefit);
	let notes = $state(skill.notes ?? '');

	function scoreColor(score: number): string {
		if (score >= 8) return 'text-green-600';
		if (score >= 5) return 'text-yellow-600';
		return 'text-red-500';
	}

	function accentColor(type: 'ability' | 'effort' | 'benefit'): string {
		if (type === 'ability') return 'accent-blue-600';
		if (type === 'effort') return 'accent-orange-500';
		return 'accent-emerald-500';
	}

	async function saveField(field: string, value: number) {
		saving = true;
		const res = await updateStudentSkill(skill.id, { [field]: value });
		saving = false;
		if (res.data) {
			// Sync local state from response before notifying parent
			currentScore = res.data.currentScore;
			effortToImprove = res.data.effortToImprove;
			improvementBenefit = res.data.improvementBenefit;
			notes = res.data.notes ?? '';
			onUpdated(res.data);
		}
	}

	async function saveNotes() {
		const trimmed = notes.trim();
		if (trimmed === (skill.notes ?? '')) return;
		saving = true;
		const res = await updateStudentSkill(skill.id, { notes: trimmed || undefined });
		saving = false;
		if (res.data) onUpdated(res.data);
	}

	async function handleDelete() {
		if (!confirm(`Delete "${skill.skillName}"?`)) return;
		deleting = true;
		const res = await deleteStudentSkill(skill.id);
		if (res.data) onDeleted(skill.id);
		else deleting = false;
	}
</script>

<div
	class="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
	class:opacity-50={deleting}
>
	<!-- Summary row -->
	<button
		onclick={onToggle}
		class="flex w-full items-start justify-between gap-3 p-4 text-left"
	>
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<span class="truncate font-semibold text-slate-900">{skill.skillName}</span>

				{#if skill.coachLocked}
					<span
						class="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600"
						title="Coach has locked this skill — AI won't override it"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
						</svg>
						Locked
					</span>
				{/if}

				{#if !isCoach && skill.coachLocked}
					<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
						Coach reviewed
					</span>
				{/if}

				<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
					{skill.categoryName}
				</span>
			</div>

			{#if !expanded && skill.notes}
				<p class="mt-1 text-sm text-slate-500 line-clamp-1">{skill.notes}</p>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-3">
			<span class="text-xs font-semibold tabular-nums {scoreColor(currentScore)}">{currentScore}</span>
			<svg
				class="h-4 w-4 text-slate-400 transition-transform {expanded ? 'rotate-180' : ''}"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</div>
	</button>

	<!-- Inline editor -->
	{#if expanded}
		<div class="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
			<div class="space-y-3">
				<div class="space-y-1">
					<div class="flex items-center justify-between text-xs">
						<span class="text-slate-500">Ability</span>
						<span class="font-semibold tabular-nums {scoreColor(currentScore)}">{currentScore}/10</span>
					</div>
					<input
						type="range"
						min="1"
						max="10"
						bind:value={currentScore}
						onchange={() => saveField('currentScore', currentScore)}
						class="w-full h-2 {accentColor('ability')}"
					/>
				</div>

				<div class="space-y-1">
					<div class="flex items-center justify-between text-xs">
						<span class="text-slate-500">Effort to improve</span>
						<span class="font-semibold tabular-nums text-slate-600">{effortToImprove}/10</span>
					</div>
					<input
						type="range"
						min="1"
						max="10"
						bind:value={effortToImprove}
						onchange={() => saveField('effortToImprove', effortToImprove)}
						class="w-full h-2 {accentColor('effort')}"
					/>
				</div>

				<div class="space-y-1">
					<div class="flex items-center justify-between text-xs">
						<span class="text-slate-500">Improvement benefit</span>
						<span class="font-semibold tabular-nums text-slate-600">{improvementBenefit}/10</span>
					</div>
					<input
						type="range"
						min="1"
						max="10"
						bind:value={improvementBenefit}
						onchange={() => saveField('improvementBenefit', improvementBenefit)}
						class="w-full h-2 {accentColor('benefit')}"
					/>
				</div>
			</div>

			<div>
				<textarea
					bind:value={notes}
					onblur={saveNotes}
					placeholder="Notes..."
					rows={2}
					maxlength={500}
					class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
				></textarea>
			</div>

			<div class="flex items-center justify-between">
				<div class="text-xs text-slate-400">
					{#if priority}
						Priority #{priority.value}
						{#if priority.source !== 'system'}
							<span class="text-slate-300">· set by {priority.source === 'coach' ? 'coach' : 'you'}</span>
						{/if}
					{/if}
					{#if saving}
						<span class="ml-2 text-slate-400">saving...</span>
					{/if}
				</div>

				{#if isCoach}
					<button
						onclick={handleDelete}
						disabled={deleting}
						class="rounded px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

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
		odd?: boolean;
	}

	let {
		skill,
		isCoach,
		expanded,
		onToggle,
		priority,
		onUpdated,
		onDeleted,
		odd = false
	}: Props = $props();

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

<div class:opacity-50={deleting}>
	<div class="-mr-4 -ml-8 {odd ? 'bg-zinc-100/60' : ''}">
		<div class="pr-4 pl-8">
			<!-- Summary row -->
			<button
				onclick={onToggle}
				class="flex w-full items-center justify-between py-2 text-left transition-colors hover:text-zinc-900"
			>
				<div class="flex min-w-0 items-center gap-2">
					<span class="text-sm text-zinc-700">{skill.skillName}</span>
					{#if saving}
						<span class="text-xs text-zinc-400">saving...</span>
					{/if}
				</div>
				<div class="flex shrink-0 items-center gap-1.5">
					<div class="h-2 w-16 overflow-hidden rounded-full bg-zinc-200">
						<div
							class="h-full rounded-full {currentScore >= 8
								? 'bg-emerald-500'
								: currentScore >= 6
									? 'bg-blue-500'
									: currentScore >= 4
										? 'bg-amber-500'
										: 'bg-red-500'}"
							style="width: {currentScore * 10}%"
						></div>
					</div>
					<span class="w-4 text-right text-xs font-medium tabular-nums {scoreColor(currentScore)}"
						>{currentScore}</span
					>
				</div>
			</button>

			<!-- Inline editor -->
			{#if expanded}
				<div class="space-y-3 pt-1 pb-3 pl-2">
					<div class="space-y-2">
						<div class="space-y-1">
							<div class="flex items-center justify-between text-xs">
								<span class="text-zinc-500">Ability</span>
								<span class="font-semibold tabular-nums {scoreColor(currentScore)}"
									>{currentScore}/10</span
								>
							</div>
							<input
								type="range"
								min="1"
								max="10"
								bind:value={currentScore}
								onchange={() => saveField('currentScore', currentScore)}
								class="h-2 w-full {accentColor('ability')}"
							/>
						</div>

						<div class="space-y-1">
							<div class="flex items-center justify-between text-xs">
								<span class="text-zinc-500">Effort to improve</span>
								<span class="font-semibold text-zinc-600 tabular-nums">{effortToImprove}/10</span>
							</div>
							<input
								type="range"
								min="1"
								max="10"
								bind:value={effortToImprove}
								onchange={() => saveField('effortToImprove', effortToImprove)}
								class="h-2 w-full {accentColor('effort')}"
							/>
						</div>

						<div class="space-y-1">
							<div class="flex items-center justify-between text-xs">
								<span class="text-zinc-500">Improvement benefit</span>
								<span class="font-semibold text-zinc-600 tabular-nums">{improvementBenefit}/10</span
								>
							</div>
							<input
								type="range"
								min="1"
								max="10"
								bind:value={improvementBenefit}
								onchange={() => saveField('improvementBenefit', improvementBenefit)}
								class="h-2 w-full {accentColor('benefit')}"
							/>
						</div>
					</div>

					<textarea
						bind:value={notes}
						onblur={saveNotes}
						placeholder="Notes..."
						rows={2}
						maxlength={500}
						class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 focus:outline-none"
					></textarea>

					<div class="flex items-center justify-between">
						<div class="text-xs text-zinc-400">
							{#if priority}
								Priority #{priority.value}
								{#if priority.source !== 'system'}
									<span class="text-zinc-300"
										>· set by {priority.source === 'coach' ? 'coach' : 'you'}</span
									>
								{/if}
							{/if}
						</div>

						{#if isCoach}
							<button
								onclick={handleDelete}
								disabled={deleting}
								class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500"
							>
								Delete
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

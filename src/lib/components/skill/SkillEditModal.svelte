<script lang="ts">
	import type { StudentSkillWithDetails } from '$lib/shared/types';
	import { updateStudentSkill } from '$lib/shared/api/skills';

	interface Props {
		skill: StudentSkillWithDetails;
		isCoach: boolean;
		onSaved: (skill: StudentSkillWithDetails) => void;
		onClose: () => void;
	}

	let { skill, isCoach, onSaved, onClose }: Props = $props();

	// Local form state
	let currentScore = $state(skill.currentScore);
	let effortToImprove = $state(skill.effortToImprove);
	let improvementBenefit = $state(skill.improvementBenefit);
	let priorityValue = $state<string>(
		isCoach ? (skill.coachPriority?.toString() ?? '') : (skill.studentPriority?.toString() ?? '')
	);
	let notes = $state(skill.notes ?? '');
	let saving = $state(false);
	let errorMsg = $state('');

	async function handleSave() {
		saving = true;
		errorMsg = '';

		const parsedPriority = priorityValue.trim() === '' ? null : parseInt(priorityValue, 10);

		const input = {
			currentScore,
			effortToImprove,
			improvementBenefit,
			notes: notes.trim() || undefined,
			...(isCoach && { coachPriority: parsedPriority }),
			...(!isCoach && { studentPriority: parsedPriority })
		};

		const res = await updateStudentSkill(skill.id, input);
		saving = false;

		if (res.error) {
			errorMsg = res.error.message;
			return;
		}

		onSaved(res.data!);
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
	role="dialog"
	aria-modal="true"
	aria-label="Edit skill"
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
		onclick={(e) => e.stopPropagation()}
		onkeydown={undefined}
		role="presentation"
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-bold text-slate-900">{skill.skillName}</h2>
			<button
				onclick={onClose}
				class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
				aria-label="Close"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="space-y-5">
			<!-- Ability score -->
			<div>
				<div class="mb-1 flex justify-between text-sm">
					<label for="currentScore" class="font-medium text-slate-700">Ability level</label>
					<span class="font-bold text-blue-600">{currentScore}/10</span>
				</div>
				<input
					id="currentScore"
					type="range"
					min="1"
					max="10"
					step="1"
					bind:value={currentScore}
					class="w-full accent-blue-500"
				/>
				<div class="mt-0.5 flex justify-between text-xs text-slate-400">
					<span>Beginner</span>
					<span>Expert</span>
				</div>
			</div>

			<!-- Effort to improve -->
			<div>
				<div class="mb-1 flex justify-between text-sm">
					<label for="effortToImprove" class="font-medium text-slate-700">Effort to improve</label>
					<span class="font-bold text-orange-500">{effortToImprove}/10</span>
				</div>
				<input
					id="effortToImprove"
					type="range"
					min="1"
					max="10"
					step="1"
					bind:value={effortToImprove}
					class="w-full accent-orange-400"
				/>
				<div class="mt-0.5 flex justify-between text-xs text-slate-400">
					<span>Easy</span>
					<span>Very hard</span>
				</div>
			</div>

			<!-- Improvement benefit -->
			<div>
				<div class="mb-1 flex justify-between text-sm">
					<label for="improvementBenefit" class="font-medium text-slate-700"
						>Improvement benefit</label
					>
					<span class="font-bold text-green-600">{improvementBenefit}/10</span>
				</div>
				<input
					id="improvementBenefit"
					type="range"
					min="1"
					max="10"
					step="1"
					bind:value={improvementBenefit}
					class="w-full accent-green-500"
				/>
				<div class="mt-0.5 flex justify-between text-xs text-slate-400">
					<span>Low impact</span>
					<span>High impact</span>
				</div>
			</div>

			<!-- Priority -->
			<div>
				<div class="mb-1 flex items-center justify-between text-sm">
					<label for="priority" class="font-medium text-slate-700">Priority</label>
					<span class="text-xs text-slate-400">Lower = focus first</span>
				</div>
				<select
					id="priority"
					bind:value={priorityValue}
					class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
				>
					<option value="">Auto</option>
					{#each Array.from({ length: 10 }, (_, i) => i + 1) as n (n)}
						<option value={n.toString()}>{n}</option>
					{/each}
				</select>
			</div>

			<!-- Notes -->
			<div>
				<label for="notes" class="mb-1 block text-sm font-medium text-slate-700">Notes</label>
				<textarea
					id="notes"
					bind:value={notes}
					maxlength="500"
					rows="3"
					placeholder="Optional coaching notes..."
					class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
				></textarea>
			</div>

			{#if errorMsg}
				<p class="text-sm text-red-600">{errorMsg}</p>
			{/if}

			<div class="flex gap-3 pt-1">
				<button
					onclick={onClose}
					class="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={saving}
					class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
</div>

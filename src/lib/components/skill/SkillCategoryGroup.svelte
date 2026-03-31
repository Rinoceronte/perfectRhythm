<script lang="ts">
	import type { StudentSkillWithDetails } from '$lib/shared/types';
	import SkillCard from './SkillCard.svelte';

	interface Props {
		category: string;
		categoryLabel: string;
		skills: StudentSkillWithDetails[];
		isCoach: boolean;
		priorities: Map<string, { value: number; source: 'coach' | 'student' | 'system' }>;
		onUpdated: (skill: StudentSkillWithDetails) => void;
		onDeleted: (id: string) => void;
		onEditRequest: (skill: StudentSkillWithDetails) => void;
	}

	let { category, categoryLabel, skills, isCoach, priorities, onUpdated, onDeleted, onEditRequest }: Props =
		$props();

	let collapsed = $state(false);
</script>

<section>
	<button
		onclick={() => (collapsed = !collapsed)}
		class="mb-2 flex w-full items-center justify-between rounded-lg px-1 py-1 text-left"
	>
		<h3 class="text-sm font-semibold uppercase tracking-wider text-slate-500">{categoryLabel}</h3>
		<div class="flex items-center gap-2">
			<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
				{skills.length}
			</span>
			<svg
				class="h-4 w-4 text-slate-400 transition-transform {collapsed ? '-rotate-90' : ''}"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</div>
	</button>

	{#if !collapsed}
		<div class="space-y-3">
			{#each skills as skill (skill.id)}
				<SkillCard
					{skill}
					{isCoach}
					priority={priorities.get(skill.id)}
					{onUpdated}
					{onDeleted}
					{onEditRequest}
				/>
			{/each}
		</div>
	{/if}
</section>

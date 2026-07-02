<script lang="ts">
	import type {
		SkillCategory,
		SkillDefinitionWithCategory,
		StudentSkillWithDetails
	} from '$lib/shared/types';
	import { assignEffectivePriorities } from '$lib/shared/types';
	import { assignStudentSkill } from '$lib/shared/api/skills';
	import SkillCard from './SkillCard.svelte';
	import SkillAddModal from './SkillAddModal.svelte';

	interface Props {
		skills: StudentSkillWithDetails[];
		categories: SkillCategory[];
		definitions: SkillDefinitionWithCategory[];
		coachStudentId: string;
		isCoach: boolean;
		filterCategory?: string | null;
	}

	let {
		skills: initialSkills,
		categories: initialCategories,
		definitions: initialDefinitions,
		coachStudentId,
		isCoach,
		filterCategory = null
	}: Props = $props();

	let skills = $state<StudentSkillWithDetails[]>(initialSkills);
	let categories = $state<SkillCategory[]>(initialCategories);
	let definitions = $state<SkillDefinitionWithCategory[]>(initialDefinitions);
	let expandedCategory = $state<string | null>(filterCategory ?? null);
	let expandedSkillId = $state<string | null>(null);

	let usedCategories = $derived([...new Set(skills.map((s) => s.categoryName))].sort());

	// Group skills by category
	let skillsByCategory = $derived.by(() => {
		const map = new Map<string, StudentSkillWithDetails[]>();
		for (const s of skills) {
			const list = map.get(s.categoryName) ?? [];
			list.push(s);
			map.set(s.categoryName, list);
		}
		return map;
	});

	function categoryAvg(categoryName: string): number {
		const catSkills = skillsByCategory.get(categoryName) ?? [];
		if (catSkills.length === 0) return 0;
		return Math.round((catSkills.reduce((sum, s) => sum + s.currentScore, 0) / catSkills.length) * 10) / 10;
	}

	function toggleCategory(name: string) {
		expandedCategory = expandedCategory === name ? null : name;
		expandedSkillId = null;
	}

	let showAddSearch = $state(false);

	// Add search state
	let skillSearch = $state('');
	let skillDropdownOpen = $state(false);
	let addError = $state('');
	let adding = $state(false);

	// New skill modal
	let showAddModal = $state(false);
	let addModalSkillName = $state('');

	// Filter out definitions already assigned
	let assignedDefinitionIds = $derived(new Set(skills.map((s) => s.skillDefinitionId)));
	let availableDefinitions = $derived(
		definitions.filter((d) => !assignedDefinitionIds.has(d.id))
	);
	let filteredDefinitions = $derived(
		skillSearch.trim() === ''
			? availableDefinitions
			: availableDefinitions.filter((d) =>
					d.name.toLowerCase().includes(skillSearch.trim().toLowerCase())
				)
	);
	let searchMatchesExact = $derived(
		availableDefinitions.some(
			(d) => d.name.toLowerCase() === skillSearch.trim().toLowerCase()
		)
	);

	// Compute effective priorities across ALL skills
	let effectivePriorities = $derived(assignEffectivePriorities(skills));

	function handleUpdated(updated: StudentSkillWithDetails) {
		skills = skills.map((s) => (s.id === updated.id ? updated : s));
	}

	function handleDeleted(id: string) {
		skills = skills.filter((s) => s.id !== id);
	}

	async function handlePickDefinition(def: SkillDefinitionWithCategory) {
		adding = true;
		addError = '';
		skillDropdownOpen = false;

		const res = await assignStudentSkill({
			coachStudentId,
			skillDefinitionId: def.id
		});
		adding = false;

		if (res.error) {
			addError = res.error.message;
			return;
		}

		skills = [res.data!, ...skills];
		skillSearch = '';
		showAddSearch = false;
	}

	function handleCreateNew() {
		addModalSkillName = skillSearch.trim();
		skillDropdownOpen = false;
		showAddModal = true;
	}

	function handleSkillCreated(
		skill: StudentSkillWithDetails,
		newCategory?: SkillCategory,
		newDefinition?: SkillDefinitionWithCategory
	) {
		skills = [skill, ...skills];
		if (newCategory) categories = [...categories, newCategory];
		if (newDefinition) definitions = [...definitions, newDefinition];
		showAddModal = false;
		skillSearch = '';
		showAddSearch = false;
	}

</script>

<div class="space-y-4">
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-xl font-bold text-slate-900">Skill Map</h2>

		<div class="flex flex-wrap items-center gap-2">
			<button
				onclick={() => {
					showAddSearch = !showAddSearch;
					if (showAddSearch) skillSearch = '';
				}}
				class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add skill
			</button>
		</div>
	</div>

	<!-- Add skill search -->
	{#if showAddSearch}
		<div class="rounded-xl border border-blue-100 bg-blue-50 p-4">
			<div class="relative">
				<input
					type="text"
					bind:value={skillSearch}
					onfocus={() => (skillDropdownOpen = true)}
					oninput={() => (skillDropdownOpen = true)}
					placeholder="Search skills or type a new one..."
					maxlength="100"
					autocomplete="off"
					class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
				/>

				{#if skillDropdownOpen}
					<button
						onclick={() => (skillDropdownOpen = false)}
						class="fixed inset-0 z-10"
						tabindex="-1"
						aria-label="Close dropdown"
					></button>

					<ul class="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
						{#each filteredDefinitions as def (def.id)}
							<li>
								<button
									onclick={() => handlePickDefinition(def)}
									disabled={adding}
									class="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
								>
									<span class="font-medium">{def.name}</span>
									<span class="ml-2 text-xs text-slate-400">{def.categoryName}</span>
								</button>
							</li>
						{/each}
						{#if skillSearch.trim() && !searchMatchesExact}
							<li class="border-t border-slate-100">
								<button
									onclick={handleCreateNew}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50"
								>
									<svg
										class="h-4 w-4"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 4v16m8-8H4"
										/>
									</svg>
									Create "{skillSearch.trim()}"
								</button>
							</li>
						{/if}
						{#if filteredDefinitions.length === 0 && !skillSearch.trim()}
							<li class="px-3 py-2 text-sm text-slate-400">
								Type to search or create a new skill
							</li>
						{/if}
					</ul>
				{/if}
			</div>

			{#if addError}
				<p class="mt-2 text-sm text-red-600">{addError}</p>
			{/if}
		</div>
	{/if}

	<!-- Empty state -->
	{#if skills.length === 0}
		<div class="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
			<p class="text-slate-500">No skills yet.</p>
			<p class="mt-1 text-sm text-slate-400">
				Add a skill above to start building the skill map.
			</p>
		</div>
	{:else}
		<div class="rounded-lg border border-zinc-200 bg-white">
			{#each usedCategories as cat, catIdx (cat)}
				{@const catSkills = (skillsByCategory.get(cat) ?? []).sort((a, b) => {
					const pa = effectivePriorities.get(a.id)?.value ?? 999;
					const pb = effectivePriorities.get(b.id)?.value ?? 999;
					return pa - pb;
				})}
				{@const avg = categoryAvg(cat)}
				<div>
					<button
						onclick={() => toggleCategory(cat)}
						class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors {catIdx > 0 ? 'border-t border-zinc-100' : ''}"
					>
						<svg
							class="h-4 w-4 shrink-0 text-zinc-400 transition-transform {expandedCategory === cat ? 'rotate-90' : ''}"
							fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
						</svg>
						<div class="min-w-0 flex-1">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-zinc-900">{cat}</span>
								<span class="text-xs tabular-nums text-zinc-500">{avg} / 10</span>
							</div>
							<div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
								<div
									class="h-full rounded-full transition-all {avg >= 8 ? 'bg-emerald-500' : avg >= 6 ? 'bg-blue-500' : avg >= 4 ? 'bg-amber-500' : 'bg-red-500'}"
									style="width: {avg * 10}%"
								></div>
							</div>
						</div>
					</button>

					{#if expandedCategory === cat}
						<div class="pl-8 pr-4 py-1">
							{#each catSkills as skill, i (skill.id)}
								<SkillCard
									{skill}
									{isCoach}
									expanded={expandedSkillId === skill.id}
									onToggle={() => (expandedSkillId = expandedSkillId === skill.id ? null : skill.id)}
									priority={effectivePriorities.get(skill.id)}
									onUpdated={handleUpdated}
									onDeleted={handleDeleted}
									odd={i % 2 === 1}
								/>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Add new skill modal -->
{#if showAddModal}
	<SkillAddModal
		skillName={addModalSkillName}
		{categories}
		{coachStudentId}
		{isCoach}
		onCreated={handleSkillCreated}
		onClose={() => (showAddModal = false)}
	/>
{/if}

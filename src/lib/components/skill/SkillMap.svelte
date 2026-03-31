<script lang="ts">
	import type {
		SkillCategory,
		SkillDefinitionWithCategory,
		StudentSkillWithDetails
	} from '$lib/shared/types';
	import { assignEffectivePriorities } from '$lib/shared/types';
	import { assignStudentSkill, triggerAiSuggest } from '$lib/shared/api/skills';
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
	let activeCategoryFilter = $state<string | null>(filterCategory ?? null);
	let expandedSkillId = $state<string | null>(null);

	let usedCategories = $derived([...new Set(skills.map((s) => s.categoryName))].sort());

	let displayedSkills = $derived(
		activeCategoryFilter
			? skills.filter((s) => s.categoryName === activeCategoryFilter)
			: skills
	);
	let showAddSearch = $state(false);
	let aiLoading = $state(false);
	let aiMessage = $state('');

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

	// Compute effective priorities across ALL skills (not just filtered)
	let effectivePriorities = $derived(assignEffectivePriorities(skills));

	// Sorted by effective priority (lower number = focus first)
	let sortedSkills = $derived(
		[...displayedSkills].sort((a, b) => {
			const pa = effectivePriorities.get(a.id)?.value ?? 999;
			const pb = effectivePriorities.get(b.id)?.value ?? 999;
			return pa - pb;
		})
	);

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

	async function handleAiSuggest() {
		aiLoading = true;
		aiMessage = '';
		const res = await triggerAiSuggest(coachStudentId);
		aiLoading = false;

		if (res.error) {
			aiMessage = `Error: ${res.error.message}`;
			return;
		}

		aiMessage = `AI updated ${res.data!.applied} skill${res.data!.applied !== 1 ? 's' : ''}.`;
		window.location.reload();
	}
</script>

<div class="space-y-4">
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-xl font-bold text-slate-900">
			{#if activeCategoryFilter}
				{activeCategoryFilter}
			{:else}
				Skill Map
			{/if}
		</h2>

		<div class="flex flex-wrap items-center gap-2">
			{#if isCoach}
				<button
					onclick={handleAiSuggest}
					disabled={aiLoading}
					class="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
				>
					<svg
						class="h-4 w-4 {aiLoading ? 'animate-spin' : ''}"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.999 3.999 0 01-1.025 2.754L12 21l-1.364-1.6a3.999 3.999 0 01-1.025-2.754l-.347-.347z"
						/>
					</svg>
					{aiLoading ? 'Thinking...' : 'AI Suggest'}
				</button>
			{/if}

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

	<!-- Category filter pills — only categories the student has skills in -->
	{#if usedCategories.length > 1}
		<div class="flex flex-wrap gap-2">
			<button
				onclick={() => (activeCategoryFilter = null)}
				class="rounded-full px-3 py-1 text-sm font-medium transition-colors {activeCategoryFilter === null
					? 'bg-zinc-900 text-white'
					: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			>
				All
			</button>
			{#each usedCategories as cat}
				<button
					onclick={() => (activeCategoryFilter = activeCategoryFilter === cat ? null : cat)}
					class="rounded-full px-3 py-1 text-sm font-medium transition-colors {activeCategoryFilter === cat
						? 'bg-zinc-900 text-white'
						: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
				>
					{cat}
				</button>
			{/each}
		</div>
	{/if}

	<!-- AI feedback -->
	{#if aiMessage}
		<div class="rounded-lg bg-purple-50 px-4 py-2 text-sm text-purple-700">{aiMessage}</div>
	{/if}

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
		<div class="space-y-3">
			{#each sortedSkills as skill (skill.id)}
				<SkillCard
					{skill}
					{isCoach}
					expanded={expandedSkillId === skill.id}
					onToggle={() => (expandedSkillId = expandedSkillId === skill.id ? null : skill.id)}
					priority={effectivePriorities.get(skill.id)}
					onUpdated={handleUpdated}
					onDeleted={handleDeleted}
				/>
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

<script lang="ts">
	import type {
		SkillCategory,
		SkillDefinitionWithCategory,
		StudentSkillWithDetails
	} from '$lib/shared/types';
	import { createCategory, createDefinition, assignStudentSkill } from '$lib/shared/api/skills';

	interface Props {
		skillName: string;
		categories: SkillCategory[];
		coachStudentId: string;
		onCreated: (
			skill: StudentSkillWithDetails,
			newCategory?: SkillCategory,
			newDefinition?: SkillDefinitionWithCategory
		) => void;
		onClose: () => void;
	}

	let { skillName, categories, coachStudentId, onCreated, onClose }: Props = $props();

	let name = $state(skillName);
	let currentScore = $state(5);
	let effortToImprove = $state(5);
	let improvementBenefit = $state(5);
	let priorityValue = $state<string>('');
	let saving = $state(false);
	let errorMsg = $state('');

	// Category search
	let categorySearch = $state('');
	let selectedCategoryId = $state('');
	let categoryDropdownOpen = $state(false);

	let filteredCategories = $derived(
		categorySearch.trim() === ''
			? categories
			: categories.filter((c) => c.name.toLowerCase().includes(categorySearch.trim().toLowerCase()))
	);
	let categorySearchMatchesExact = $derived(
		categories.some((c) => c.name.toLowerCase() === categorySearch.trim().toLowerCase())
	);

	function selectCategory(cat: SkillCategory) {
		selectedCategoryId = cat.id;
		categorySearch = cat.name;
		categoryDropdownOpen = false;
	}

	async function handleSave() {
		if (!name.trim()) {
			errorMsg = 'Skill name is required';
			return;
		}

		saving = true;
		errorMsg = '';

		let categoryId = selectedCategoryId;
		let newCategory: SkillCategory | undefined;

		// Create category if typed but not selected
		if (!categoryId && categorySearch.trim()) {
			const catRes = await createCategory({ name: categorySearch.trim() });
			if (catRes.error) {
				errorMsg = catRes.error.message;
				saving = false;
				return;
			}
			categoryId = catRes.data!.id;
			newCategory = catRes.data!;
		}

		if (!categoryId) {
			errorMsg = 'Select or create a category';
			saving = false;
			return;
		}

		// Create skill definition
		const defRes = await createDefinition({ name: name.trim(), categoryId });
		if (defRes.error) {
			errorMsg = defRes.error.message;
			saving = false;
			return;
		}

		const parsedPriority = priorityValue.trim() === '' ? null : parseInt(priorityValue, 10);

		// Assign to student with scores
		const res = await assignStudentSkill({
			coachStudentId,
			skillDefinitionId: defRes.data!.id,
			currentScore,
			effortToImprove,
			improvementBenefit,
			...(parsedPriority != null && { studentPriority: parsedPriority })
		});

		saving = false;

		if (res.error) {
			errorMsg = res.error.message;
			return;
		}

		onCreated(res.data!, newCategory, defRes.data!);
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
	role="dialog"
	aria-modal="true"
	aria-label="Create new skill"
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
		onclick={(e) => e.stopPropagation()}
		role="presentation"
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-bold text-slate-900">Create New Skill</h2>
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
			<!-- Skill name -->
			<div>
				<label for="newSkillName" class="mb-1 block text-sm font-medium text-slate-700"
					>Skill name</label
				>
				<input
					id="newSkillName"
					type="text"
					bind:value={name}
					maxlength="100"
					class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
				/>
			</div>

			<!-- Category -->
			<div>
				<label for="newSkillCategory" class="mb-1 block text-sm font-medium text-slate-700"
					>Category</label
				>
				<div class="relative">
					<input
						id="newSkillCategory"
						type="text"
						bind:value={categorySearch}
						onfocus={() => (categoryDropdownOpen = true)}
						oninput={() => {
							categoryDropdownOpen = true;
							const match = categories.find(
								(c) => c.name.toLowerCase() === categorySearch.trim().toLowerCase()
							);
							selectedCategoryId = match ? match.id : '';
						}}
						placeholder="Search or create category..."
						maxlength="100"
						autocomplete="off"
						class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
					/>

					{#if categoryDropdownOpen}
						<button
							onclick={() => (categoryDropdownOpen = false)}
							class="fixed inset-0 z-10"
							tabindex="-1"
							aria-label="Close dropdown"
						></button>

						<ul
							class="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
						>
							{#each filteredCategories as cat (cat.id)}
								<li>
									<button
										onclick={() => selectCategory(cat)}
										class="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 {cat.id ===
										selectedCategoryId
											? 'bg-blue-50 font-medium text-blue-700'
											: ''}"
									>
										{cat.name}
									</button>
								</li>
							{/each}
							{#if categorySearch.trim() && !categorySearchMatchesExact}
								<li class="border-t border-slate-100">
									<button
										onclick={() => {
											// Will be created on save
											selectedCategoryId = '';
											categoryDropdownOpen = false;
										}}
										class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50"
									>
										<svg
											class="h-4 w-4"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
										</svg>
										Create "{categorySearch.trim()}"
									</button>
								</li>
							{/if}
							{#if filteredCategories.length === 0 && !categorySearch.trim()}
								<li class="px-3 py-2 text-sm text-slate-400">Type to search or create</li>
							{/if}
						</ul>
					{/if}
				</div>
			</div>

			<!-- Ability level -->
			<div>
				<div class="mb-1 flex justify-between text-sm">
					<label for="addAbility" class="font-medium text-slate-700">Ability level</label>
					<span class="font-bold text-blue-600">{currentScore}/10</span>
				</div>
				<input
					id="addAbility"
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
					<label for="addEffort" class="font-medium text-slate-700">Effort to improve</label>
					<span class="font-bold text-orange-500">{effortToImprove}/10</span>
				</div>
				<input
					id="addEffort"
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
					<label for="addBenefit" class="font-medium text-slate-700">Improvement benefit</label>
					<span class="font-bold text-green-600">{improvementBenefit}/10</span>
				</div>
				<input
					id="addBenefit"
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
					<label for="addPriority" class="font-medium text-slate-700">Priority</label>
					<span class="text-xs text-slate-400">Lower = focus first</span>
				</div>
				<select
					id="addPriority"
					bind:value={priorityValue}
					class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
				>
					<option value="">Auto</option>
					{#each Array.from({ length: 10 }, (_, i) => i + 1) as n (n)}
						<option value={n.toString()}>{n}</option>
					{/each}
				</select>
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
					{saving ? 'Creating...' : 'Create & Add'}
				</button>
			</div>
		</div>
	</div>
</div>

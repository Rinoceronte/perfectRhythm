<script lang="ts">
	import { formatDistanceToNow } from 'date-fns';
	import { updateStudentSkill } from '$lib/shared/api/skills';

	let { data } = $props();

	let categories = $state(data.categories.map(cat => ({
		...cat,
		skills: cat.skills.map(s => ({ ...s }))
	})));

	let expandedCategory = $state<string | null>(null);
	let editingSkillId = $state<string | null>(null);
	let savingSkillId = $state<string | null>(null);

	function toggle(name: string) {
		expandedCategory = expandedCategory === name ? null : name;
		editingSkillId = null;
	}

	function toggleEdit(skillId: string) {
		editingSkillId = editingSkillId === skillId ? null : skillId;
	}

	async function saveSkill(catIndex: number, skillIndex: number, field: string, value: number) {
		const skill = categories[catIndex].skills[skillIndex];
		if ((skill as Record<string, unknown>)[field] === value) return;

		savingSkillId = skill.id;
		const result = await updateStudentSkill(skill.id, { [field]: value });
		savingSkillId = null;

		if (result.error) return;

		// Update skill value and reassign for reactivity
		categories[catIndex].skills[skillIndex] = {
			...skill,
			[field]: value
		};
		categories[catIndex] = {
			...categories[catIndex],
			avgScore: Math.round(
				(categories[catIndex].skills.reduce((sum, s) => sum + s.currentScore, 0) / categories[catIndex].skills.length) * 10
			) / 10
		};
	}

	function scoreColor(score: number): string {
		if (score >= 8) return 'bg-emerald-500';
		if (score >= 6) return 'bg-blue-500';
		if (score >= 4) return 'bg-amber-500';
		return 'bg-red-500';
	}

	function scoreTextColor(score: number): string {
		if (score >= 8) return 'text-emerald-700';
		if (score >= 6) return 'text-blue-700';
		if (score >= 4) return 'text-amber-700';
		return 'text-red-700';
	}

	function formatLevel(level: string): string {
		if (level === 'allstar') return 'All-Star';
		return level.charAt(0).toUpperCase() + level.slice(1);
	}

	let hasRoles = $derived(data.student.leaderLevel || data.student.followerLevel);
</script>

<svelte:head>
	<title>{data.student.displayName} — Perfect Rhythm</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6 px-4 py-8">
	<!-- Back link -->
	<a href="/students" class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
		</svg>
		Students
	</a>

	<!-- Student header -->
	<div class="flex items-center gap-4">
		{#if data.student.avatarUrl}
			<img
				src={data.student.avatarUrl}
				alt=""
				class="h-14 w-14 rounded-full object-cover"
			/>
		{:else}
			<div class="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-lg font-medium text-white">
				{data.student.displayName
					.split(' ')
					.map((n: string) => n[0])
					.join('')
					.toUpperCase()
					.slice(0, 2)}
			</div>
		{/if}
		<div>
			<h1 class="text-2xl font-semibold text-zinc-900">{data.student.displayName}</h1>
			<p class="text-sm text-zinc-500">
				Student for {formatDistanceToNow(new Date(data.student.since))}
				{#if data.student.yearsDancing != null}
					· {data.student.yearsDancing} {data.student.yearsDancing === 1 ? 'year' : 'years'} dancing
				{/if}
			</p>
		</div>
	</div>

	<!-- Dance profile -->
	{#if hasRoles || data.student.bio}
		<div class="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
			{#if hasRoles}
				<div class="flex flex-wrap gap-2">
					{#if data.student.leaderLevel}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
							Leader · {formatLevel(data.student.leaderLevel)}
						</span>
					{/if}
					{#if data.student.followerLevel}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
							Follower · {formatLevel(data.student.followerLevel)}
						</span>
					{/if}
				</div>
			{/if}
			{#if data.student.bio}
				<p class="text-sm text-zinc-600">{data.student.bio}</p>
			{/if}
		</div>
	{/if}


	<!-- Skills by category -->
	{#if categories.length > 0}
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-medium text-zinc-900">Skills</h2>
				<a
					href="/skills?coachStudentId={data.student.coachStudentId}"
					class="text-sm text-zinc-500 hover:text-zinc-900"
				>
					Manage
				</a>
			</div>

			<div class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
				{#each categories as category, catIndex}
					<div>
						<!-- Category row -->
						<button
							onclick={() => toggle(category.name)}
							class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
						>
							<svg
								class="h-4 w-4 shrink-0 text-zinc-400 transition-transform {expandedCategory === category.name ? 'rotate-90' : ''}"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="2"
								stroke="currentColor"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
							</svg>
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium text-zinc-900">{category.name}</span>
									<span class="text-xs tabular-nums text-zinc-500">{category.avgScore} / 10</span>
								</div>
								<div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
									<div
										class="h-full rounded-full {scoreColor(category.avgScore)} transition-all"
										style="width: {category.avgScore * 10}%"
									></div>
								</div>
							</div>
						</button>

						<!-- Expanded skills -->
						{#if expandedCategory === category.name}
							<div class="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2">
								<div class="space-y-1">
									{#each category.skills as skill, skillIndex (skill.id)}
										<div>
											<!-- Skill summary row -->
											<button
												onclick={() => toggleEdit(skill.id)}
												class="flex w-full items-center justify-between py-2 text-left hover:bg-zinc-100/50 -mx-2 px-2 rounded transition-colors"
											>
												<div class="flex items-center gap-2 min-w-0">
													<span class="text-sm text-zinc-700">{skill.name}</span>
													{#if skill.coachLocked}
														<svg class="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
														</svg>
													{/if}
													{#if savingSkillId === skill.id}
														<span class="text-xs text-zinc-400">saving...</span>
													{/if}
												</div>
												<div class="flex items-center gap-1.5 shrink-0">
													<div class="h-2 w-16 overflow-hidden rounded-full bg-zinc-200">
														<div
															class="h-full rounded-full {scoreColor(skill.currentScore)}"
															style="width: {skill.currentScore * 10}%"
														></div>
													</div>
													<span class="text-xs tabular-nums font-medium {scoreTextColor(skill.currentScore)} w-4 text-right">{skill.currentScore}</span>
												</div>
											</button>

											<!-- Inline editor -->
											{#if editingSkillId === skill.id}
												<div class="pb-3 pt-1 pl-2 space-y-3">
													<div class="space-y-1">
														<div class="flex items-center justify-between">
															<span class="text-xs text-zinc-500">Ability</span>
															<span class="text-xs tabular-nums font-medium {scoreTextColor(skill.currentScore)}">{skill.currentScore}</span>
														</div>
														<input
															type="range"
															min="1"
															max="10"
															value={skill.currentScore}
															onchange={(e) => saveSkill(catIndex, skillIndex, 'currentScore', parseInt(e.currentTarget.value))}
															class="w-full accent-blue-600 h-2"
														/>
													</div>
													<div class="space-y-1">
														<div class="flex items-center justify-between">
															<span class="text-xs text-zinc-500">Effort to improve</span>
															<span class="text-xs tabular-nums font-medium text-zinc-600">{skill.effortToImprove}</span>
														</div>
														<input
															type="range"
															min="1"
															max="10"
															value={skill.effortToImprove}
															onchange={(e) => saveSkill(catIndex, skillIndex, 'effortToImprove', parseInt(e.currentTarget.value))}
															class="w-full accent-orange-500 h-2"
														/>
													</div>
													<div class="space-y-1">
														<div class="flex items-center justify-between">
															<span class="text-xs text-zinc-500">Improvement benefit</span>
															<span class="text-xs tabular-nums font-medium text-zinc-600">{skill.improvementBenefit}</span>
														</div>
														<input
															type="range"
															min="1"
															max="10"
															value={skill.improvementBenefit}
															onchange={(e) => saveSkill(catIndex, skillIndex, 'improvementBenefit', parseInt(e.currentTarget.value))}
															class="w-full accent-emerald-500 h-2"
														/>
													</div>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="rounded-lg border border-dashed border-zinc-300 py-12 text-center">
			<p class="text-sm text-zinc-500">No skills tracked yet.</p>
			<a
				href="/skills?coachStudentId={data.student.coachStudentId}"
				class="mt-2 inline-block text-sm font-medium text-zinc-900 hover:underline"
			>
				Set up skill map
			</a>
		</div>
	{/if}
</div>

<script lang="ts">
	import type { PageData } from './$types';
	import SkillMap from '$lib/components/skill/SkillMap.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { data }: { data: PageData } = $props();

	let categoryFilter = $derived(page.url.searchParams.get('category'));
</script>

<svelte:head>
	<title>Skill Map</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6">
	{#if data.isCoach && data.studentId}
		<a
			href={resolve('/(app)/students/[id]', { id: data.studentId })}
			class="mb-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
		>
			&larr; Back to student
		</a>
	{/if}

	{#if !data.hasRelationship}
		<div class="rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
			<h2 class="text-lg font-semibold text-slate-700">No coach relationship yet</h2>
			<p class="mt-2 text-sm text-slate-500">
				{data.isCoach
					? 'Add a student to start building their skill map.'
					: 'Your coach will set up your skill map once you start working together.'}
			</p>
		</div>
	{:else}
		<SkillMap
			skills={data.skills}
			categories={data.categories}
			definitions={data.definitions}
			coachStudentId={data.coachStudentId!}
			isCoach={data.isCoach}
			filterCategory={categoryFilter}
		/>
	{/if}
</div>

<script lang="ts">
	import { formatDistanceToNow } from 'date-fns';

	let { data } = $props();

	type Filter = 'active' | 'inactive' | 'all';
	let filter = $state<Filter>('active');
	let search = $state('');

	let filtered = $derived(() => {
		let list = data.students;

		if (filter === 'active') list = list.filter((s) => s.isActive);
		else if (filter === 'inactive') list = list.filter((s) => !s.isActive);

		if (search.trim()) {
			const q = search.trim().toLowerCase();
			list = list.filter((s) => s.displayName.toLowerCase().includes(q));
		}

		return list;
	});

	let activeCount = $derived(data.students.filter((s) => s.isActive).length);
	let inactiveCount = $derived(data.students.length - activeCount);
</script>

<svelte:head>
	<title>Students — Perfect Rhythm</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6 px-4 py-8">
	<h1 class="text-2xl font-semibold text-zinc-900">Students</h1>

	<!-- Filter tabs -->
	<div class="flex gap-1 rounded-xl bg-zinc-100 p-1 text-sm">
		{#each [{ id: 'active', label: `Active (${activeCount})` }, { id: 'inactive', label: `Inactive (${inactiveCount})` }, { id: 'all', label: `All (${data.students.length})` }] as tab}
			<button
				onclick={() => (filter = tab.id as Filter)}
				class="flex-1 rounded-lg py-2 font-medium transition-colors {filter === tab.id
					? 'bg-white shadow text-zinc-800'
					: 'text-zinc-500 hover:text-zinc-700'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Search -->
	{#if data.students.length > 5}
		<input
			type="text"
			bind:value={search}
			placeholder="Search students..."
			class="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
		/>
	{/if}

	{#if filtered().length > 0}
		<ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
			{#each filtered() as student}
				<li>
					<a
						href="/students/{student.studentId}"
						class="flex items-center gap-4 px-4 py-4 hover:bg-zinc-50 transition-colors"
					>
						{#if student.avatarUrl}
							<img
								src={student.avatarUrl}
								alt=""
								class="h-10 w-10 rounded-full object-cover"
							/>
						{:else}
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white">
								{student.displayName
									.split(' ')
									.map((n: string) => n[0])
									.join('')
									.toUpperCase()
									.slice(0, 2)}
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium text-zinc-900">{student.displayName}</p>
								{#if !student.isActive}
									<span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">Inactive</span>
								{/if}
							</div>
							<p class="text-sm text-zinc-500">
								{#if student.lastLessonAt}
									Last lesson {formatDistanceToNow(new Date(student.lastLessonAt), { addSuffix: true })}
								{:else}
									No lessons yet
								{/if}
							</p>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{:else if search.trim()}
		<div class="rounded-lg border border-dashed border-zinc-300 py-8 text-center">
			<p class="text-sm text-zinc-500">No students matching "{search.trim()}"</p>
		</div>
	{:else if filter === 'active'}
		<div class="rounded-lg border border-dashed border-zinc-300 py-12 text-center">
			<p class="text-sm text-zinc-500">No active students.</p>
			<p class="mt-1 text-xs text-zinc-400">Students become active after a confirmed lesson in the last 6 months.</p>
		</div>
	{:else if filter === 'inactive'}
		<div class="rounded-lg border border-dashed border-zinc-300 py-12 text-center">
			<p class="text-sm text-zinc-500">No inactive students.</p>
		</div>
	{:else}
		<div class="rounded-lg border border-dashed border-zinc-300 py-12 text-center">
			<p class="text-sm text-zinc-500">No students yet.</p>
		</div>
	{/if}
</div>

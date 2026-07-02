<script lang="ts">
	import { formatDistanceToNow } from 'date-fns';
	import { invalidateAll } from '$app/navigation';

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

	// Add student form
	let showAddForm = $state(false);
	let addEmail = $state('');
	let addName = $state('');
	let addError = $state('');
	let addSaving = $state(false);
	let addResult = $state<{ studentCreated: boolean } | null>(null);

	// Bidirectional lookup
	let emailLookupTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let emailMatch = $state<{ displayName: string } | null>(null);
	let lookingUpEmail = $state(false);
	let nameLookupTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let nameResults = $state<Array<{ email: string; displayName: string }>>([]);
	let showNameDropdown = $state(false);
	let lookingUpName = $state(false);

	function resetAddForm() {
		addEmail = '';
		addName = '';
		addError = '';
		addResult = null;
		emailMatch = null;
		nameResults = [];
		showNameDropdown = false;
	}

	function handleEmailInput() {
		emailMatch = null;
		nameResults = [];
		showNameDropdown = false;
		if (emailLookupTimeout) clearTimeout(emailLookupTimeout);
		const email = addEmail.trim();
		if (!email || !email.includes('@')) return;

		lookingUpEmail = true;
		emailLookupTimeout = setTimeout(async () => {
			try {
				const res = await fetch(`/api/v1/users/lookup?email=${encodeURIComponent(email)}`);
				const json = await res.json();
				if (json.data) {
					emailMatch = { displayName: json.data.displayName };
					addName = json.data.displayName;
				}
			} catch { /* ignore */ }
			lookingUpEmail = false;
		}, 400);
	}

	function handleNameInput() {
		if (emailMatch) return;
		nameResults = [];
		showNameDropdown = false;
		if (nameLookupTimeout) clearTimeout(nameLookupTimeout);
		const name = addName.trim();
		if (name.length < 2) return;

		lookingUpName = true;
		nameLookupTimeout = setTimeout(async () => {
			try {
				const res = await fetch(`/api/v1/users/lookup?name=${encodeURIComponent(name)}`);
				const json = await res.json();
				if (json.data && Array.isArray(json.data) && json.data.length > 0) {
					nameResults = json.data;
					showNameDropdown = true;
				}
			} catch { /* ignore */ }
			lookingUpName = false;
		}, 400);
	}

	function selectNameResult(result: { email: string; displayName: string }) {
		addEmail = result.email;
		addName = result.displayName;
		emailMatch = { displayName: result.displayName };
		nameResults = [];
		showNameDropdown = false;
	}

	function clearMatch() {
		emailMatch = null;
		addEmail = '';
		addName = '';
	}

	async function handleAddStudent() {
		if (!addEmail.trim()) return;
		addSaving = true;
		addError = '';
		addResult = null;

		const res = await fetch('/api/v1/students', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: addEmail.trim(),
				displayName: addName.trim() || undefined
			})
		});
		const json = await res.json();
		addSaving = false;

		if (json.error) {
			addError = json.error.message;
			return;
		}

		addResult = { studentCreated: json.data.studentCreated };
		await invalidateAll();

		setTimeout(() => {
			showAddForm = false;
			resetAddForm();
		}, 1500);
	}
</script>

<svelte:head>
	<title>Students — Perfect Rhythm</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6 px-4 py-8">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-zinc-900">Students</h1>
		<button
			onclick={() => { showAddForm = !showAddForm; if (!showAddForm) resetAddForm(); }}
			class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
		>
			{showAddForm ? 'Cancel' : '+ Add student'}
		</button>
	</div>

	{#if showAddForm}
		<div class="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
			{#if addResult}
				<div class="text-center py-3">
					<div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
						<svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
						</svg>
					</div>
					<p class="font-semibold text-zinc-900">Student added</p>
					{#if addResult.studentCreated}
						<p class="text-sm text-zinc-500 mt-1">New account created — they'll need to set a password to log in</p>
					{/if}
				</div>
			{:else}
				{#if addError}
					<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{addError}</p>
				{/if}

				<div>
					<label class="mb-1 block text-xs font-medium text-zinc-600">Email *</label>
					<input
						type="email"
						bind:value={addEmail}
						oninput={handleEmailInput}
						placeholder="student@example.com"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none
							{emailMatch ? 'border-green-300 focus:border-green-400' : 'border-zinc-200 focus:border-indigo-400'}"
					/>
					{#if lookingUpEmail}
						<p class="mt-1 text-xs text-zinc-400">Checking...</p>
					{:else if emailMatch}
						<p class="mt-1 text-xs text-green-600">Found: {emailMatch.displayName}</p>
					{:else}
						<p class="mt-1 text-xs text-zinc-400">Matches existing account or creates a new one</p>
					{/if}
				</div>

				<div class="relative">
					<label class="mb-1 block text-xs font-medium text-zinc-600">Name {emailMatch ? '' : '(for new accounts)'}</label>
					<input
						type="text"
						bind:value={addName}
						oninput={handleNameInput}
						onfocus={() => { if (nameResults.length > 0 && !emailMatch) showNameDropdown = true; }}
						onblur={() => setTimeout(() => (showNameDropdown = false), 200)}
						placeholder="e.g. Alex Rivera"
						disabled={!!emailMatch}
						autocomplete="off"
						class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-500"
					/>
					{#if emailMatch}
						<button
							onclick={clearMatch}
							class="absolute right-2 top-7 text-xs text-zinc-400 hover:text-zinc-600"
						>clear</button>
					{/if}
					{#if showNameDropdown && nameResults.length > 0}
						<div class="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg max-h-36 overflow-y-auto">
							{#each nameResults as result (result.email)}
								<button
									type="button"
									onmousedown={() => selectNameResult(result)}
									class="w-full px-3 py-2 text-left hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
								>
									<p class="text-sm font-medium text-zinc-800">{result.displayName}</p>
									<p class="text-xs text-zinc-500">{result.email}</p>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<button
					onclick={handleAddStudent}
					disabled={addSaving || !addEmail.trim()}
					class="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					{addSaving ? 'Adding...' : 'Add student'}
				</button>
			{/if}
		</div>
	{/if}

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
								{#if student.nextLessonAt}
									Next lesson {formatDistanceToNow(new Date(student.nextLessonAt), { addSuffix: true })}
								{:else}
									No upcoming lessons
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

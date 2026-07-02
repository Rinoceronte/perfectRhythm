<script lang="ts">
	import { formatDistanceToNow, format } from 'date-fns';
	import SkillMap from '$lib/components/skill/SkillMap.svelte';

	let { data } = $props();

	function formatLevel(level: string): string {
		if (level === 'allstar') return 'All-Star';
		return level.charAt(0).toUpperCase() + level.slice(1);
	}

	let hasRoles = $derived(data.student.leaderLevel || data.student.followerLevel);

	// Notes
	interface Note {
		id: string;
		coachStudentId: string;
		content: string;
		createdAt: string | Date;
	}

	let notes = $state<Note[]>(data.notes as Note[]);
	let notesExpanded = $state(false);
	let newNote = $state('');
	let savingNote = $state(false);
	let editingNoteId = $state<string | null>(null);
	let editingContent = $state('');
	let savingEdit = $state(false);

	function startEdit(note: Note) {
		editingNoteId = note.id;
		editingContent = note.content;
	}

	function cancelEdit() {
		editingNoteId = null;
		editingContent = '';
	}

	async function saveEdit() {
		if (!editingNoteId || !editingContent.trim()) return;
		const noteId = editingNoteId;
		const original = notes.find((n) => n.id === noteId);
		if (original && editingContent.trim() === original.content) {
			cancelEdit();
			return;
		}

		savingEdit = true;
		const res = await fetch(`/api/v1/students/${data.student.id}/notes/${noteId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: editingContent.trim() })
		});
		const json = await res.json();
		savingEdit = false;

		if (json.data) {
			notes = notes.map((n) => (n.id === noteId ? json.data : n));
			cancelEdit();
		}
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			saveEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	async function addNote() {
		const content = newNote.trim();
		if (!content) return;
		savingNote = true;

		const res = await fetch(`/api/v1/students/${data.student.id}/notes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});
		const json = await res.json();
		savingNote = false;

		if (json.data) {
			notes = [json.data, ...notes];
			newNote = '';
		}
	}

	function handleNoteKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			addNote();
		}
	}
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


	<!-- Notes -->
	<div class="space-y-3">
		<h2 class="text-lg font-medium text-zinc-900">Notes</h2>

		<!-- Add note (always visible) -->
		<div class="flex gap-2">
			<textarea
				bind:value={newNote}
				onkeydown={handleNoteKeydown}
				placeholder="Add a note..."
				rows={2}
				maxlength={5000}
				class="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 resize-none"
			></textarea>
			<button
				onclick={addNote}
				disabled={savingNote || !newNote.trim()}
				class="self-end rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
			>
				{savingNote ? '...' : 'Add'}
			</button>
		</div>

		<!-- Collapsible history -->
		{#if notes.length > 0}
			<button
				onclick={() => (notesExpanded = !notesExpanded)}
				class="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700"
			>
				<svg
					class="h-4 w-4 transition-transform {notesExpanded ? 'rotate-90' : ''}"
					fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
				</svg>
				{notes.length} previous note{notes.length !== 1 ? 's' : ''}
			</button>

			{#if notesExpanded}
				<div class="space-y-2">
					{#each notes as note (note.id)}
						<div class="rounded-lg border border-zinc-100 bg-white px-4 py-3">
							{#if editingNoteId === note.id}
								<textarea
									bind:value={editingContent}
									onkeydown={handleEditKeydown}
									onblur={saveEdit}
									rows={3}
									maxlength={5000}
									class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 resize-none"
								></textarea>
								<div class="mt-2 flex items-center gap-2">
									<button
										onclick={saveEdit}
										disabled={savingEdit}
										class="text-xs font-medium text-zinc-700 hover:text-zinc-900"
									>{savingEdit ? 'Saving...' : 'Save'}</button>
									<button
										onmousedown={cancelEdit}
										class="text-xs text-zinc-400 hover:text-zinc-600"
									>Cancel</button>
								</div>
							{:else}
								<button
									onclick={() => startEdit(note)}
									class="w-full text-left"
								>
									<p class="whitespace-pre-wrap text-sm text-zinc-700">{note.content}</p>
								</button>
								<p class="mt-2 text-xs text-zinc-400">
									{format(new Date(note.createdAt), 'MMM d, yyyy · h:mm a')}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Skill Map -->
	<SkillMap
		skills={data.skills}
		categories={data.skillCategories}
		definitions={data.skillDefinitions}
		coachStudentId={data.student.coachStudentId}
		isCoach={true}
	/>
</div>

<script lang="ts">
	import type { Event } from '$lib/shared/types';
	import { createEvent } from '$lib/shared/api/schedule';

	interface Props {
		events: Event[];
		onEventCreated?: (event: Event) => void;
	}

	let { events = $bindable([]), onEventCreated }: Props = $props();

	let showForm = $state(false);
	let saving = $state(false);
	let error = $state('');

	let form = $state({
		name: '',
		location: '',
		city: '',
		stateOrRegion: '',
		country: 'US',
		startDate: '',
		endDate: '',
		isRecurring: false,
		isLocal: false
	});

	async function handleCreate() {
		if (!form.name || !form.location || !form.city || !form.startDate || !form.endDate) {
			error = 'All required fields must be filled.';
			return;
		}

		saving = true;
		error = '';

		const res = await createEvent(form);
		if (res.error) {
			error = res.error.message;
		} else {
			events = [...events, res.data];
			onEventCreated?.(res.data);
			showForm = false;
			form = {
				name: '',
				location: '',
				city: '',
				stateOrRegion: '',
				country: 'US',
				startDate: '',
				endDate: '',
				isRecurring: false,
				isLocal: false
			};
		}

		saving = false;
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h2 class="text-base font-semibold text-slate-800">Events</h2>
		<button
			onclick={() => (showForm = !showForm)}
			class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
		>
			{showForm ? 'Cancel' : '+ New event'}
		</button>
	</div>

	{#if showForm}
		<div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
			{#if error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
			{/if}

			<div>
				<label class="mb-1 block text-xs font-medium text-slate-600">Event name *</label>
				<input
					type="text"
					bind:value={form.name}
					placeholder="e.g. SwingDiego 2026"
					class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
				/>
			</div>

			<div>
				<label class="mb-1 block text-xs font-medium text-slate-600">Venue name *</label>
				<input
					type="text"
					bind:value={form.location}
					placeholder="e.g. Marriott Downtown"
					class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
				/>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">City *</label>
					<input
						type="text"
						bind:value={form.city}
						class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">State/Region</label>
					<input
						type="text"
						bind:value={form.stateOrRegion}
						class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">Start date *</label>
					<input
						type="date"
						bind:value={form.startDate}
						class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">End date *</label>
					<input
						type="date"
						bind:value={form.endDate}
						class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
					/>
				</div>
			</div>

			<label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
				<input type="checkbox" bind:checked={form.isRecurring} class="rounded" />
				Recurring event
			</label>

			<button
				onclick={handleCreate}
				disabled={saving}
				class="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{saving ? 'Creating…' : 'Create event'}
			</button>
		</div>
	{/if}

	{#if events.length > 0}
		<div class="space-y-2">
			{#each events as ev (ev.id)}
				<div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
					<p class="font-medium text-slate-800">{ev.name}</p>
					<p class="text-sm text-slate-500">
						{ev.location} · {ev.city}, {ev.stateOrRegion}
					</p>
					<p class="text-xs text-slate-400">{ev.startDate} – {ev.endDate}</p>
				</div>
			{/each}
		</div>
	{/if}
</div>

<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { AvailabilityBlock, Event, BookingWithDetails } from '$lib/shared/types';
	import { format, eachDayOfInterval, parseISO } from 'date-fns';
	import { createEvent } from '$lib/shared/api/schedule';
	import DayTimeline from './DayTimeline.svelte';

	interface Props {
		blocks: AvailabilityBlock[];
		events: Event[];
		bookings: BookingWithDetails[];
	}

	let {
		blocks = $bindable([]),
		events = $bindable([]),
		bookings = $bindable([])
	}: Props = $props();

	// Navigation state
	let selectedEventId = $state<string | null>(null);
	let selectedDate = $state<string | null>(null);

	// Event creation
	let showEventForm = $state(false);
	let savingEvent = $state(false);
	let eventError = $state('');
	let eventForm = $state({
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

	// Event search autocomplete
	let searchResults = $state<Event[]>([]);
	let showDropdown = $state(false);
	let searchTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

	function handleNameInput() {
		if (eventForm.isLocal || eventForm.name.length < 2) {
			searchResults = [];
			showDropdown = false;
			return;
		}
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(async () => {
			const res = await fetch(`/api/v1/events?search=${encodeURIComponent(eventForm.name)}`);
			const json = await res.json();
			if (json.data && json.data.length > 0) {
				// Deduplicate by name+city (same event created by different coaches)
				const seen = new SvelteSet<string>();
				searchResults = json.data.filter((e: Event) => {
					const key = `${e.name}|${e.city}`;
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				});
				showDropdown = true;
			} else {
				searchResults = [];
				showDropdown = false;
			}
		}, 250);
	}

	function selectSearchResult(ev: Event) {
		eventForm.name = ev.name;
		eventForm.location = ev.location;
		eventForm.city = ev.city;
		eventForm.stateOrRegion = ev.stateOrRegion;
		eventForm.country = ev.country;
		eventForm.startDate = ev.startDate;
		eventForm.endDate = ev.endDate;
		showDropdown = false;
		searchResults = [];
	}

	function resetEventForm() {
		eventForm = {
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
		eventError = '';
		searchResults = [];
		showDropdown = false;
	}

	async function handleCreateEvent() {
		if (
			!eventForm.name ||
			!eventForm.location ||
			!eventForm.city ||
			!eventForm.startDate ||
			!eventForm.endDate
		) {
			eventError = 'All required fields must be filled.';
			return;
		}
		savingEvent = true;
		eventError = '';
		const res = await createEvent(eventForm);
		if (res.error) {
			eventError = res.error.message;
		} else {
			events = [...events, res.data];
			showEventForm = false;
			resetEventForm();
		}
		savingEvent = false;
	}

	let selectedEvent = $derived(events.find((e) => e.id === selectedEventId) ?? null);

	let eventDays = $derived.by(() => {
		if (!selectedEvent) return [];
		return eachDayOfInterval({
			start: parseISO(selectedEvent.startDate),
			end: parseISO(selectedEvent.endDate)
		}).map((d) => format(d, 'yyyy-MM-dd'));
	});

	// Auto-select first day when entering event
	$effect(() => {
		if (selectedEventId && eventDays.length > 0 && !eventDays.includes(selectedDate ?? '')) {
			selectedDate = eventDays[0];
		}
	});

	function selectEvent(event: Event) {
		selectedEventId = event.id;
		selectedDate = null; // will be set by $effect
	}

	function goBack() {
		selectedEventId = null;
		selectedDate = null;
	}

	function blockCountForEvent(eventId: string): number {
		return blocks.filter((b) => b.eventId === eventId).length;
	}

	function lessonCountForDay(date: string): number {
		return bookings.filter((b) => {
			const slotDate = new Date(b.slot.startTime).toISOString().slice(0, 10);
			return slotDate === date && (b.status === 'confirmed' || b.status === 'pending');
		}).length;
	}

	function formatDayTab(dateStr: string): string {
		const d = parseISO(dateStr);
		return format(d, 'EEE');
	}

	function handleBlocksChanged(updatedBlocks: AvailabilityBlock[]) {
		blocks = updatedBlocks;
	}

	// Sort events by start date
	let sortedEvents = $derived([...events].sort((a, b) => a.startDate.localeCompare(b.startDate)));
</script>

{#if !selectedEventId}
	<!-- Event list -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-slate-800">Schedule by Event</h2>
			<button
				onclick={() => {
					showEventForm = !showEventForm;
					if (!showEventForm) resetEventForm();
				}}
				class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
			>
				{showEventForm ? 'Cancel' : '+ New event'}
			</button>
		</div>

		{#if showEventForm}
			<div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
				{#if eventError}
					<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{eventError}</p>
				{/if}

				<div class="relative">
					<label class="mb-1 block text-xs font-medium text-slate-600"
						>{eventForm.isLocal ? 'Name *' : 'Event name *'}</label
					>
					<input
						type="text"
						bind:value={eventForm.name}
						oninput={handleNameInput}
						onfocus={() => {
							if (searchResults.length > 0) showDropdown = true;
						}}
						onblur={() => setTimeout(() => (showDropdown = false), 200)}
						placeholder={eventForm.isLocal ? 'e.g. Tuesday Lessons' : 'e.g. SwingDiego 2026'}
						autocomplete="off"
						class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
					/>
					{#if showDropdown && searchResults.length > 0}
						<div
							class="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
						>
							{#each searchResults as result (result.id)}
								<button
									type="button"
									onmousedown={() => selectSearchResult(result)}
									class="w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
								>
									<p class="text-sm font-medium text-slate-800">{result.name}</p>
									<p class="text-xs text-slate-500">
										{result.city}, {result.stateOrRegion} · {result.startDate} – {result.endDate}
									</p>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">Venue name *</label>
					<input
						type="text"
						bind:value={eventForm.location}
						placeholder="e.g. Marriott Downtown"
						class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs font-medium text-slate-600">City *</label>
						<input
							type="text"
							bind:value={eventForm.city}
							class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-medium text-slate-600">State/Region</label>
						<input
							type="text"
							bind:value={eventForm.stateOrRegion}
							class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs font-medium text-slate-600">Start date *</label>
						<input
							type="date"
							bind:value={eventForm.startDate}
							class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-medium text-slate-600">End date *</label>
						<input
							type="date"
							bind:value={eventForm.endDate}
							class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
						/>
					</div>
				</div>

				<div class="flex gap-4">
					<label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
						<input type="checkbox" bind:checked={eventForm.isLocal} class="rounded" />
						Local day
					</label>
					<label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
						<input type="checkbox" bind:checked={eventForm.isRecurring} class="rounded" />
						Recurring
					</label>
				</div>

				<button
					onclick={handleCreateEvent}
					disabled={savingEvent}
					class="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					{savingEvent ? 'Creating…' : 'Create event'}
				</button>
			</div>
		{/if}

		{#if sortedEvents.length === 0 && !showEventForm}
			<div class="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
				<p class="text-sm text-slate-500">No events yet.</p>
				<p class="mt-1 text-xs text-slate-400">
					Create an event to start setting your availability.
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each sortedEvents as event (event.id)}
					{@const count = blockCountForEvent(event.id)}
					<button
						onclick={() => selectEvent(event)}
						class="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="flex items-center justify-between">
							<div>
								<div class="flex items-center gap-2">
									<p class="font-semibold text-slate-800">{event.name}</p>
									{#if event.isLocal}
										<span
											class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
											>Local</span
										>
									{:else}
										<span
											class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
											>Event</span
										>
									{/if}
								</div>
								<p class="text-sm text-slate-500">
									{event.city}, {event.stateOrRegion} · {format(
										parseISO(event.startDate),
										'MMM d'
									)}–{format(parseISO(event.endDate), 'MMM d')}
								</p>
							</div>
							<div class="flex items-center gap-2">
								{#if count > 0}
									<span
										class="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
									>
										{count} block{count !== 1 ? 's' : ''}
									</span>
								{:else}
									<span class="text-xs text-slate-400">No availability</span>
								{/if}
								<svg
									class="h-4 w-4 text-slate-400"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m8.25 4.5 7.5 7.5-7.5 7.5"
									/>
								</svg>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<!-- Event day view -->
	<div class="space-y-4">
		<!-- Header -->
		<div>
			<div class="flex items-center gap-2">
				<button onclick={goBack} class="flex items-center text-slate-400 hover:text-slate-600">
					<svg
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
					</svg>
				</button>
				<h2 class="text-lg font-semibold text-slate-800">{selectedEvent?.name}</h2>
			</div>
			<p class="mt-0.5 ml-7 text-sm text-slate-500">
				{selectedEvent?.city}, {selectedEvent?.stateOrRegion} · Drag on the timeline to add availability
			</p>
		</div>

		<!-- Day tabs -->
		<div class="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm">
			{#each eventDays as day (day)}
				{@const count = lessonCountForDay(day)}
				<button
					onclick={() => (selectedDate = day)}
					class="inline-flex flex-1 shrink-0 items-center justify-center gap-1 rounded-lg px-3 py-2 font-medium transition-colors {selectedDate ===
					day
						? 'bg-white text-slate-800 shadow'
						: 'text-slate-500 hover:text-slate-700'}"
				>
					{formatDayTab(day)}
					{#if count > 0}
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white"
						>
							{count}
						</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Day timeline -->
		{#if selectedDate}
			<DayTimeline
				date={selectedDate}
				eventId={selectedEventId}
				{blocks}
				{bookings}
				onBlocksChanged={handleBlocksChanged}
				onBookingsChanged={(updated) => (bookings = updated)}
			/>
		{/if}
	</div>
{/if}

<script lang="ts">
	import type { PageData } from './$types';
	import type { AvailabilityBlock, Event, BookingWithDetails, InvisibleBlock } from '$lib/shared/types';
	import CoachScheduleBuilder from '$lib/components/schedule/CoachScheduleBuilder.svelte';
	import BookingCalendar from '$lib/components/schedule/BookingCalendar.svelte';
	import InvisibleBlockManager from '$lib/components/schedule/InvisibleBlockManager.svelte';
	import StudentBookingView from '$lib/components/schedule/StudentBookingView.svelte';
	import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
	import { fetchBookings } from '$lib/shared/api/schedule';

	let { data }: { data: PageData } = $props();

	// ---- Coach local state (initialized from server data) ----
	const coachData = data.role === 'coach' ? data : null;
	let blocks = $state<AvailabilityBlock[]>(coachData?.blocks ?? []);
	let events = $state<Event[]>(coachData?.events ?? []);
	let bookings = $state<BookingWithDetails[]>(coachData?.bookings ?? []);
	let invisibleBlocks = $state<Array<InvisibleBlock & { studentDisplayName: string; studentAvatarUrl: string | null }>>(
		coachData?.invisibleBlocks ?? []
	);

	type CoachTab = 'schedule' | 'bookings';
	const validTabs: CoachTab[] = ['schedule', 'bookings'];
	const urlTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
	let coachTab = $state<CoachTab>(validTabs.includes(urlTab as CoachTab) ? (urlTab as CoachTab) : 'schedule');
	let showInvisibleBlocks = $state(false);

	async function switchCoachTab(tab: CoachTab) {
		coachTab = tab;
		if (tab === 'bookings') {
			const res = await fetchBookings();
			if (!res.error) {
				bookings = res.data as BookingWithDetails[];
			}
		}
	}

	// ---- Student view ----
	type StudentStep = 'browse' | 'coach-events' | 'slots';
	let step = $state<StudentStep>('browse');
	let selectedCoachId = $state<string | null>(null);
	let selectedCoachName = $state('');
	let selectedEventId = $state<string | null>(null);
	let selectedEventName = $state<string | null>(null);
	let selectedEventStartDate = $state<string | null>(null);
	let selectedEventEndDate = $state<string | null>(null);
	let selectedCoachIds = $state<Set<string>>(new Set());
	let filterCity = $state('');
	let filterEvent = $state('');

	function selectCoach(coachId: string, name: string) {
		selectedCoachId = coachId;
		selectedCoachName = name;

		// If user already filtered by event or city, skip the intermediate step
		if (filterEvent || filterCity) {
			// Find event dates from the filter context
			const matchingEvent = studentData?.upcomingEvents?.find(
				(e) => e.coachId === coachId && (filterEvent ? e.name === filterEvent : e.city === filterCity)
			);
			selectedEventId = matchingEvent?.id ?? null;
			selectedEventName = matchingEvent?.name ?? (filterEvent || null);
			selectedEventStartDate = matchingEvent?.startDate ?? null;
			selectedEventEndDate = matchingEvent?.endDate ?? null;
			step = 'slots';
		} else {
			step = 'coach-events';
		}
	}

	function selectEventForCoach(event: CoachEvent | null) {
		selectedEventId = event?.id ?? null;
		selectedEventName = event?.name ?? null;
		selectedEventStartDate = event?.startDate ?? null;
		selectedEventEndDate = event?.endDate ?? null;
		step = 'slots';
	}

	function backToBrowse() {
		selectedCoachId = null;
		selectedCoachName = '';
		selectedEventId = null;
		selectedEventName = null;
		selectedEventStartDate = null;
		selectedEventEndDate = null;
		step = 'browse';
	}

	function backToCoachEvents() {
		selectedEventId = null;
		selectedEventName = null;
		selectedEventStartDate = null;
		selectedEventEndDate = null;
		step = 'coach-events';
	}

	// Build filter options from upcoming events
	let studentData = $derived(data.role === 'student' ? data : null);

	let uniqueCities = $derived(() => {
		if (!studentData?.upcomingEvents) return [];
		const cities = new Set(studentData.upcomingEvents.map((e) => e.city));
		return [...cities].sort();
	});

	let uniqueEvents = $derived(() => {
		if (!studentData?.upcomingEvents) return [];
		const seen = new Map<string, string>();
		for (const e of studentData.upcomingEvents) {
			if (!seen.has(e.name)) seen.set(e.name, e.id);
		}
		return [...seen.entries()].map(([name, id]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
	});

	// Coach IDs that have a matching upcoming event
	let coachIdsForEvent = $derived(() => {
		if (!filterEvent || !studentData?.upcomingEvents) return null;
		return new Set(studentData.upcomingEvents.filter((e) => e.name === filterEvent).map((e) => e.coachId));
	});

	let coachIdsForCity = $derived(() => {
		if (!filterCity || !studentData?.upcomingEvents) return null;
		return new Set(studentData.upcomingEvents.filter((e) => e.city === filterCity).map((e) => e.coachId));
	});

	// Events grouped by coach for display
	type CoachEvent = { id: string; coachId: string; name: string; location: string; city: string; stateOrRegion: string; startDate: string; endDate: string };
	let eventsByCoach = $derived(() => {
		const map = new Map<string, CoachEvent[]>();
		if (!studentData?.upcomingEvents) return map;
		for (const e of studentData.upcomingEvents) {
			const list = map.get(e.coachId) ?? [];
			list.push(e);
			map.set(e.coachId, list);
		}
		return map;
	});

	// Events for the currently selected coach
	let selectedCoachEvents = $derived(() => {
		if (!selectedCoachId) return [];
		return eventsByCoach().get(selectedCoachId) ?? [];
	});

	let coachOptions = $derived(() => {
		if (!studentData) return [];
		return studentData.coaches.map((c) => ({ value: c.coachId, label: c.coachName }));
	});

	let filteredCoaches = $derived(() => {
		if (!studentData) return [];
		let result = studentData.coaches;

		if (selectedCoachIds.size > 0) {
			result = result.filter((c) => selectedCoachIds.has(c.coachId));
		}

		const eventSet = coachIdsForEvent();
		if (eventSet) {
			result = result.filter((c) => eventSet.has(c.coachId));
		}

		const citySet = coachIdsForCity();
		if (citySet) {
			result = result.filter((c) => citySet.has(c.coachId));
		}

		return result;
	});
</script>

<svelte:head>
	<title>Schedule</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6">
	{#if data.role === 'coach'}
		<!-- Coach tabs -->
		<div class="mb-6 flex items-center gap-2">
			<div class="flex flex-1 gap-1 rounded-xl bg-slate-100 p-1 text-sm">
				{#each [{ id: 'schedule', label: 'Schedule' }, { id: 'bookings', label: 'Bookings' }] as tab}
					<button
						onclick={() => switchCoachTab(tab.id as CoachTab)}
						class="flex-1 rounded-lg py-2 font-medium transition-colors {coachTab === tab.id
							? 'bg-white shadow text-slate-800'
							: 'text-slate-500 hover:text-slate-700'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>
			<button
				onclick={() => (showInvisibleBlocks = !showInvisibleBlocks)}
				class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
				title="Manage invisible blocks"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
				</svg>
			</button>
		</div>

		{#if showInvisibleBlocks}
			<div class="mb-6">
				<InvisibleBlockManager bind:blocks={invisibleBlocks} />
			</div>
		{/if}

		{#if coachTab === 'schedule'}
			<CoachScheduleBuilder bind:blocks bind:events {bookings} />
		{:else if coachTab === 'bookings'}
			<BookingCalendar bind:bookings />
		{/if}
	{:else}
		<!-- Student view -->
		{#if step === 'browse'}
			<h1 class="mb-4 text-lg font-semibold text-slate-800">Book a lesson</h1>

			<!-- Filters -->
			<div class="mb-4 space-y-3">
				<MultiSelect
					options={coachOptions()}
					selected={selectedCoachIds}
					onchange={(s) => (selectedCoachIds = s)}
					placeholder="Filter coaches..."
				/>
				<div class="flex gap-2">
					{#if uniqueEvents().length > 0}
						<select
							bind:value={filterEvent}
							class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-zinc-900 focus:outline-none"
						>
							<option value="">All events</option>
							{#each uniqueEvents() as event}
								<option value={event.name}>{event.name}</option>
							{/each}
						</select>
					{/if}
					{#if uniqueCities().length > 0}
						<select
							bind:value={filterCity}
							class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-zinc-900 focus:outline-none"
						>
							<option value="">All cities</option>
							{#each uniqueCities() as city}
								<option value={city}>{city}</option>
							{/each}
						</select>
					{/if}
				</div>
			</div>

			{@const coaches = filteredCoaches()}
			{#if coaches.length === 0}
				<div class="rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
					<h2 class="text-base font-semibold text-slate-700">No coaches found</h2>
					<p class="mt-2 text-sm text-slate-500">
						{#if selectedCoachIds.size > 0 || filterCity || filterEvent}
							Try adjusting your filters.
						{:else}
							No coaches are on the platform yet.
						{/if}
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each coaches as coach}
						<button
							onclick={() => selectCoach(coach.coachId, coach.coachName)}
							class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50"
						>
							{#if coach.coachAvatarUrl}
								<img
									src={coach.coachAvatarUrl}
									alt={coach.coachName}
									class="h-10 w-10 rounded-full object-cover"
								/>
							{:else}
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600"
								>
									{coach.coachName.charAt(0).toUpperCase()}
								</div>
							{/if}
							<span class="font-medium text-slate-800">{coach.coachName}</span>
							<span class="ml-auto text-slate-400">→</span>
						</button>
					{/each}
				</div>
			{/if}

		{:else if step === 'coach-events'}
			<!-- Intermediate: pick an event/location for this coach -->
			<div class="mb-4">
				<button onclick={backToBrowse} class="text-sm font-medium text-indigo-600 hover:text-indigo-700">
					← All coaches
				</button>
			</div>

			<h1 class="mb-1 text-lg font-semibold text-slate-800">{selectedCoachName}</h1>
			<p class="mb-4 text-sm text-slate-500">Where would you like to take a lesson?</p>

			<div class="space-y-2">
				{#each selectedCoachEvents() as event}
					<button
						onclick={() => selectEventForCoach(event)}
						class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50"
					>
						<div class="min-w-0 flex-1">
							<p class="font-medium text-slate-800">{event.name}</p>
							<p class="text-sm text-slate-500">{event.city}, {event.stateOrRegion} · {event.startDate} – {event.endDate}</p>
						</div>
						<span class="text-slate-400">→</span>
					</button>
				{/each}

			</div>

		{:else if step === 'slots' && selectedCoachId}
			<div class="mb-4">
				<button
					onclick={() => {
						if (filterEvent || filterCity) {
							backToBrowse();
						} else {
							backToCoachEvents();
						}
					}}
					class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
				>
					← {filterEvent || filterCity ? 'All coaches' : selectedCoachName}
				</button>
			</div>
			<StudentBookingView
				coachId={selectedCoachId}
				coachName={selectedCoachName}
				eventId={selectedEventId}
				eventName={selectedEventName}
				eventStartDate={selectedEventStartDate}
				eventEndDate={selectedEventEndDate}
			/>
		{/if}
	{/if}
</div>

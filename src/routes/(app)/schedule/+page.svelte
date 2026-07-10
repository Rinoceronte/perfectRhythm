<script lang="ts">
	import type { PageData } from './$types';
	import type {
		AvailabilityBlock,
		Event,
		BookingWithDetails,
		InvisibleBlock
	} from '$lib/shared/types';
	import CoachScheduleBuilder from '$lib/components/schedule/CoachScheduleBuilder.svelte';
	import BookingCalendar from '$lib/components/schedule/BookingCalendar.svelte';
	import InvisibleBlockManager from '$lib/components/schedule/InvisibleBlockManager.svelte';
	import StudentBookingView from '$lib/components/schedule/StudentBookingView.svelte';
	import { fetchBookings } from '$lib/shared/api/schedule';

	let { data }: { data: PageData } = $props();

	// ---- Coach local state (initialized from server data) ----
	const coachData = data.role === 'coach' ? data : null;
	let blocks = $state<AvailabilityBlock[]>(coachData?.blocks ?? []);
	let events = $state<Event[]>(coachData?.events ?? []);
	let bookings = $state<BookingWithDetails[]>(coachData?.bookings ?? []);
	let invisibleBlocks = $state<
		Array<InvisibleBlock & { studentDisplayName: string; studentAvatarUrl: string | null }>
	>(coachData?.invisibleBlocks ?? []);

	type CoachTab = 'schedule' | 'bookings';
	const validTabs: CoachTab[] = ['schedule', 'bookings'];
	const urlTab =
		typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
	let coachTab = $state<CoachTab>(
		validTabs.includes(urlTab as CoachTab) ? (urlTab as CoachTab) : 'schedule'
	);
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
	// Single-teacher deployment: no coach browsing — go straight to the teacher's events
	type StudentStep = 'coach-events' | 'slots';
	let step = $state<StudentStep>('coach-events');
	let selectedEventId = $state<string | null>(null);
	let selectedEventName = $state<string | null>(null);
	let selectedEventStartDate = $state<string | null>(null);
	let selectedEventEndDate = $state<string | null>(null);

	let studentData = $derived(data.role === 'student' ? data : null);
	let coach = $derived(studentData?.coach ?? null);

	type CoachEvent = {
		id: string;
		coachId: string;
		name: string;
		location: string;
		city: string;
		stateOrRegion: string;
		startDate: string;
		endDate: string;
	};

	function selectEvent(event: CoachEvent) {
		selectedEventId = event.id;
		selectedEventName = event.name;
		selectedEventStartDate = event.startDate;
		selectedEventEndDate = event.endDate;
		step = 'slots';
	}

	function backToCoachEvents() {
		selectedEventId = null;
		selectedEventName = null;
		selectedEventStartDate = null;
		selectedEventEndDate = null;
		step = 'coach-events';
	}
</script>

<svelte:head>
	<title>Schedule</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6">
	{#if data.role === 'coach'}
		<!-- Coach tabs -->
		<div class="mb-6 flex items-center gap-2">
			<div class="flex flex-1 gap-1 rounded-xl bg-slate-100 p-1 text-sm">
				{#each [{ id: 'schedule', label: 'Schedule' }, { id: 'bookings', label: 'Bookings' }] as tab (tab.id)}
					<button
						onclick={() => switchCoachTab(tab.id as CoachTab)}
						class="flex-1 rounded-lg py-2 font-medium transition-colors {coachTab === tab.id
							? 'bg-white text-slate-800 shadow'
							: 'text-slate-500 hover:text-slate-700'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>
			<button
				onclick={() => (showInvisibleBlocks = !showInvisibleBlocks)}
				class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
				title="Manage invisible blocks"
			>
				<svg
					class="h-5 w-5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
					/>
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
	{:else if !coach}
		<!-- Student view, deployment not seeded yet -->
		<div class="rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
			<h2 class="text-base font-semibold text-slate-700">Scheduling isn't set up yet</h2>
			<p class="mt-2 text-sm text-slate-500">Check back soon.</p>
		</div>
	{:else if step === 'coach-events'}
		<!-- Student view: pick an event/location for the teacher -->
		<h1 class="mb-1 text-lg font-semibold text-slate-800">Book a lesson with {coach.coachName}</h1>
		<p class="mb-4 text-sm text-slate-500">Where would you like to take a lesson?</p>

		{#if studentData && studentData.upcomingEvents.length === 0}
			<div class="rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
				<h2 class="text-base font-semibold text-slate-700">No upcoming events</h2>
				<p class="mt-2 text-sm text-slate-500">
					{coach.coachName} hasn't posted upcoming availability yet.
				</p>
			</div>
		{:else if studentData}
			<div class="space-y-2">
				{#each studentData.upcomingEvents as event (event.id)}
					<button
						onclick={() => selectEvent(event)}
						class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50"
					>
						<div class="min-w-0 flex-1">
							<p class="font-medium text-slate-800">{event.name}</p>
							<p class="text-sm text-slate-500">
								{event.city}, {event.stateOrRegion} · {event.startDate} – {event.endDate}
							</p>
						</div>
						<span class="text-slate-400">→</span>
					</button>
				{/each}
			</div>
		{/if}
	{:else if step === 'slots'}
		<div class="mb-4">
			<button
				onclick={backToCoachEvents}
				class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
			>
				← Back
			</button>
		</div>
		<StudentBookingView
			coachId={coach.coachId}
			coachName={coach.coachName}
			eventId={selectedEventId}
			eventName={selectedEventName}
			eventStartDate={selectedEventStartDate}
			eventEndDate={selectedEventEndDate}
		/>
	{/if}
</div>

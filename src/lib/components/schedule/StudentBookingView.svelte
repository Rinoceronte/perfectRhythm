<script lang="ts">
	import { SvelteSet, SvelteDate } from 'svelte/reactivity';
	import type { LessonSlot, BookingRequest } from '$lib/shared/types';
	import {
		fetchSlotsForStudent,
		bookSlot,
		registerEventInterest,
		checkEventInterest,
		cancelEventInterest,
		cancelBooking
	} from '$lib/shared/api/schedule';
	import { toScheduleDate } from '$lib/shared/utils';
	import { format, addDays, parseISO } from 'date-fns';

	interface Props {
		coachId: string;
		coachName: string;
		eventStartDate?: string | null;
		eventEndDate?: string | null;
		eventName?: string | null;
		eventId?: string | null;
	}

	let {
		coachId,
		coachName,
		eventStartDate = null,
		eventEndDate = null,
		eventName = null,
		eventId = null
	}: Props = $props();

	// Build date list from event range, or fall back to free navigation
	let hasEventRange = $derived(!!eventStartDate && !!eventEndDate);

	let eventDates = $derived(() => {
		if (!eventStartDate || !eventEndDate) return [];
		const dates: string[] = [];
		let cursor = parseISO(eventStartDate);
		const end = parseISO(eventEndDate);
		while (cursor <= end) {
			dates.push(cursor.toISOString().slice(0, 10));
			cursor = addDays(cursor, 1);
		}
		return dates;
	});

	let selectedDate = $state(eventStartDate ?? toScheduleDate(new Date()));
	let slots = $state<LessonSlot[]>([]);
	let loading = $state(false);
	let bookingSlotId = $state<string | null>(null);
	let bookingNotes = $state('');
	let bookingError = $state('');
	let myBookings = $state<BookingRequest[]>([]);

	// Waiting list state
	let joinedWaitingList = $state(false);
	let joiningWaitingList = $state(false);
	let cancellingWaitingList = $state(false);
	let showWaitingListModal = $state(false);
	let preferredDates = $state<Set<string>>(new Set());

	// Track whether ALL event dates have no slots
	let allDatesEmpty = $state(false);
	let checkingDates = $state(false);

	async function checkAllDatesEmpty() {
		if (!eventStartDate || !eventEndDate) {
			allDatesEmpty = false;
			return;
		}
		checkingDates = true;
		const dates = eventDates();
		for (const dateStr of dates) {
			const res = await fetchSlotsForStudent(coachId, dateStr);
			if (!res.error && res.data.length > 0) {
				allDatesEmpty = false;
				checkingDates = false;
				return;
			}
		}
		allDatesEmpty = true;
		checkingDates = false;
	}

	function togglePreferredDate(dateStr: string) {
		const next = new SvelteSet(preferredDates);
		if (next.has(dateStr)) {
			next.delete(dateStr);
		} else {
			next.add(dateStr);
		}
		preferredDates = next;
	}

	async function checkExistingInterest() {
		if (!eventId) return;
		const res = await checkEventInterest(eventId, coachId);
		if (!res.error && res.data.interested) {
			joinedWaitingList = true;
		}
	}

	async function joinWaitingList() {
		if (!eventId) return;
		joiningWaitingList = true;
		// TODO: pass preferredDates to the API when we add that field
		const res = await registerEventInterest({ eventId, coachId });
		if (!res.error) {
			joinedWaitingList = true;
			showWaitingListModal = false;
		}
		joiningWaitingList = false;
	}

	async function leaveWaitingList() {
		if (!eventId) return;
		cancellingWaitingList = true;
		const res = await cancelEventInterest(eventId, coachId);
		if (!res.error) {
			joinedWaitingList = false;
		}
		cancellingWaitingList = false;
	}

	async function loadSlots(date: string) {
		loading = true;
		const res = await fetchSlotsForStudent(coachId, date);
		slots = res.error ? [] : res.data;
		loading = false;
	}

	$effect(() => {
		// Only track selectedDate — not loading/slots
		const date = selectedDate;
		loadSlots(date);
	});

	// On mount, check if the entire event has no availability yet
	$effect(() => {
		// Only track these specific values
		const eid = eventId;
		const sd = eventStartDate;
		const ed = eventEndDate;
		if (eid && sd && ed) {
			checkAllDatesEmpty();
		}
	});

	// Check if student already expressed interest in this event
	$effect(() => {
		const eid = eventId;
		if (eid) {
			checkExistingInterest();
		}
	});

	function prevDay() {
		const d = new SvelteDate(selectedDate + 'T12:00:00');
		d.setDate(d.getDate() - 1);
		selectedDate = d.toISOString().slice(0, 10);
	}

	function nextDay() {
		const d = new SvelteDate(selectedDate + 'T12:00:00');
		d.setDate(d.getDate() + 1);
		selectedDate = d.toISOString().slice(0, 10);
	}

	function openBooking(slot: LessonSlot) {
		bookingSlotId = slot.id;
		bookingNotes = '';
		bookingError = '';
	}

	async function confirmBooking() {
		if (!bookingSlotId) return;
		bookingError = '';

		const res = await bookSlot({ slotId: bookingSlotId, coachId, notes: bookingNotes });
		if (res.error) {
			bookingError = res.error.message;
			return;
		}
		myBookings = [...myBookings, res.data];
		bookingSlotId = null;
		await loadSlots(selectedDate);
	}

	async function handleCancel(bookingId: string) {
		if (!confirm('Cancel this booking?')) return;
		const res = await cancelBooking(bookingId);
		if (res.error) {
			alert(res.error.message);
			return;
		}
		myBookings = myBookings.map((b) =>
			b.id === bookingId ? { ...b, status: 'cancelled' } : b
		) as BookingRequest[];
		await loadSlots(selectedDate);
	}

	function formatTime(d: Date) {
		return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatDateTab(dateStr: string) {
		return format(parseISO(dateStr), 'EEE, MMM d');
	}

	function bookingForSlot(slotId: string) {
		return myBookings.find((b) => b.slotId === slotId && b.status !== 'cancelled');
	}

	// Lesson notes state
	let viewingBookingId = $state<string | null>(null);
	let notesBefore = $state('');
	let notesAfter = $state('');
	let savingNotes = $state(false);

	function openLessonNotes(booking: BookingRequest) {
		viewingBookingId = booking.id;
		notesBefore = booking.studentNotesBefore ?? '';
		notesAfter = booking.studentNotesAfter ?? '';
	}

	async function saveLessonNotes() {
		if (!viewingBookingId) return;
		savingNotes = true;
		const res = await fetch(`/api/v1/schedule/bookings/${viewingBookingId}/notes`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				studentNotesBefore: notesBefore,
				studentNotesAfter: notesAfter
			})
		});
		const json = await res.json();
		savingNotes = false;

		if (json.data) {
			myBookings = myBookings.map((b) =>
				b.id === viewingBookingId
					? { ...b, studentNotesBefore: notesBefore || null, studentNotesAfter: notesAfter || null }
					: b
			) as BookingRequest[];
			viewingBookingId = null;
		}
	}

	function handleNotesKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			saveLessonNotes();
		}
	}

	const statusColors: Record<string, string> = {
		pending: 'bg-amber-100 text-amber-700',
		confirmed: 'bg-green-100 text-green-700',
		cancelled: 'bg-red-100 text-red-500'
	};
</script>

<div class="space-y-4">
	<!-- Header -->
	<div>
		<h2 class="text-lg font-semibold text-slate-800">{coachName}</h2>
		{#if eventName}
			<p class="text-sm text-slate-500">{eventName}</p>
		{/if}
	</div>

	{#if checkingDates}
		<div class="py-12 text-center text-sm text-slate-400">Loading…</div>
	{:else if allDatesEmpty && eventId}
		<!-- No availability for the entire event — waiting list -->
		<div class="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
			<p class="text-sm font-medium text-slate-700">No availability posted yet</p>
			<p class="mt-1 text-sm text-slate-500">
				{coachName} hasn't set up lesson times for this event yet.
			</p>
			{#if joinedWaitingList}
				<p class="mt-3 text-sm font-medium text-green-700">
					You're on the list — we'll notify you when slots open up.
				</p>
				<button
					onclick={leaveWaitingList}
					disabled={cancellingWaitingList}
					class="mt-2 text-sm text-slate-500 hover:text-red-600 disabled:opacity-50"
				>
					{cancellingWaitingList ? 'Removing...' : 'Remove from waiting list'}
				</button>
			{:else}
				<button
					onclick={() => (showWaitingListModal = true)}
					class="mt-4 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>
					Join waiting list
				</button>
			{/if}
		</div>
	{:else}
		<!-- Date navigation (only shown when there are slots to browse) -->
		{#if hasEventRange}
			<div class="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm">
				{#each eventDates() as dateStr (dateStr)}
					<button
						onclick={() => (selectedDate = dateStr)}
						class="flex-1 rounded-lg px-3 py-2 font-medium whitespace-nowrap transition-colors {selectedDate ===
						dateStr
							? 'bg-white text-slate-800 shadow'
							: 'text-slate-500 hover:text-slate-700'}"
					>
						{formatDateTab(dateStr)}
					</button>
				{/each}
			</div>
		{:else}
			<div class="flex items-center justify-end gap-2">
				<button
					onclick={prevDay}
					class="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
					aria-label="Previous day"
				>
					←
				</button>
				<input
					type="date"
					bind:value={selectedDate}
					class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
				/>
				<button
					onclick={nextDay}
					class="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
					aria-label="Next day"
				>
					→
				</button>
			</div>
		{/if}

		{#if loading}
			<div class="py-12 text-center text-sm text-slate-400">Loading…</div>
		{:else if slots.length === 0}
			<div class="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
				<p class="text-sm text-slate-500">No available slots on this date.</p>
				<p class="mt-1 text-xs text-slate-400">
					Check back when booking opens, or try another date.
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each slots as slot (slot.id)}
					{@const booking = bookingForSlot(slot.id)}
					<div
						class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
					>
						<span class="font-medium text-slate-800">
							{formatTime(slot.startTime)} – {formatTime(slot.endTime)}
						</span>

						{#if booking}
							<div class="flex items-center gap-2">
								<span
									class="rounded-full px-2 py-0.5 text-xs font-medium {statusColors[
										booking.status
									]}">{booking.status}</span
								>
								{#if booking.status !== 'cancelled'}
									<button
										onclick={() => openLessonNotes(booking)}
										class="text-xs text-indigo-600 hover:underline">Notes</button
									>
									<button
										onclick={() => handleCancel(booking.id)}
										class="text-xs text-red-500 hover:underline">Cancel</button
									>
								{/if}
							</div>
						{:else}
							<button
								onclick={() => openBooking(slot)}
								class="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
								>Book</button
							>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Waiting list modal -->
{#if showWaitingListModal}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
			<h3 class="mb-1 text-base font-semibold text-slate-800">Join waiting list</h3>
			<p class="mb-4 text-sm text-slate-500">Which dates work for you? (optional)</p>

			<div class="mb-4 flex flex-wrap gap-2">
				{#each eventDates() as dateStr (dateStr)}
					<button
						onclick={() => togglePreferredDate(dateStr)}
						class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors {preferredDates.has(
							dateStr
						)
							? 'border-indigo-600 bg-indigo-600 text-white'
							: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}"
					>
						{formatDateTab(dateStr)}
					</button>
				{/each}
			</div>

			<div class="flex gap-3">
				<button
					onclick={() => (showWaitingListModal = false)}
					class="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
				>
					Cancel
				</button>
				<button
					onclick={joinWaitingList}
					disabled={joiningWaitingList}
					class="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					{joiningWaitingList ? 'Joining...' : 'Join list'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Booking confirmation modal -->
{#if bookingSlotId}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
			<h3 class="mb-3 text-base font-semibold text-slate-800">Book this lesson</h3>

			{#if bookingError}
				<p class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{bookingError}</p>
			{/if}

			<label class="mb-1 block text-xs font-medium text-slate-600"
				>Message to coach (optional)</label
			>
			<textarea
				bind:value={bookingNotes}
				placeholder="Anything you'd like the coach to know…"
				rows="3"
				class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
			></textarea>

			<div class="mt-4 flex gap-3">
				<button
					onclick={() => (bookingSlotId = null)}
					class="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
				>
					Cancel
				</button>
				<button
					onclick={confirmBooking}
					class="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
				>
					Confirm booking
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Lesson notes modal -->
{#if viewingBookingId}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget && !savingNotes) viewingBookingId = null;
		}}
	>
		<div class="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
			<h3 class="mb-4 text-base font-semibold text-slate-800">Lesson notes</h3>

			<div class="space-y-4">
				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600"
						>Before — what I want to work on</label
					>
					<textarea
						bind:value={notesBefore}
						onkeydown={handleNotesKeydown}
						placeholder="Goals, questions, things to focus on..."
						rows={3}
						maxlength={2000}
						class="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
					></textarea>
				</div>

				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">After — what I learned</label
					>
					<textarea
						bind:value={notesAfter}
						onkeydown={handleNotesKeydown}
						placeholder="Key takeaways, drills to practice, things to remember..."
						rows={3}
						maxlength={2000}
						class="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
					></textarea>
				</div>
			</div>

			<div class="mt-4 flex gap-3">
				<button
					onclick={() => (viewingBookingId = null)}
					disabled={savingNotes}
					class="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={saveLessonNotes}
					disabled={savingNotes}
					class="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					{savingNotes ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

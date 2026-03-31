<script lang="ts">
	import type { AvailabilityBlock, BookingWithDetails } from '$lib/shared/types';
	import {
		createAvailabilityBlock,
		updateAvailabilityBlock,
		deleteAvailabilityBlock,
		publishAvailabilityBlock,
		respondToBooking,
		cancelBooking
	} from '$lib/shared/api/schedule';

	interface Props {
		date: string; // YYYY-MM-DD
		eventId: string | null;
		blocks: AvailabilityBlock[];
		bookings: BookingWithDetails[];
		onBlocksChanged: (blocks: AvailabilityBlock[]) => void;
		onBookingsChanged?: (bookings: BookingWithDetails[]) => void;
	}

	let { date, eventId, blocks, bookings = [], onBlocksChanged, onBookingsChanged }: Props = $props();

	// Timeline runs full 24 hours
	const START_HOUR = 0;
	const END_HOUR = 24;
	const TOTAL_HOURS = END_HOUR - START_HOUR;
	const HOUR_HEIGHT = 60; // px per hour
	const SNAP_MINUTES = 15;
	const TOP_PAD = 12; // px so 12am label isn't clipped

	let timelineEl = $state<HTMLDivElement | null>(null);
	let dragging = $state(false);
	let dragStartY = $state(0);
	let dragCurrentY = $state(0);
	let saving = $state(false);

	// Block popover state
	let editingBlock = $state<AvailabilityBlock | null>(null);
	let editDuration = $state(45);
	let editGap = $state(0);
	let editStartTime = $state('10:00');
	let editEndTime = $state('14:00');

	// Booking popover state
	let viewingBooking = $state<BookingWithDetails | null>(null);
	let coachNotes = $state<string | null>(null);
	let loadingNotes = $state(false);

	// --- Derived: blocks visible on this day (including overnight overflow from previous day) ---

	interface DayBlockEntry {
		block: AvailabilityBlock;
		clippedStart: string;
		clippedEnd: string;
		isOverflow: boolean;
	}

	let dayBlocks = $derived.by((): DayBlockEntry[] => {
		const prevDate = new Date(date + 'T12:00:00');
		prevDate.setDate(prevDate.getDate() - 1);
		const prevDateStr = prevDate.toISOString().slice(0, 10);

		const result: DayBlockEntry[] = [];

		for (const b of blocks) {
			const isOvernight = b.endTime <= b.startTime; // e.g. 21:30 -> 00:45

			if (b.scheduleDate === date) {
				if (isOvernight) {
					result.push({ block: b, clippedStart: b.startTime, clippedEnd: '24:00', isOverflow: false });
				} else {
					result.push({ block: b, clippedStart: b.startTime, clippedEnd: b.endTime, isOverflow: false });
				}
			} else if (b.scheduleDate === prevDateStr && isOvernight) {
				result.push({ block: b, clippedStart: '00:00', clippedEnd: b.endTime, isOverflow: true });
			}
		}

		return result;
	});

	let dayBookings = $derived(bookings.filter((b) => {
		const slotDate = new Date(b.slot.startTime).toISOString().slice(0, 10);
		return slotDate === date && (b.status === 'confirmed' || b.status === 'pending');
	}));

	// --- Positioning helpers ---

	function yToMinutes(y: number): number {
		if (!timelineEl) return 0;
		const rect = timelineEl.getBoundingClientRect();
		const relY = y - rect.top + timelineEl.scrollTop - TOP_PAD;
		const totalMinutes = (relY / (TOTAL_HOURS * HOUR_HEIGHT)) * TOTAL_HOURS * 60;
		return Math.round((totalMinutes + START_HOUR * 60) / SNAP_MINUTES) * SNAP_MINUTES;
	}

	function minutesToY(minutes: number): number {
		return ((minutes - START_HOUR * 60) / (TOTAL_HOURS * 60)) * TOTAL_HOURS * HOUR_HEIGHT + TOP_PAD;
	}

	function minutesToTime(m: number): string {
		const h = Math.floor(m / 60) % 24;
		const min = m % 60;
		return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
	}

	function formatTime12(m: number): string {
		const h = Math.floor(m / 60) % 24;
		const min = m % 60;
		const ampm = h >= 12 ? 'pm' : 'am';
		const h12 = h % 12 || 12;
		return `${h12}:${min.toString().padStart(2, '0')}${ampm}`;
	}

	function timeToMinutes(t: string): number {
		const [h, m] = t.split(':').map(Number);
		return h * 60 + m;
	}

	function entryTop(entry: DayBlockEntry): number {
		return minutesToY(timeToMinutes(entry.clippedStart));
	}

	function entryHeight(entry: DayBlockEntry): number {
		let startMins = timeToMinutes(entry.clippedStart);
		let endMins = timeToMinutes(entry.clippedEnd);
		if (endMins <= startMins) endMins += 24 * 60;
		return minutesToY(startMins + (endMins - startMins)) - minutesToY(startMins);
	}

	function bookingTop(booking: BookingWithDetails): number {
		const d = new Date(booking.slot.startTime);
		return minutesToY(d.getHours() * 60 + d.getMinutes());
	}

	function bookingHeight(booking: BookingWithDetails): number {
		const s = new Date(booking.slot.startTime);
		const e = new Date(booking.slot.endTime);
		const durationMins = (e.getTime() - s.getTime()) / 60000;
		return (durationMins / (TOTAL_HOURS * 60)) * TOTAL_HOURS * HOUR_HEIGHT;
	}

	function blockTimeLabel(block: AvailabilityBlock): string {
		return `${formatTime12(timeToMinutes(block.startTime))} \u2013 ${formatTime12(timeToMinutes(block.endTime))}`;
	}

	function estimateSlots(block: AvailabilityBlock): number {
		let startMins = timeToMinutes(block.startTime);
		let endMins = timeToMinutes(block.endTime);
		if (endMins <= startMins) endMins += 24 * 60;
		const perSlot = block.lessonDurationMinutes + block.gapMinutes;
		if (perSlot <= 0) return 0;
		return Math.floor((endMins - startMins) / perSlot);
	}

	// --- Drag: create new blocks or resize existing block edges ---

	type DragMode = 'create' | 'resize-top' | 'resize-bottom';
	let dragMode = $state<DragMode>('create');
	let resizingBlock = $state<AvailabilityBlock | null>(null);

	let dragStartMin = $derived(Math.min(yToMinutes(dragStartY), yToMinutes(dragCurrentY)));
	let dragEndMin = $derived(Math.max(yToMinutes(dragStartY), yToMinutes(dragCurrentY)));
	let dragCurrentMin = $derived(yToMinutes(dragCurrentY));

	// During resize, compute the preview start/end for the resizing block
	let resizePreviewStart = $derived.by(() => {
		if (!dragging || !resizingBlock) return 0;
		if (dragMode === 'resize-top') {
			return Math.max(0, Math.min(dragCurrentMin, timeToMinutes(resizingBlock.endTime) - SNAP_MINUTES));
		}
		return timeToMinutes(resizingBlock.startTime);
	});

	let resizePreviewEnd = $derived.by(() => {
		if (!dragging || !resizingBlock) return 0;
		if (dragMode === 'resize-bottom') {
			return Math.max(timeToMinutes(resizingBlock.startTime) + SNAP_MINUTES, Math.min(dragCurrentMin, 24 * 60));
		}
		let endMins = timeToMinutes(resizingBlock.endTime);
		if (endMins <= timeToMinutes(resizingBlock.startTime)) endMins += 24 * 60;
		return endMins;
	});

	function handlePointerDown(e: PointerEvent) {
		// Check if clicking on a resize handle
		const handle = (e.target as HTMLElement).closest('[data-resize]');
		if (handle) {
			const blockId = handle.getAttribute('data-block-id')!;
			const edge = handle.getAttribute('data-resize') as 'top' | 'bottom';
			const block = blocks.find((b) => b.id === blockId);
			if (!block) return;

			resizingBlock = block;
			dragMode = edge === 'top' ? 'resize-top' : 'resize-bottom';
			dragging = true;
			dragStartY = e.clientY;
			dragCurrentY = e.clientY;
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
			return;
		}

		// Don't start create-drag on existing blocks
		if ((e.target as HTMLElement).closest('[data-block]')) return;

		dragMode = 'create';
		resizingBlock = null;
		dragging = true;
		dragStartY = e.clientY;
		dragCurrentY = e.clientY;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		dragCurrentY = e.clientY;
	}

	async function handlePointerUp() {
		if (!dragging) return;
		dragging = false;

		if (dragMode === 'create') {
			const startMin = dragStartMin;
			const endMin = dragEndMin;
			if (endMin - startMin < SNAP_MINUTES) return;

			saving = true;
			const res = await createAvailabilityBlock({
				eventId: eventId,
				location: null,
				scheduleDate: date,
				startTime: minutesToTime(startMin),
				endTime: minutesToTime(endMin),
				lessonDurationMinutes: 45,
				gapMinutes: 0,
				maxStudents: null,
				bookingOpenAt: null,
				priorityBookingOpenAt: null
			});
			saving = false;

			if (res.data) {
				onBlocksChanged([...blocks, res.data]);
				editingBlock = res.data;
				editDuration = res.data.lessonDurationMinutes;
				editGap = res.data.gapMinutes;
				editStartTime = res.data.startTime;
				editEndTime = res.data.endTime;
			}
		} else if (resizingBlock) {
			const currentMin = yToMinutes(dragCurrentY);
			let newStart = resizingBlock.startTime;
			let newEnd = resizingBlock.endTime;

			if (dragMode === 'resize-top') {
				newStart = minutesToTime(Math.max(0, Math.min(currentMin, timeToMinutes(resizingBlock.endTime) - SNAP_MINUTES)));
			} else {
				newEnd = minutesToTime(Math.max(timeToMinutes(resizingBlock.startTime) + SNAP_MINUTES, Math.min(currentMin, 24 * 60)));
			}

			if (newStart === resizingBlock.startTime && newEnd === resizingBlock.endTime) return;

			saving = true;
			const res = await updateAvailabilityBlock(resizingBlock.id, {
				startTime: newStart,
				endTime: newEnd
			});
			saving = false;

			if (res.data) {
				onBlocksChanged(blocks.map((b) => (b.id === resizingBlock!.id ? res.data! : b)));
			}
		}

		resizingBlock = null;
	}

	// --- Edit ---

	function openEdit(block: AvailabilityBlock, e: MouseEvent) {
		e.stopPropagation();
		editingBlock = editingBlock?.id === block.id ? null : block;
		editDuration = block.lessonDurationMinutes;
		editGap = block.gapMinutes;
		editStartTime = block.startTime;
		editEndTime = block.endTime;
	}

	async function saveBlockSettings() {
		if (!editingBlock) return;
		saving = true;
		const res = await updateAvailabilityBlock(editingBlock.id, {
			startTime: editStartTime,
			endTime: editEndTime,
			lessonDurationMinutes: editDuration,
			gapMinutes: editGap
		});
		saving = false;
		if (res.data) {
			onBlocksChanged(blocks.map((b) => (b.id === res.data!.id ? res.data! : b)));
			editingBlock = res.data;
		}
	}

	async function handleDelete(block: AvailabilityBlock) {
		const res = await deleteAvailabilityBlock(block.id);
		if (res.data) {
			onBlocksChanged(blocks.filter((b) => b.id !== block.id));
			if (editingBlock?.id === block.id) editingBlock = null;
		}
	}

	async function handlePublish(block: AvailabilityBlock) {
		const res = await publishAvailabilityBlock(block.id);
		if (res.data) {
			onBlocksChanged(blocks.map((b) => (b.id === block.id ? { ...b, isPublished: true } : b)));
			if (editingBlock?.id === block.id) editingBlock = { ...editingBlock, isPublished: true };
		}
	}

	async function openBooking(booking: BookingWithDetails) {
		viewingBooking = booking;
		coachNotes = null;
		loadingNotes = true;
		try {
			const res = await fetch(`/api/v1/students/${booking.studentId}/notes`);
			const data = await res.json();
			if (data.data?.notes != null) coachNotes = data.data.notes;
		} catch { /* ignore */ }
		loadingNotes = false;
	}

	async function handleConfirmBooking(booking: BookingWithDetails) {
		const res = await respondToBooking(booking.id, { status: 'confirmed' });
		if (res.data) {
			const updated = bookings.map((b) => b.id === booking.id ? { ...b, status: 'confirmed' as const } : b);
			onBookingsChanged?.(updated);
			viewingBooking = { ...booking, status: 'confirmed' };
		}
	}

	async function handleDeclineBooking(booking: BookingWithDetails) {
		const res = await respondToBooking(booking.id, { status: 'declined' });
		if (res.data) {
			const updated = bookings.filter((b) => b.id !== booking.id);
			onBookingsChanged?.(updated);
			viewingBooking = null;
		}
	}

	async function handleCancelBooking(booking: BookingWithDetails) {
		if (!confirm(`Cancel ${booking.studentDisplayName}'s lesson?`)) return;
		const res = await cancelBooking(booking.id);
		if (res.data) {
			const updated = bookings.filter((b) => b.id !== booking.id);
			onBookingsChanged?.(updated);
			viewingBooking = null;
		}
	}
</script>

<div class="relative select-none">
	<!-- Timeline -->
	<div
		bind:this={timelineEl}
		class="relative overflow-y-auto border border-zinc-200 rounded-lg bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		style="height: {Math.min(TOTAL_HOURS * HOUR_HEIGHT, 600)}px"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		role="application"
		aria-label="Day timeline"
	>
		<div class="relative" style="height: {TOTAL_HOURS * HOUR_HEIGHT + TOP_PAD}px">
			<!-- Hour lines -->
			{#each Array(TOTAL_HOURS + 1) as _, i}
				{@const hour = (START_HOUR + i) % 24}
				<div
					class="absolute left-0 right-0 border-t border-zinc-100"
					style="top: {i * HOUR_HEIGHT + TOP_PAD}px"
				>
					<span class="absolute -top-2.5 left-2 text-xs text-zinc-400 bg-white px-1">
						{hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
					</span>
				</div>
			{/each}

			<!-- Block time labels (left gutter) -->
			{#each dayBlocks as entry (entry.block.id + (entry.isOverflow ? '-overflow' : '') + '-label')}
				{#if !entry.isOverflow}
					<span
						class="absolute left-0.5 text-[11px] font-semibold text-emerald-600 bg-white px-0.5 z-20 pointer-events-none"
						style="top: {entryTop(entry) - 7}px"
					>
						{formatTime12(timeToMinutes(entry.clippedStart))}
					</span>
				{/if}
				<span
					class="absolute left-0.5 text-[11px] font-semibold text-emerald-600 bg-white px-0.5 z-20 pointer-events-none"
					style="top: {entryTop(entry) + entryHeight(entry) - 7}px"
				>
					{formatTime12(timeToMinutes(entry.clippedEnd))}
				</span>
			{/each}

			<!-- Blocks -->
			{#each dayBlocks as entry (entry.block.id + (entry.isOverflow ? '-overflow' : ''))}
				<div
					data-block
					class="absolute left-12 right-2 rounded-lg border-2 text-left text-xs transition-colors
						{entry.block.isPublished
							? 'border-emerald-300 bg-emerald-50'
							: 'border-indigo-300 bg-indigo-50'}
						{entry.isOverflow ? 'opacity-70 border-dashed' : ''}"
					style="top: {entryTop(entry)}px; height: {Math.max(entryHeight(entry), 24)}px"
				>
					<!-- Top resize handle -->
					{#if !entry.isOverflow}
						<div
							data-resize="top"
							data-block-id={entry.block.id}
							class="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
						></div>
					{/if}

					<!-- Block content (click to edit) -->
					<button
						onclick={(e) => openEdit(entry.block, e)}
						class="w-full h-full px-2 py-1 text-left"
					>
					</button>

					<!-- Bottom resize handle -->
					{#if !entry.isOverflow}
						<div
							data-resize="bottom"
							data-block-id={entry.block.id}
							class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10"
						></div>
					{/if}
				</div>
			{/each}

			<!-- Bookings -->
			{#each dayBookings as booking (booking.id)}
				<button
					data-block
					onclick={(e) => { e.stopPropagation(); openBooking(booking); }}
					class="absolute left-14 right-4 rounded px-1.5 py-0.5 text-[11px] leading-tight text-left cursor-pointer
						{booking.status === 'confirmed'
							? 'bg-green-100 border border-green-300 text-green-800 hover:bg-green-200'
							: 'bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200'}"
					style="top: {bookingTop(booking)}px; height: {Math.max(bookingHeight(booking), 18)}px"
				>
					<span class="font-medium truncate block">{booking.studentDisplayName}</span>
					{#if bookingHeight(booking) >= 30}
						<span class="text-[10px] opacity-70">{booking.status}</span>
					{/if}
				</button>
			{/each}

			<!-- Create drag preview -->
			{#if dragging && dragMode === 'create' && dragEndMin - dragStartMin >= SNAP_MINUTES}
				<div
					class="absolute left-12 right-2 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-100/50 px-2 py-1 text-xs font-medium text-indigo-600 pointer-events-none"
					style="top: {minutesToY(dragStartMin)}px; height: {minutesToY(dragEndMin) - minutesToY(dragStartMin)}px"
				>
					{formatTime12(dragStartMin)} &ndash; {formatTime12(dragEndMin)}
				</div>
			{/if}

			<!-- Resize preview -->
			{#if dragging && resizingBlock && (dragMode === 'resize-top' || dragMode === 'resize-bottom')}
				<div
					class="absolute left-12 right-2 rounded-lg border-2 border-indigo-400 bg-indigo-100/40 pointer-events-none"
					style="top: {minutesToY(resizePreviewStart)}px; height: {minutesToY(resizePreviewEnd) - minutesToY(resizePreviewStart)}px"
				></div>
				<!-- Time label at the dragged edge -->
				<div
					class="absolute left-0 right-0 pointer-events-none flex items-center"
					style="top: {minutesToY(dragMode === 'resize-top' ? resizePreviewStart : resizePreviewEnd) - 10}px"
				>
					<span class="bg-indigo-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full ml-1">
						{formatTime12(dragMode === 'resize-top' ? resizePreviewStart : resizePreviewEnd)}
					</span>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Block edit popup -->
{#if editingBlock}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
		role="dialog"
		aria-modal="true"
		onclick={(e) => { if (e.target === e.currentTarget && editingBlock?.isPublished) editingBlock = null; }}
	>
		<div class="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
			<div class="p-5 space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-1.5">
						<input
							type="time"
							bind:value={editStartTime}
							onchange={saveBlockSettings}
							class="w-[7rem] rounded-lg border border-zinc-200 px-2 py-1.5 text-sm font-semibold text-zinc-900 focus:border-zinc-400 focus:outline-none"
						/>
						<span class="text-zinc-400">&ndash;</span>
						<input
							type="time"
							bind:value={editEndTime}
							onchange={saveBlockSettings}
							class="w-[7rem] rounded-lg border border-zinc-200 px-2 py-1.5 text-sm font-semibold text-zinc-900 focus:border-zinc-400 focus:outline-none"
						/>
					</div>
					{#if editingBlock.isPublished}
						<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Published</span>
					{:else}
						<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Draft</span>
					{/if}
				</div>

				<!-- Duration -->
				<div class="flex items-center justify-between">
					<span class="text-sm text-zinc-600">Lesson duration</span>
					<div class="flex items-center gap-2">
						<button
							onclick={() => { if (editDuration > 15) { editDuration -= 5; saveBlockSettings(); } }}
							class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-lg text-zinc-600 hover:bg-zinc-50 active:bg-zinc-100"
						>&minus;</button>
						<span class="w-14 text-center text-sm font-semibold tabular-nums">{editDuration}min</span>
						<button
							onclick={() => { editDuration += 5; saveBlockSettings(); }}
							class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-lg text-zinc-600 hover:bg-zinc-50 active:bg-zinc-100"
						>+</button>
					</div>
				</div>

				<!-- Gap -->
				<div class="flex items-center justify-between">
					<span class="text-sm text-zinc-600">Gap between</span>
					<div class="flex items-center gap-2">
						<button
							onclick={() => { if (editGap > 0) { editGap -= 5; saveBlockSettings(); } }}
							class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-lg text-zinc-600 hover:bg-zinc-50 active:bg-zinc-100"
						>&minus;</button>
						<span class="w-14 text-center text-sm font-semibold tabular-nums">{editGap}min</span>
						<button
							onclick={() => { editGap += 5; saveBlockSettings(); }}
							class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-lg text-zinc-600 hover:bg-zinc-50 active:bg-zinc-100"
						>+</button>
					</div>
				</div>

				<p class="text-xs text-zinc-400">~{estimateSlots(editingBlock)} lesson slots</p>

				<!-- Actions -->
				<div class="flex gap-2 pt-1">
					{#if !editingBlock.isPublished}
						<button
							onclick={() => { if (editingBlock) { handlePublish(editingBlock); editingBlock = null; } }}
							class="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
						>Publish</button>
						<button
							onclick={() => { if (editingBlock) { handleDelete(editingBlock); editingBlock = null; } }}
							class="flex-1 rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
						>Delete</button>
					{:else}
						<button
							onclick={() => { if (editingBlock) { handleDelete(editingBlock); editingBlock = null; } }}
							class="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
						>Delete</button>
						<button
							onclick={() => (editingBlock = null)}
							class="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
						>Done</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Booking detail popup -->
{#if viewingBooking}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
		role="dialog"
		aria-modal="true"
		onclick={(e) => { if (e.target === e.currentTarget) viewingBooking = null; }}
	>
		<div class="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
			<div class="p-5 space-y-4">
				<!-- Student info -->
				<div class="flex items-center gap-3">
					<a href="/students/{viewingBooking.studentId}" class="shrink-0">
						{#if viewingBooking.studentAvatarUrl}
							<img
								src={viewingBooking.studentAvatarUrl}
								alt=""
								class="h-10 w-10 rounded-full object-cover"
							/>
						{:else}
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white">
								{viewingBooking.studentDisplayName.charAt(0).toUpperCase()}
							</div>
						{/if}
					</a>
					<div>
						<a href="/students/{viewingBooking.studentId}" class="font-semibold text-zinc-900 hover:underline">
							{viewingBooking.studentDisplayName}
						</a>
						<p class="text-sm text-zinc-500">
							{formatTime12(new Date(viewingBooking.slot.startTime).getHours() * 60 + new Date(viewingBooking.slot.startTime).getMinutes())}
							&ndash;
							{formatTime12(new Date(viewingBooking.slot.endTime).getHours() * 60 + new Date(viewingBooking.slot.endTime).getMinutes())}
						</p>
					</div>
					<span class="ml-auto rounded-full px-2 py-0.5 text-xs font-medium
						{viewingBooking.status === 'confirmed'
							? 'bg-green-100 text-green-700'
							: 'bg-amber-100 text-amber-700'}">
						{viewingBooking.status}
					</span>
				</div>

				{#if viewingBooking.notes}
					<div class="rounded-lg bg-zinc-50 px-3 py-2">
						<p class="text-xs text-zinc-500 mb-1">Note from student</p>
						<p class="text-sm text-zinc-700 italic">"{viewingBooking.notes}"</p>
					</div>
				{/if}

				<!-- Coach's private notes -->
				{#if loadingNotes}
					<p class="text-xs text-zinc-400">Loading notes...</p>
				{:else if coachNotes}
					<div class="rounded-lg bg-blue-50 px-3 py-2">
						<p class="text-xs text-blue-500 mb-1">Your notes</p>
						<p class="text-sm text-blue-800">{coachNotes}</p>
					</div>
				{/if}

				<div class="flex gap-2 pt-1">
					{#if viewingBooking.status === 'pending'}
						<button
							onclick={() => viewingBooking && handleConfirmBooking(viewingBooking)}
							class="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700"
						>Confirm</button>
						<button
							onclick={() => viewingBooking && handleDeclineBooking(viewingBooking)}
							class="flex-1 rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
						>Decline</button>
					{:else if viewingBooking.status === 'confirmed'}
						<button
							onclick={() => viewingBooking && handleCancelBooking(viewingBooking)}
							class="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
						>Cancel lesson</button>
						<button
							onclick={() => (viewingBooking = null)}
							class="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
						>Done</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

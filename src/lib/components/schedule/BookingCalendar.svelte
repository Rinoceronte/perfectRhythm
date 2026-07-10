<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import type { BookingWithDetails } from '$lib/shared/types';
	import { respondToBooking, cancelBooking } from '$lib/shared/api/schedule';

	interface Props {
		bookings: BookingWithDetails[];
		onBookingUpdated?: (booking: BookingWithDetails) => void;
	}

	let { bookings = $bindable([]), onBookingUpdated }: Props = $props();

	let filter = $state<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');

	let filtered = $derived(
		filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)
	);

	// Group by schedule date (most recent first)
	let grouped = $derived.by(() => {
		const map = new SvelteMap<string, BookingWithDetails[]>();
		for (const b of filtered) {
			const date = new Date(b.slot.startTime).toISOString().slice(0, 10);
			if (!map.has(date)) map.set(date, []);
			map.get(date)!.push(b);
		}
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});

	async function handleRespond(booking: BookingWithDetails, status: 'confirmed' | 'declined') {
		const res = await respondToBooking(booking.id, { status });
		if (res.error) {
			alert(res.error.message);
			return;
		}
		bookings = bookings.map((b) =>
			b.id === booking.id ? { ...b, status: res.data.status } : b
		) as BookingWithDetails[];
		onBookingUpdated?.({ ...booking, status: res.data.status });
	}

	async function handleCancel(booking: BookingWithDetails) {
		if (!confirm('Cancel this booking?')) return;
		const res = await cancelBooking(booking.id);
		if (res.error) {
			alert(res.error.message);
			return;
		}
		bookings = bookings.map((b) =>
			b.id === booking.id ? { ...b, status: 'cancelled' } : b
		) as BookingWithDetails[];
	}

	function formatSlotTime(slot: { startTime: Date; endTime: Date }) {
		const start = new Date(slot.startTime);
		const end = new Date(slot.endTime);
		return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
	}

	const statusColors: Record<string, string> = {
		pending: 'bg-amber-100 text-amber-700',
		confirmed: 'bg-green-100 text-green-700',
		declined: 'bg-slate-100 text-slate-500',
		cancelled: 'bg-red-100 text-red-500'
	};
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-slate-800">Bookings</h2>

		<!-- Filter tabs -->
		<div class="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
			{#each ['all', 'pending', 'confirmed', 'cancelled'] as f (f)}
				<button
					onclick={() => (filter = f as typeof filter)}
					class="rounded-md px-3 py-1 font-medium transition-colors {filter === f
						? 'bg-white text-slate-800 shadow'
						: 'text-slate-500 hover:text-slate-700'}"
				>
					{f.charAt(0).toUpperCase() + f.slice(1)}
				</button>
			{/each}
		</div>
	</div>

	{#if grouped.length === 0}
		<div class="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
			<p class="text-sm text-slate-500">No bookings found.</p>
		</div>
	{:else}
		{#each grouped as [date, dayBookings] (date)}
			<div>
				<h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
					{new Date(date + 'T12:00:00').toLocaleDateString([], {
						weekday: 'long',
						month: 'short',
						day: 'numeric'
					})}
				</h3>

				<div class="space-y-2">
					{#each dayBookings.sort((a, b) => new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime()) as booking (booking.id)}
						<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-center gap-3">
									{#if booking.studentAvatarUrl}
										<img
											src={booking.studentAvatarUrl}
											alt={booking.studentDisplayName}
											class="h-9 w-9 rounded-full object-cover"
										/>
									{:else}
										<div
											class="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600"
										>
											{booking.studentDisplayName.charAt(0).toUpperCase()}
										</div>
									{/if}
									<div>
										<p class="font-medium text-slate-800">{booking.studentDisplayName}</p>
										<p class="text-sm text-slate-500">{formatSlotTime(booking.slot)}</p>
										{#if booking.notes}
											<p class="mt-0.5 text-xs text-slate-400 italic">"{booking.notes}"</p>
										{/if}
									</div>
								</div>

								<div class="flex shrink-0 flex-col items-end gap-2">
									<span
										class="rounded-full px-2 py-0.5 text-xs font-medium {statusColors[
											booking.status
										]}"
									>
										{booking.status}
									</span>

									{#if booking.status === 'pending'}
										<div class="flex gap-2">
											<button
												onclick={() => handleRespond(booking, 'declined')}
												class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
												>Decline</button
											>
											<button
												onclick={() => handleRespond(booking, 'confirmed')}
												class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
												>Confirm</button
											>
										</div>
									{:else if booking.status === 'confirmed'}
										<button
											onclick={() => handleCancel(booking)}
											class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
											>Cancel</button
										>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

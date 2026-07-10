<script lang="ts">
	import { format, parseISO } from 'date-fns';
	import { resolve } from '$app/paths';

	let { data } = $props();

	let branding = $derived(data.branding);
	let owner = $derived(data.branding.owner);

	function formatEventDates(startDate: string, endDate: string): string {
		const start = parseISO(startDate);
		const end = parseISO(endDate);
		if (startDate === endDate) return format(start, 'MMM d, yyyy');
		return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
	}
</script>

<svelte:head>
	<title>{branding.siteName}</title>
	{#if branding.tagline}
		<meta name="description" content={branding.tagline} />
	{/if}
</svelte:head>

<div class="min-h-dvh bg-zinc-50">
	<header class="border-b border-zinc-200 bg-white">
		<div class="mx-auto flex h-12 max-w-3xl items-center justify-between px-4">
			<span class="flex items-center gap-2 text-sm font-semibold text-zinc-900">
				{#if branding.logoUrl}
					<img src={branding.logoUrl} alt="" class="h-6 w-6 rounded object-contain" />
				{/if}
				{branding.siteName}
			</span>
			<a href={resolve('/login')} class="text-sm font-medium text-zinc-700 hover:text-zinc-900"
				>Log in</a
			>
		</div>
	</header>

	<main class="mx-auto max-w-3xl space-y-10 px-4 py-10">
		{#if owner}
			<!-- Hero -->
			<section class="space-y-4 text-center">
				{#if branding.logoUrl}
					<img
						src={branding.logoUrl}
						alt="{branding.siteName} logo"
						class="mx-auto h-16 w-16 rounded-lg object-contain"
					/>
				{/if}
				<h1 class="text-3xl font-semibold tracking-tight text-zinc-900">{branding.siteName}</h1>
				{#if branding.tagline}
					<p class="text-zinc-600">{branding.tagline}</p>
				{/if}
				<a
					href={resolve('/signup')}
					class="inline-block rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
				>
					Sign up to book a lesson
				</a>
			</section>

			<!-- Teacher card -->
			<section class="rounded-lg border border-zinc-200 bg-white p-5">
				<div class="flex items-start gap-4">
					{#if owner.avatarUrl}
						<img
							src={owner.avatarUrl}
							alt={owner.displayName}
							class="h-14 w-14 rounded-full object-cover"
						/>
					{:else}
						<div
							class="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-medium text-white"
						>
							{owner.displayName
								.split(' ')
								.map((n) => n[0])
								.join('')
								.toUpperCase()
								.slice(0, 2)}
						</div>
					{/if}
					<div class="min-w-0">
						<h2 class="font-semibold text-zinc-900">{owner.displayName}</h2>
						{#if owner.bio}
							<p class="mt-1 text-sm text-zinc-600">{owner.bio}</p>
						{/if}
					</div>
				</div>
			</section>

			<!-- Upcoming events -->
			{#if data.upcomingEvents.length > 0}
				<section class="space-y-3">
					<h2 class="text-lg font-semibold text-zinc-900">Upcoming events</h2>
					<ul class="space-y-2">
						{#each data.upcomingEvents as event (event.id)}
							<li class="rounded-lg border border-zinc-200 bg-white px-4 py-3">
								<p class="font-medium text-zinc-900">{event.name}</p>
								<p class="text-sm text-zinc-500">
									{formatEventDates(event.startDate, event.endDate)} · {event.city}, {event.stateOrRegion}
								</p>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<!-- Availability -->
			{#if data.availability.length > 0}
				<section class="space-y-3">
					<h2 class="text-lg font-semibold text-zinc-900">Lesson availability</h2>
					<ul class="space-y-2">
						{#each data.availability as block (block.blockId)}
							<li
								class="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
							>
								<div>
									<p class="font-medium text-zinc-900">
										{format(parseISO(block.scheduleDate), 'EEE, MMM d')}
										{#if block.eventName}
											· {block.eventName}
										{:else if block.location}
											· {block.location}
										{/if}
									</p>
									{#if block.bookingOpenAt && block.bookingOpenAt > new Date()}
										<p class="text-sm text-zinc-500">
											Booking opens {format(block.bookingOpenAt, 'MMM d, h:mm a')}
										</p>
									{/if}
								</div>
								<span
									class="shrink-0 text-sm {block.openSlotCount > 0
										? 'text-zinc-600'
										: 'text-zinc-400'}"
								>
									{block.openSlotCount > 0 ? `${block.openSlotCount} open` : 'Fully booked'}
								</span>
							</li>
						{/each}
					</ul>
					<p class="text-sm text-zinc-500">
						<a href={resolve('/signup')} class="font-medium text-zinc-900 hover:underline"
							>Create an account</a
						>
						to see lesson times and book.
					</p>
				</section>
			{:else}
				<p class="text-center text-sm text-zinc-500">
					No upcoming availability posted yet — check back soon.
				</p>
			{/if}
		{:else}
			<!-- Deployment not seeded yet -->
			<section class="py-20 text-center">
				<h1 class="text-2xl font-semibold text-zinc-900">{branding.siteName}</h1>
				<p class="mt-2 text-sm text-zinc-500">This studio isn't set up yet.</p>
			</section>
		{/if}
	</main>
</div>

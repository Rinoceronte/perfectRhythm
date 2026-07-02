<script lang="ts">
	import { format, formatDistanceToNow } from 'date-fns';

	let { data } = $props();

	function formatSlotTime(iso: string) {
		const d = new Date(iso);
		return format(d, 'EEE, MMM d · h:mm a');
	}

	function formatTimeRange(startIso: string, endIso: string) {
		const s = new Date(startIso);
		const e = new Date(endIso);
		return `${format(s, 'EEE, MMM d')} · ${format(s, 'h:mm a')} – ${format(e, 'h:mm a')}`;
	}

	// Student lesson detail popup
	interface StudentLesson {
		id: string;
		coachName: string;
		startTime: string;
		endTime: string;
		status: string;
		studentNotesBefore: string | null;
		studentNotesAfter: string | null;
	}

	let viewingLesson = $state<StudentLesson | null>(null);
	let notesBefore = $state('');
	let notesAfter = $state('');
	let savingNotes = $state(false);

	let lessonIsPast = $derived(
		viewingLesson ? new Date(viewingLesson.endTime) < new Date() : false
	);

	function openLesson(lesson: StudentLesson) {
		viewingLesson = lesson;
		notesBefore = lesson.studentNotesBefore ?? '';
		notesAfter = lesson.studentNotesAfter ?? '';
	}

	async function saveLessonNotes() {
		if (!viewingLesson) return;
		savingNotes = true;
		const res = await fetch(`/api/v1/schedule/bookings/${viewingLesson.id}/notes`, {
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
			viewingLesson.studentNotesBefore = notesBefore || null;
			viewingLesson.studentNotesAfter = notesAfter || null;
			viewingLesson = null;
		}
	}

	function handleNotesKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveLessonNotes();
	}
</script>

<svelte:head>
	<title>Dashboard — Perfect Rhythm</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-8 px-4 py-8">
	<h1 class="text-2xl font-semibold text-zinc-900">
		Welcome back, {data.displayName}
	</h1>

	{#if data.role === 'coach'}
		<!-- Coach Dashboard -->
		<div class="grid gap-6 sm:grid-cols-3">
			<a href="/students" class="rounded-lg border border-zinc-200 bg-white p-4 text-center hover:border-zinc-300 transition-colors">
				<p class="text-2xl font-semibold text-zinc-900">{data.activeStudentCount}</p>
				<p class="mt-1 text-sm text-zinc-500">Active Students</p>
			</a>
			<a href="/schedule?tab=bookings" class="rounded-lg border border-zinc-200 bg-white p-4 text-center hover:border-zinc-300 transition-colors">
				<p class="text-2xl font-semibold text-zinc-900">{data.pendingBookings.length}</p>
				<p class="mt-1 text-sm text-zinc-500">Pending Bookings</p>
			</a>
			<a href="/videos" class="rounded-lg border border-zinc-200 bg-white p-4 text-center hover:border-zinc-300 transition-colors">
				<p class="text-2xl font-semibold text-zinc-900">{data.pendingReviews.length}</p>
				<p class="mt-1 text-sm text-zinc-500">Videos to Review</p>
			</a>
		</div>

		<!-- Pending booking requests -->
		{#if data.pendingBookings.length > 0}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-medium text-zinc-900">Pending Requests</h2>
					<a href="/schedule?tab=bookings" class="text-sm text-zinc-500 hover:text-zinc-900">View all</a>
				</div>
				<ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
					{#each data.pendingBookings as booking}
						<li>
							<a href="/schedule?tab=bookings" class="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
								<div>
									<p class="text-sm font-medium text-zinc-900">{booking.studentName}</p>
									<p class="text-sm text-zinc-500">{formatTimeRange(booking.startTime, booking.endTime)}</p>
								</div>
								<span class="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
									Respond
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Upcoming lessons -->
		{#if data.upcomingLessons.length > 0}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-medium text-zinc-900">Upcoming Lessons</h2>
					<a href="/schedule?tab=bookings" class="text-sm text-zinc-500 hover:text-zinc-900">View all</a>
				</div>
				<ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
					{#each data.upcomingLessons as lesson}
						<li>
							<a href="/schedule?tab=bookings" class="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
								<div>
									<p class="text-sm font-medium text-zinc-900">{lesson.studentName}</p>
									<p class="text-sm text-zinc-500">{formatTimeRange(lesson.startTime, lesson.endTime)}</p>
								</div>
								<span class="rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700">
									confirmed
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Videos to review -->
		{#if data.pendingReviews.length > 0}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-medium text-zinc-900">Videos to Review</h2>
					<a href="/videos" class="text-sm text-zinc-500 hover:text-zinc-900">View all</a>
				</div>
				<ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
					{#each data.pendingReviews as review}
						<li class="flex items-center justify-between px-4 py-3">
							<div>
								<p class="text-sm font-medium text-zinc-900">{review.videoTitle}</p>
								<p class="text-sm text-zinc-500">from {review.studentName}</p>
							</div>
							<a
								href="/videos/{review.videoId}"
								class="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
							>
								Review
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Empty state -->
		{#if data.pendingBookings.length === 0 && data.upcomingLessons.length === 0 && data.pendingReviews.length === 0}
			<div class="rounded-lg border border-dashed border-zinc-300 py-12 text-center">
				<p class="text-sm text-zinc-500">Nothing pending right now.</p>
				<a href="/schedule" class="mt-2 inline-block text-sm font-medium text-zinc-900 hover:underline">
					Set up your availability
				</a>
			</div>
		{/if}

	{:else}
		<!-- Student Dashboard -->

		<!-- Upcoming lessons -->
		{#if data.upcomingLessons.length > 0}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-medium text-zinc-900">Upcoming Lessons</h2>
					<a href="/schedule" class="text-sm text-zinc-500 hover:text-zinc-900">Book more</a>
				</div>
				<ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
					{#each data.upcomingLessons as lesson}
						<li>
							<button
								onclick={() => openLesson(lesson)}
								class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
							>
								<div>
									<p class="text-sm font-medium text-zinc-900">{lesson.coachName}</p>
									<p class="text-sm text-zinc-500">{formatTimeRange(lesson.startTime, lesson.endTime)}</p>
								</div>
								<div class="flex items-center gap-2">
									{#if lesson.studentNotesBefore || lesson.studentNotesAfter}
										<svg class="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
										</svg>
									{/if}
									<span
										class="rounded-full px-2 py-0.5 text-xs font-medium {lesson.status === 'confirmed'
											? 'bg-green-50 text-green-700'
											: 'bg-amber-50 text-amber-700'}"
									>
										{lesson.status}
									</span>
								</div>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Past lessons -->
		{#if data.pastLessons.length > 0}
			<section class="space-y-3">
				<h2 class="text-lg font-medium text-zinc-900">Past Lessons</h2>
				<ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
					{#each data.pastLessons as lesson}
						<li>
							<button
								onclick={() => openLesson(lesson)}
								class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
							>
								<div>
									<p class="text-sm font-medium text-zinc-900">{lesson.coachName}</p>
									<p class="text-sm text-zinc-500">{formatTimeRange(lesson.startTime, lesson.endTime)}</p>
								</div>
								<div class="flex items-center gap-2">
									{#if lesson.studentNotesAfter}
										<svg class="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
										</svg>
									{:else}
										<span class="text-xs text-zinc-400">Add notes</span>
									{/if}
									<span class="rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500">
										completed
									</span>
								</div>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Skills by Category -->
		{#if data.skillsByCategory.length > 0}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-medium text-zinc-900">My Skills</h2>
					<a href="/skills" class="text-sm text-zinc-500 hover:text-zinc-900">View all</a>
				</div>

				<!-- Horizontal bar chart -->
				<div class="rounded-lg border border-zinc-200 bg-white p-4">
					<div class="space-y-3">
						{#each data.skillsByCategory as category}
							<a
								href="/skills?category={encodeURIComponent(category.categoryName)}"
								class="group block"
							>
								<div class="mb-1 flex items-center justify-between">
									<span class="text-sm font-medium text-zinc-900">{category.categoryName}</span>
									<span class="text-xs tabular-nums text-zinc-500">{category.avgScore} / 10</span>
								</div>
								<div class="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
									<div
										class="h-full rounded-full bg-zinc-900 transition-all group-hover:bg-zinc-700"
										style="width: {category.avgScore * 10}%"
									></div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- Recent videos -->
		{#if data.recentVideos.length > 0}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-medium text-zinc-900">Recent Videos</h2>
					<a href="/videos" class="text-sm text-zinc-500 hover:text-zinc-900">View all</a>
				</div>
				<ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
					{#each data.recentVideos as video}
						<li class="flex items-center justify-between px-4 py-3">
							<div class="flex items-center gap-3">
								{#if video.muxPlaybackId}
									<img
										src="https://image.mux.com/{video.muxPlaybackId}/thumbnail.webp?width=80&height=45&fit_mode=smartcrop"
										alt=""
										class="h-10 w-16 rounded object-cover"
									/>
								{:else}
									<div class="flex h-10 w-16 items-center justify-center rounded bg-zinc-100">
										<span class="text-xs text-zinc-400">--</span>
									</div>
								{/if}
								<div>
									<p class="text-sm font-medium text-zinc-900">{video.title}</p>
									<p class="text-xs text-zinc-500">
										{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
									</p>
								</div>
							</div>
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium
									{video.status === 'reviewed' ? 'bg-green-50 text-green-700' :
									video.status === 'ready' ? 'bg-blue-50 text-blue-700' :
									video.status === 'error' ? 'bg-red-50 text-red-700' :
									'bg-zinc-100 text-zinc-600'}"
							>
								{video.status.replace('_', ' ')}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Empty state -->
		{#if data.upcomingLessons.length === 0 && data.recentVideos.length === 0}
			<div class="rounded-lg border border-dashed border-zinc-300 py-12 text-center">
				<p class="text-sm text-zinc-500">You're all set up. Start by booking a lesson or uploading a video.</p>
				<div class="mt-3 flex justify-center gap-3">
					<a href="/schedule" class="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
						Book a lesson
					</a>
					<a href="/videos" class="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
						Upload a video
					</a>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Student lesson detail popup -->
{#if viewingLesson}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
		role="dialog"
		aria-modal="true"
		onclick={(e) => { if (e.target === e.currentTarget && !savingNotes) viewingLesson = null; }}
	>
		<div class="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
			<div class="mb-4">
				<h3 class="text-base font-semibold text-zinc-900">{viewingLesson.coachName}</h3>
				<p class="text-sm text-zinc-500">{formatTimeRange(viewingLesson.startTime, viewingLesson.endTime)}</p>
				<span
					class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium {lessonIsPast
						? 'bg-zinc-100 text-zinc-500'
						: viewingLesson.status === 'confirmed'
							? 'bg-green-50 text-green-700'
							: 'bg-amber-50 text-amber-700'}"
				>
					{lessonIsPast ? 'completed' : viewingLesson.status}
				</span>
			</div>

			<div class="space-y-4">
				{#if lessonIsPast}
					<!-- Past lesson: before notes read-only, after notes editable -->
					{#if notesBefore}
						<div class="rounded-lg bg-zinc-50 px-3 py-2">
							<p class="text-xs font-medium text-zinc-500 mb-1">Before — what I wanted to work on</p>
							<p class="whitespace-pre-wrap text-sm text-zinc-700">{notesBefore}</p>
						</div>
					{/if}

					<div>
						<label class="mb-1 block text-xs font-medium text-zinc-600">After — what I learned</label>
						<textarea
							bind:value={notesAfter}
							onkeydown={handleNotesKeydown}
							placeholder="Key takeaways, drills to practice, things to remember..."
							rows={4}
							maxlength={2000}
							class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none resize-none"
						></textarea>
					</div>
				{:else}
					<!-- Upcoming lesson: both editable -->
					<div>
						<label class="mb-1 block text-xs font-medium text-zinc-600">Before — what I want to work on</label>
						<textarea
							bind:value={notesBefore}
							onkeydown={handleNotesKeydown}
							placeholder="Goals, questions, things to focus on..."
							rows={3}
							maxlength={2000}
							class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none resize-none"
						></textarea>
					</div>

					<div>
						<label class="mb-1 block text-xs font-medium text-zinc-600">After — what I learned</label>
						<textarea
							bind:value={notesAfter}
							onkeydown={handleNotesKeydown}
							placeholder="Key takeaways, drills to practice, things to remember..."
							rows={3}
							maxlength={2000}
							class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none resize-none"
						></textarea>
					</div>
				{/if}
			</div>

			<div class="mt-4 flex gap-3">
				<button
					onclick={() => (viewingLesson = null)}
					disabled={savingNotes}
					class="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
				>
					Close
				</button>
				<button
					onclick={saveLessonNotes}
					disabled={savingNotes}
					class="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					{savingNotes ? 'Saving...' : 'Save notes'}
				</button>
			</div>
		</div>
	</div>
{/if}

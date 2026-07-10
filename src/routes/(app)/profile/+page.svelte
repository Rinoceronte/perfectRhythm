<script lang="ts">
	import { COMPETITION_LEVELS, type CompetitionLevel } from '$lib/shared/types';
	import { updateProfile } from '$lib/shared/api/profile';

	let { data } = $props();

	let bio = $state(data.profile.bio ?? '');
	let leaderLevel = $state<CompetitionLevel | ''>(data.profile.leaderLevel ?? '');
	let followerLevel = $state<CompetitionLevel | ''>(data.profile.followerLevel ?? '');
	let yearsDancing = $state(data.profile.yearsDancing?.toString() ?? '');
	let isLeader = $state(!!data.profile.leaderLevel);
	let isFollower = $state(!!data.profile.followerLevel);

	let saving = $state(false);
	let saved = $state(false);
	let errorMsg = $state('');

	function formatLevel(level: string): string {
		if (level === 'allstar') return 'All-Star';
		return level.charAt(0).toUpperCase() + level.slice(1);
	}

	async function save() {
		saving = true;
		saved = false;
		errorMsg = '';

		const years = yearsDancing ? parseInt(yearsDancing, 10) : null;
		if (yearsDancing && (isNaN(years!) || years! < 0 || years! > 99)) {
			errorMsg = 'Years dancing must be 0–99';
			saving = false;
			return;
		}

		const result = await updateProfile({
			bio: bio.trim() || null,
			leaderLevel: isLeader && leaderLevel ? (leaderLevel as CompetitionLevel) : null,
			followerLevel: isFollower && followerLevel ? (followerLevel as CompetitionLevel) : null,
			yearsDancing: years
		});

		saving = false;
		if (result.error) {
			errorMsg = result.error.message;
		} else {
			saved = true;
			setTimeout(() => (saved = false), 2000);
		}
	}
</script>

<svelte:head>
	<title>Profile — {data.branding.siteName}</title>
</svelte:head>

<div class="mx-auto max-w-lg space-y-6 px-4 py-8">
	<h1 class="text-2xl font-semibold text-zinc-900">Your Profile</h1>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
		class="space-y-6"
	>
		<!-- About -->
		<div>
			<label for="bio" class="block text-sm font-medium text-zinc-700">About</label>
			<textarea
				id="bio"
				bind:value={bio}
				rows={3}
				maxlength={500}
				placeholder="A little about you and your dance journey..."
				class="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 focus:outline-none"
			></textarea>
			<p class="mt-1 text-xs text-zinc-400">{bio.length}/500</p>
		</div>

		<!-- Dance Roles -->
		<fieldset class="space-y-4">
			<legend class="text-sm font-medium text-zinc-700">Dance Roles</legend>

			<!-- Leader -->
			<div class="space-y-2">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={isLeader}
						class="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
					/>
					<span class="text-sm text-zinc-700">Leader</span>
				</label>
				{#if isLeader}
					<select
						bind:value={leaderLevel}
						class="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 focus:outline-none"
					>
						<option value="">Select level</option>
						{#each COMPETITION_LEVELS as level (level)}
							<option value={level}>{formatLevel(level)}</option>
						{/each}
					</select>
				{/if}
			</div>

			<!-- Follower -->
			<div class="space-y-2">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={isFollower}
						class="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
					/>
					<span class="text-sm text-zinc-700">Follower</span>
				</label>
				{#if isFollower}
					<select
						bind:value={followerLevel}
						class="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 focus:outline-none"
					>
						<option value="">Select level</option>
						{#each COMPETITION_LEVELS as level (level)}
							<option value={level}>{formatLevel(level)}</option>
						{/each}
					</select>
				{/if}
			</div>
		</fieldset>

		<!-- Years Dancing -->
		<div>
			<label for="years" class="block text-sm font-medium text-zinc-700">Years Dancing</label>
			<input
				id="years"
				type="number"
				bind:value={yearsDancing}
				min="0"
				max="99"
				placeholder="0"
				class="mt-1 w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 focus:outline-none"
			/>
		</div>

		<!-- Save -->
		{#if errorMsg}
			<p class="text-sm text-red-600">{errorMsg}</p>
		{/if}

		<button
			type="submit"
			disabled={saving}
			class="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
		>
			{saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
		</button>
	</form>
</div>

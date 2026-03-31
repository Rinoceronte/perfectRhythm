<script lang="ts">
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	let { children, data } = $props();

	let menuOpen = $state(false);

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}

	async function logout() {
		await supabase.auth.signOut();
		goto('/login');
	}

	let initials = $derived(
		data.displayName
			.split(' ')
			.map((n: string) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	);

	let currentPath = $derived(page.url.pathname);
</script>

<div class="min-h-dvh bg-zinc-50">
	<!-- Top nav bar -->
	<header class="sticky top-0 z-40 border-b border-zinc-200 bg-white">
		<div class="mx-auto flex h-12 max-w-3xl items-center justify-between px-4">
			<a href="/" class="text-sm font-semibold text-zinc-900">Perfect Rhythm</a>

			<!-- Profile button -->
			<div class="relative">
				<button
					onclick={toggleMenu}
					class="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white"
					aria-label="User menu"
				>
					{initials}
				</button>

				{#if menuOpen}
					<!-- Backdrop -->
					<button
						onclick={closeMenu}
						class="fixed inset-0 z-40"
						aria-label="Close menu"
						tabindex="-1"
					></button>

					<!-- Dropdown -->
					<div class="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
						<div class="border-b border-zinc-100 px-3 py-2">
							<p class="text-sm font-medium text-zinc-900">{data.displayName}</p>
							<p class="text-xs text-zinc-500 capitalize">{data.role}</p>
						</div>
						<a href="/" onclick={closeMenu} class="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Dashboard</a>
						{#if data.role === 'coach'}
							<a href="/students" onclick={closeMenu} class="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Students</a>
						{/if}
						<a href="/schedule" onclick={closeMenu} class="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Schedule</a>
						<a href="/videos" onclick={closeMenu} class="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Videos</a>
						<a href="/profile" onclick={closeMenu} class="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Profile</a>
						<div class="border-t border-zinc-100">
							<button
								onclick={logout}
								class="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
							>
								Log out
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<!-- Bottom tab bar (mobile) -->
	<nav class="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white sm:hidden">
		<div class="flex">
			<a
				href="/"
				class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs {currentPath === '/' ? 'text-zinc-900' : 'text-zinc-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
				</svg>
				Home
			</a>
			{#if data.role === 'coach'}
				<a
					href="/students"
					class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs {currentPath.startsWith('/students') ? 'text-zinc-900' : 'text-zinc-400'}"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
					</svg>
					Students
				</a>
			{/if}
			<a
				href="/schedule"
				class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs {currentPath === '/schedule' ? 'text-zinc-900' : 'text-zinc-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
				</svg>
				Schedule
			</a>
			<a
				href="/videos"
				class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs {currentPath.startsWith('/videos') ? 'text-zinc-900' : 'text-zinc-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
				</svg>
				Videos
			</a>
			{#if data.role === 'student'}
				<a
					href="/skills"
					class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs {currentPath === '/skills' ? 'text-zinc-900' : 'text-zinc-400'}"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
					</svg>
					Skills
				</a>
			{/if}
		</div>
	</nav>

	<!-- Page content with bottom padding for tab bar -->
	<main class="pb-16 sm:pb-0">
		{@render children()}
	</main>
</div>

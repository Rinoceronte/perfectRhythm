<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;

		const res = await fetch('/api/v1/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});

		const result = await res.json();

		if (result.error) {
			error = result.error.message;
			loading = false;
			return;
		}

		goto(resolve('/dashboard'));
	}
</script>

<svelte:head>
	<title>Log in — {data.branding.siteName}</title>
</svelte:head>

<div class="space-y-6">
	<div class="text-center">
		<h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Log in</h1>
		<p class="mt-1 text-sm text-zinc-500">Enter your credentials to continue</p>
	</div>

	<form onsubmit={handleLogin} class="space-y-4">
		{#if error}
			<div class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
				{error}
			</div>
		{/if}

		<div class="space-y-1.5">
			<label for="email" class="block text-sm font-medium text-zinc-700">Email</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				required
				autocomplete="email"
				class="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
				placeholder="you@example.com"
			/>
		</div>

		<div class="space-y-1.5">
			<label for="password" class="block text-sm font-medium text-zinc-700">Password</label>
			<input
				id="password"
				type="password"
				bind:value={password}
				required
				autocomplete="current-password"
				minlength={8}
				class="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
				placeholder="********"
			/>
		</div>

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:outline-none disabled:opacity-50"
		>
			{loading ? 'Logging in...' : 'Log in'}
		</button>
	</form>

	<p class="text-center text-sm text-zinc-500">
		Don't have an account?
		<a href={resolve('/signup')} class="font-medium text-zinc-900 hover:underline">Sign up</a>
	</p>
</div>

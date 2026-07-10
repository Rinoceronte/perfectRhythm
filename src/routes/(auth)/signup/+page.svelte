<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();

	let displayName = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSignup(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;

		const res = await fetch('/api/v1/auth/signup', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password, displayName })
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
	<title>Sign up — {data.branding.siteName}</title>
</svelte:head>

<div class="space-y-6">
	<div class="text-center">
		<h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Create account</h1>
		<p class="mt-1 text-sm text-zinc-500">
			{data.branding.tagline ?? `Get started with ${data.branding.siteName}`}
		</p>
	</div>

	<form onsubmit={handleSignup} class="space-y-4">
		{#if error}
			<div class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
				{error}
			</div>
		{/if}

		<div class="space-y-1.5">
			<label for="displayName" class="block text-sm font-medium text-zinc-700">Name</label>
			<input
				id="displayName"
				type="text"
				bind:value={displayName}
				required
				autocomplete="name"
				class="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
				placeholder="Your name"
			/>
		</div>

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
				autocomplete="new-password"
				minlength={8}
				class="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
				placeholder="At least 8 characters"
			/>
		</div>

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:outline-none disabled:opacity-50"
		>
			{loading ? 'Creating account...' : 'Create account'}
		</button>
	</form>

	<p class="text-center text-sm text-zinc-500">
		Already have an account?
		<a href={resolve('/login')} class="font-medium text-zinc-900 hover:underline">Log in</a>
	</p>
</div>

<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	let displayName = $state('');
	let email = $state('');
	let password = $state('');
	let role = $state<'student' | 'coach'>('student');
	let error = $state('');
	let loading = $state(false);
	let confirmationSent = $state(false);

	async function handleSignup(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;

		const { error: authError } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					display_name: displayName,
					role
				},
				emailRedirectTo: `${window.location.origin}/auth/callback`
			}
		});

		if (authError) {
			error = authError.message;
			loading = false;
			return;
		}

		confirmationSent = true;
		loading = false;
	}
</script>

<svelte:head>
	<title>Sign up — Perfect Rhythm</title>
</svelte:head>

<div class="space-y-6">
	<div class="text-center">
		<h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Create account</h1>
		<p class="mt-1 text-sm text-zinc-500">Get started with Perfect Rhythm</p>
	</div>

	{#if confirmationSent}
		<div class="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
			<p class="font-medium">Check your email</p>
			<p class="mt-1">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
		</div>
		<p class="text-center text-sm text-zinc-500">
			Already confirmed?
			<a href="/login" class="font-medium text-zinc-900 hover:underline">Log in</a>
		</p>
	{:else}
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

			<fieldset class="space-y-1.5">
				<legend class="block text-sm font-medium text-zinc-700">I am a...</legend>
				<div class="grid grid-cols-2 gap-3">
					<button
						type="button"
						onclick={() => (role = 'student')}
						class="rounded-md border px-3 py-2 text-sm font-medium transition-colors {role === 'student'
							? 'border-zinc-900 bg-zinc-900 text-white'
							: 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400'}"
					>
						Student
					</button>
					<button
						type="button"
						onclick={() => (role = 'coach')}
						class="rounded-md border px-3 py-2 text-sm font-medium transition-colors {role === 'coach'
							? 'border-zinc-900 bg-zinc-900 text-white'
							: 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400'}"
					>
						Coach
					</button>
				</div>
			</fieldset>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
			>
				{loading ? 'Creating account...' : 'Create account'}
			</button>
		</form>

		<p class="text-center text-sm text-zinc-500">
			Already have an account?
			<a href="/login" class="font-medium text-zinc-900 hover:underline">Log in</a>
		</p>
	{/if}
</div>

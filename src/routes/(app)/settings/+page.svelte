<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { updateSiteSettings, getLogoUploadUrl } from '$lib/shared/api/settings';
	import { uploadToSignedUrl } from '$lib/shared/api/video';

	let { data } = $props();

	let siteName = $state(data.branding.siteName);
	let tagline = $state(data.branding.tagline ?? '');
	let accentColor = $state(data.branding.accentColor ?? '#18181b');
	let logoFile = $state<File | null>(null);
	let logoPreviewUrl = $state<string | null>(null);

	let saving = $state(false);
	let saved = $state(false);
	let errorMsg = $state('');

	function onLogoChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		logoFile = file;
		if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
		logoPreviewUrl = file ? URL.createObjectURL(file) : null;
	}

	async function save() {
		saving = true;
		saved = false;
		errorMsg = '';

		try {
			let logoPath: string | undefined;

			if (logoFile) {
				const ext = logoFile.name.split('.').pop()?.toLowerCase() ?? '';
				const urlRes = await getLogoUploadUrl(ext);
				if (urlRes.error) {
					errorMsg = urlRes.error.message;
					saving = false;
					return;
				}
				await uploadToSignedUrl(urlRes.data.uploadUrl, logoFile);
				logoPath = urlRes.data.storagePath;
			}

			const result = await updateSiteSettings({
				siteName: siteName.trim(),
				tagline: tagline.trim() || null,
				accentColor,
				...(logoPath !== undefined && { logoPath })
			});

			if (result.error) {
				errorMsg = result.error.message;
			} else {
				saved = true;
				logoFile = null;
				await invalidateAll();
				setTimeout(() => (saved = false), 2000);
			}
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Something went wrong';
		}

		saving = false;
	}
</script>

<svelte:head>
	<title>Site Settings — {data.branding.siteName}</title>
</svelte:head>

<div class="mx-auto max-w-lg space-y-6 px-4 py-8">
	<div>
		<h1 class="text-2xl font-semibold text-zinc-900">Site Settings</h1>
		<p class="mt-1 text-sm text-zinc-500">
			How your site looks to students — name, logo, and colors.
		</p>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
		class="space-y-6"
	>
		{#if errorMsg}
			<div class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</div>
		{/if}

		<div class="space-y-1.5">
			<label for="siteName" class="block text-sm font-medium text-zinc-700">Site name</label>
			<input
				id="siteName"
				type="text"
				bind:value={siteName}
				required
				maxlength={100}
				class="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
				placeholder="Your studio name"
			/>
		</div>

		<div class="space-y-1.5">
			<label for="tagline" class="block text-sm font-medium text-zinc-700">Tagline</label>
			<input
				id="tagline"
				type="text"
				bind:value={tagline}
				maxlength={200}
				class="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
				placeholder="e.g. West coast swing coaching in Austin"
			/>
			<p class="text-xs text-zinc-500">Shown on your public landing page and signup page.</p>
		</div>

		<div class="space-y-1.5">
			<label for="accentColor" class="block text-sm font-medium text-zinc-700">Accent color</label>
			<div class="flex items-center gap-3">
				<input
					id="accentColor"
					type="color"
					bind:value={accentColor}
					class="h-9 w-14 rounded border border-zinc-300 bg-white p-1"
				/>
				<span class="text-sm text-zinc-500">{accentColor}</span>
			</div>
			<p class="text-xs text-zinc-500">Used for buttons and highlights across the site.</p>
		</div>

		<div class="space-y-1.5">
			<span class="block text-sm font-medium text-zinc-700">Logo</span>
			<div class="flex items-center gap-4">
				{#if logoPreviewUrl}
					<img
						src={logoPreviewUrl}
						alt="New logo preview"
						class="h-12 w-12 rounded object-contain"
					/>
				{:else if data.branding.logoUrl}
					<img
						src={data.branding.logoUrl}
						alt="Current logo"
						class="h-12 w-12 rounded object-contain"
					/>
				{:else}
					<div
						class="flex h-12 w-12 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400"
					>
						None
					</div>
				{/if}
				<label
					class="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400"
				>
					{logoFile ? logoFile.name : 'Choose file...'}
					<input
						type="file"
						accept=".png,.jpg,.jpeg,.svg,.webp"
						onchange={onLogoChange}
						class="hidden"
					/>
				</label>
			</div>
			<p class="text-xs text-zinc-500">PNG, JPG, SVG, or WebP. Square works best.</p>
		</div>

		<button
			type="submit"
			disabled={saving}
			class="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:outline-none disabled:opacity-50"
		>
			{#if saving}Saving...{:else if saved}Saved!{:else}Save settings{/if}
		</button>
	</form>
</div>

<script lang="ts">
	import { getUploadUrl, uploadToSignedUrl, confirmUpload } from '$lib/shared/api/video';

	interface Props {
		onUploaded: (videoId: string) => void;
	}

	let { onUploaded }: Props = $props();

	let title = $state('');
	let description = $state('');
	let file = $state<File | null>(null);
	let dragOver = $state(false);
	let uploading = $state(false);
	let progress = $state(0);
	let errorMsg = $state<string | null>(null);

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		file = input.files?.[0] ?? null;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const dropped = e.dataTransfer?.files?.[0];
		if (dropped && dropped.type.startsWith('video/')) {
			file = dropped;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!file || !title.trim()) return;

		errorMsg = null;
		uploading = true;
		progress = 0;

		try {
			// 1. Get signed upload URL + create DB record
			const urlRes = await getUploadUrl({
				title: title.trim(),
				description: description.trim() || null,
				mimeType: file.type
			});
			if (urlRes.error) {
				errorMsg = urlRes.error.message;
				return;
			}

			const { videoId, uploadUrl, storagePath } = urlRes.data;

			// 2. Upload directly to Supabase Storage
			await uploadToSignedUrl(uploadUrl, file, (pct) => (progress = pct));

			// 3. Confirm upload → triggers Mux ingest
			const confirmRes = await confirmUpload({ videoId, supabaseStoragePath: storagePath });
			if (confirmRes.error) {
				errorMsg = confirmRes.error.message;
				return;
			}

			onUploaded(videoId);
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			uploading = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-4">
	<div>
		<label for="video-title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
		<input
			id="video-title"
			type="text"
			bind:value={title}
			required
			maxlength="200"
			placeholder="e.g. Practice session 2/24"
			class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	</div>

	<div>
		<label for="video-desc" class="block text-sm font-medium text-gray-700 mb-1">
			Description <span class="text-gray-400 font-normal">(optional)</span>
		</label>
		<textarea
			id="video-desc"
			bind:value={description}
			maxlength="2000"
			rows="2"
			placeholder="What were you working on?"
			class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
		></textarea>
	</div>

	<!-- Drop zone -->
	<div
		role="button"
		tabindex="0"
		class="relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
			{dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}"
		ondragover={(e) => { e.preventDefault(); dragOver = true; }}
		ondragleave={() => (dragOver = false)}
		ondrop={handleDrop}
		onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('video-file-input')?.click(); }}
		onclick={() => document.getElementById('video-file-input')?.click()}
	>
		<input
			id="video-file-input"
			type="file"
			accept="video/*"
			class="sr-only"
			onchange={handleFileChange}
		/>
		{#if file}
			<p class="text-sm font-medium text-gray-800">{file.name}</p>
			<p class="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
		{:else}
			<p class="text-sm text-gray-500">Drag a video here or <span class="text-blue-600 underline">browse</span></p>
			<p class="text-xs text-gray-400 mt-1">MP4, MOV, WebM — up to 2 GB</p>
		{/if}
	</div>

	{#if uploading}
		<div class="space-y-1">
			<div class="h-2 bg-gray-200 rounded-full overflow-hidden">
				<div
					class="h-full bg-blue-500 transition-all duration-200"
					style="width: {progress}%"
				></div>
			</div>
			<p class="text-xs text-gray-500 text-right">{progress}%</p>
		</div>
	{/if}

	{#if errorMsg}
		<p class="text-sm text-red-600">{errorMsg}</p>
	{/if}

	<button
		type="submit"
		disabled={uploading || !file || !title.trim()}
		class="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white
			hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
	>
		{uploading ? 'Uploading…' : 'Upload Video'}
	</button>
</form>

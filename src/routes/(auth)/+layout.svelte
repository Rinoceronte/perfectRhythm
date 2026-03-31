<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-12">
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</div>

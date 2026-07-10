<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div style="display: contents; --brand: {data.branding.accentColor ?? '#18181b'}">
	{@render children()}
</div>

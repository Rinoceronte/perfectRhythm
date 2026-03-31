<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		options: Option[];
		selected: Set<string>;
		onchange: (selected: Set<string>) => void;
		placeholder?: string;
	}

	let { options, selected, onchange, placeholder = 'Search...' }: Props = $props();

	let query = $state('');
	let open = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	let filtered = $derived(() => {
		const q = query.toLowerCase().trim();
		const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
		// Show unselected first, then selected
		return list.sort((a, b) => {
			const asel = selected.has(a.value) ? 1 : 0;
			const bsel = selected.has(b.value) ? 1 : 0;
			if (asel !== bsel) return asel - bsel;
			return a.label.localeCompare(b.label);
		});
	});

	let selectedOptions = $derived(
		options.filter((o) => selected.has(o.value))
	);

	function toggle(value: string) {
		const next = new Set(selected);
		if (next.has(value)) {
			next.delete(value);
		} else {
			next.add(value);
		}
		onchange(next);
	}

	function remove(value: string) {
		const next = new Set(selected);
		next.delete(value);
		onchange(next);
	}

	function clearAll() {
		onchange(new Set());
	}

	function handleFocus() {
		open = true;
	}

	function handleBlur(e: FocusEvent) {
		// Don't close if focus moved within the component
		const related = e.relatedTarget as HTMLElement | null;
		if (related?.closest('[data-multiselect]')) return;
		open = false;
		query = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			query = '';
			inputEl?.blur();
		}
	}
</script>

<div class="relative" data-multiselect>
	{#if selectedOptions.length > 0}
		<div class="mb-2 flex flex-wrap gap-1.5">
			{#each selectedOptions as opt}
				<span class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
					{opt.label}
					<button
						type="button"
						onclick={() => remove(opt.value)}
						class="ml-0.5 text-indigo-400 hover:text-indigo-600"
						tabindex={-1}
					>
						&times;
					</button>
				</span>
			{/each}
			<button
				type="button"
				onclick={clearAll}
				class="rounded-full px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
				tabindex={-1}
			>
				Clear all
			</button>
		</div>
	{/if}

	<input
		bind:this={inputEl}
		type="text"
		bind:value={query}
		{placeholder}
		onfocus={handleFocus}
		onblur={handleBlur}
		onkeydown={handleKeydown}
		class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
	/>

	{#if open}
		{@const items = filtered()}
		<div
			class="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
			role="listbox"
		>
			{#if items.length === 0}
				<div class="px-3 py-2 text-sm text-slate-400">No matches</div>
			{:else}
				{#each items as opt (opt.value)}
					<button
						type="button"
						role="option"
						aria-selected={selected.has(opt.value)}
						onmousedown={(e) => { e.preventDefault(); toggle(opt.value); }}
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 {selected.has(opt.value) ? 'text-indigo-700 bg-indigo-50' : 'text-slate-700'}"
					>
						<span class="flex h-4 w-4 shrink-0 items-center justify-center rounded border {selected.has(opt.value) ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}">
							{#if selected.has(opt.value)}
								<svg class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</span>
						{opt.label}
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

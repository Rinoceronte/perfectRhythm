<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type {
		Annotation,
		AnnotationType,
		DrawAnnotation,
		TextAnnotation
	} from '$lib/shared/types';

	interface Props {
		/** Current video time in ms — used to attach timestamps and show/hide annotations */
		currentTimeMs: number;
		activeTool: AnnotationType | 'select' | 'erase';
		activeColor: string;
		annotations: Annotation[];
		/** Whether the canvas should be interactive (coach mode) or read-only (student playback) */
		interactive: boolean;
		onAnnotationAdded: (annotation: Annotation) => void;
		onAnnotationRemoved: (id: string) => void;
	}

	let {
		currentTimeMs,
		activeTool,
		activeColor,
		annotations,
		interactive,
		onAnnotationAdded,
		onAnnotationRemoved
	}: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | undefined>(undefined);
	let fabricCanvas: import('fabric').Canvas | null = null;

	// Track which annotation objects are currently visible so we can hide them
	const visibleAnnotationIds = new SvelteSet<string>();

	// Map from annotation id → fabric object(s)
	const fabricObjects = new SvelteMap<string, import('fabric').FabricObject[]>();

	async function initFabric() {
		if (!canvasEl) return;
		const { Canvas, PencilBrush } = await import('fabric');

		fabricCanvas = new Canvas(canvasEl, {
			isDrawingMode: false,
			selection: activeTool === 'select'
		});

		const brush = new PencilBrush(fabricCanvas);
		brush.color = activeColor;
		brush.width = 3;
		fabricCanvas.freeDrawingBrush = brush;

		// When a path is completed (draw mode), record it as an annotation
		fabricCanvas.on('path:created', (e) => {
			const path = e.path;
			if (!path) return;

			const id = crypto.randomUUID();
			const annotation: Annotation = {
				id,
				timestampMs: currentTimeMs,
				type: 'draw',
				data: { path: path.toSVG() } satisfies DrawAnnotation,
				durationMs: 3000,
				color: activeColor
			};

			// Tag the fabric object so we can find it later
			(path as import('fabric').FabricObject & { annotationId?: string }).annotationId = id;
			fabricObjects.set(id, [path]);

			onAnnotationAdded(annotation);
		});

		// Handle click-to-place for arrow / text / highlight
		fabricCanvas.on('mouse:up', async (e) => {
			if (!e.scenePoint || !fabricCanvas) return;
			if (activeTool === 'select' || activeTool === 'draw' || activeTool === 'erase') return;

			const { x, y } = e.scenePoint;
			const id = crypto.randomUUID();
			let fabObj: import('fabric').FabricObject | null = null;

			if (activeTool === 'arrow') {
				const { Line, Triangle } = await import('fabric');
				const len = 60;
				const line = new Line([x - len, y, x, y], {
					stroke: activeColor,
					strokeWidth: 3,
					selectable: false
				});
				const arrow = new Triangle({
					left: x - 10,
					top: y - 8,
					width: 16,
					height: 16,
					fill: activeColor,
					angle: 90,
					selectable: false
				});
				fabricCanvas.add(line, arrow);
				fabricObjects.set(id, [line, arrow]);
				fabObj = line; // just for the type annotation below
			} else if (activeTool === 'text') {
				const { IText } = await import('fabric');
				const text = new IText('Label', {
					left: x,
					top: y,
					fontSize: 20,
					fill: activeColor,
					selectable: true
				});
				fabricCanvas.add(text);
				fabricCanvas.setActiveObject(text);
				text.enterEditing();
				fabricObjects.set(id, [text]);
				fabObj = text;
			} else if (activeTool === 'highlight') {
				const { Rect } = await import('fabric');
				const rect = new Rect({
					left: x - 40,
					top: y - 15,
					width: 80,
					height: 30,
					fill: activeColor,
					opacity: 0.35,
					selectable: true
				});
				fabricCanvas.add(rect);
				fabricObjects.set(id, [rect]);
				fabObj = rect;
			}

			if (fabObj) {
				(fabObj as import('fabric').FabricObject & { annotationId?: string }).annotationId = id;
				const annotation: Annotation = {
					id,
					timestampMs: currentTimeMs,
					type: activeTool as AnnotationType,
					data:
						activeTool === 'text'
							? ({ text: 'Label', fontSize: 20, x, y } satisfies TextAnnotation)
							: ({ path: '' } satisfies DrawAnnotation),
					durationMs: 3000,
					color: activeColor
				};
				onAnnotationAdded(annotation);
				fabricCanvas.renderAll();
			}
		});

		// Erase: remove clicked object
		fabricCanvas.on('mouse:down', (e) => {
			if (activeTool !== 'erase' || !fabricCanvas) return;
			const { target } = fabricCanvas.findTarget(e.e);
			if (!target) return;

			const tagged = target as import('fabric').FabricObject & { annotationId?: string };
			if (tagged.annotationId) {
				const objs = fabricObjects.get(tagged.annotationId) ?? [];
				objs.forEach((o) => fabricCanvas!.remove(o));
				fabricObjects.delete(tagged.annotationId);
				onAnnotationRemoved(tagged.annotationId);
				fabricCanvas.renderAll();
			}
		});
	}

	// React to tool/color changes
	$effect(() => {
		if (!fabricCanvas) return;
		fabricCanvas.isDrawingMode = activeTool === 'draw';
		fabricCanvas.selection = activeTool === 'select';
		if (fabricCanvas.freeDrawingBrush) {
			fabricCanvas.freeDrawingBrush.color = activeColor;
		}
	});

	// Show/hide annotations based on current time
	$effect(() => {
		if (!fabricCanvas) return;

		annotations.forEach((ann) => {
			const visible =
				currentTimeMs >= ann.timestampMs && currentTimeMs < ann.timestampMs + ann.durationMs;

			const objs = fabricObjects.get(ann.id);
			if (!objs) return;

			objs.forEach((o) => {
				if (visible && !visibleAnnotationIds.has(ann.id)) {
					o.set('visible', true);
				} else if (!visible && visibleAnnotationIds.has(ann.id)) {
					o.set('visible', false);
				}
			});

			if (visible) visibleAnnotationIds.add(ann.id);
			else visibleAnnotationIds.delete(ann.id);
		});

		fabricCanvas.renderAll();
	});

	export function clearAll() {
		fabricCanvas?.clear();
		fabricObjects.clear();
		visibleAnnotationIds.clear();
	}

	export function resizeTo(width: number, height: number) {
		if (!fabricCanvas) return;
		fabricCanvas.setDimensions({ width, height });
		fabricCanvas.renderAll();
	}

	onMount(initFabric);

	onDestroy(() => {
		fabricCanvas?.dispose();
	});
</script>

<canvas
	bind:this={canvasEl}
	class="absolute inset-0 h-full w-full"
	style="pointer-events: {interactive ? 'all' : 'none'};"
></canvas>

# Video Review Feature — Claude Instructions

See `CLAUDE.md` for project-wide conventions.

---

## Overview

Students upload videos of themselves dancing. Coaches review them using annotation tools (drawing, voice-over, playback controls). The annotations are composited into a new "review video" that is returned to the student. AI-assisted review is a future phase.

---

## Upload Flow

```
Student selects video
       ↓
POST /api/v1/videos/upload-url  ← get signed Supabase Storage URL
       ↓
Client uploads directly to Supabase Storage (bypasses server)
       ↓
POST /api/v1/videos/confirm     ← tell server upload is complete
       ↓
Server sends to Mux for transcoding
       ↓
Mux webhook → POST /api/v1/webhooks/mux → mark video as ready
       ↓
Student and assigned coaches notified
```

**Never upload video through the SvelteKit server** — always use signed URLs for direct client-to-storage upload. Videos can be large.

---

## Data Model

```typescript
// src/lib/shared/types/video.ts

type VideoStatus =
	| 'uploading'
	| 'processing'
	| 'ready'
	| 'review_in_progress'
	| 'reviewed'
	| 'error';
type ReviewStatus = 'pending' | 'in_progress' | 'compositing' | 'complete';

interface Video {
	id: string;
	studentId: string;
	title: string;
	description: string | null;
	supabaseStoragePath: string; // original upload path
	muxAssetId: string | null; // set after Mux processes
	muxPlaybackId: string | null; // used for playback URL
	durationSeconds: number | null;
	status: VideoStatus;
	createdAt: Date;
}

interface VideoReview {
	id: string;
	videoId: string;
	coachId: string;
	status: ReviewStatus;
	annotations: Annotation[]; // stored as JSONB
	voiceTrackPath: string | null; // Supabase Storage path for recorded voice
	compositeMuxAssetId: string | null; // the finished review video
	compositeMuxPlaybackId: string | null;
	createdAt: Date;
	completedAt: Date | null;
}

interface Annotation {
	id: string;
	timestampMs: number; // position in the video when annotation was made
	type: 'draw' | 'arrow' | 'text' | 'highlight';
	data: DrawAnnotation | TextAnnotation; // type-discriminated
	durationMs: number; // how long annotation is visible (default: 3000)
	color: string;
}
```

---

## Drizzle Schema

```typescript
// src/lib/server/db/schema/videos.ts
import { pgTable, uuid, text, integer, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const videoStatusEnum = pgEnum('video_status', [
	'uploading',
	'processing',
	'ready',
	'review_in_progress',
	'reviewed',
	'error'
]);
export const reviewStatusEnum = pgEnum('review_status', [
	'pending',
	'in_progress',
	'compositing',
	'complete'
]);

export const videos = pgTable('videos', {
	id: uuid('id').primaryKey().defaultRandom(),
	studentId: uuid('student_id')
		.notNull()
		.references(() => users.id),
	title: text('title').notNull(),
	description: text('description'),
	supabaseStoragePath: text('supabase_storage_path').notNull(),
	muxAssetId: text('mux_asset_id'),
	muxPlaybackId: text('mux_playback_id'),
	durationSeconds: integer('duration_seconds'),
	status: videoStatusEnum('status').notNull().default('uploading'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const videoReviews = pgTable('video_reviews', {
	id: uuid('id').primaryKey().defaultRandom(),
	videoId: uuid('video_id')
		.notNull()
		.references(() => videos.id),
	coachId: uuid('coach_id')
		.notNull()
		.references(() => users.id),
	status: reviewStatusEnum('status').notNull().default('pending'),
	annotations: jsonb('annotations').notNull().default([]),
	voiceTrackPath: text('voice_track_path'),
	compositeMuxAssetId: text('composite_mux_asset_id'),
	compositeMuxPlaybackId: text('composite_mux_playback_id'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	completedAt: timestamp('completed_at')
});
```

---

## API Endpoints

```
GET    /api/v1/videos                        List student's videos (auth: student sees own; coach sees assigned)
POST   /api/v1/videos/upload-url             Get signed upload URL
POST   /api/v1/videos/confirm                Confirm upload complete, trigger Mux ingest
GET    /api/v1/videos/:id                    Get video + review status
DELETE /api/v1/videos/:id                    Delete video (student or coach)

GET    /api/v1/videos/:id/reviews            List reviews for a video
POST   /api/v1/videos/:id/reviews            Create a new review (coach only)
PATCH  /api/v1/videos/:id/reviews/:reviewId  Save annotation progress
POST   /api/v1/videos/:id/reviews/:reviewId/complete   Trigger composite generation

POST   /api/v1/webhooks/mux                  Mux webhook handler (no auth, verify signature)
```

---

## Coach Annotation Tool

The annotation interface runs entirely in the browser. It does **not** use server calls during annotation — all state is local until the coach saves or completes.

### Components

```
VideoReviewStudio.svelte          # top-level review UI container
  ├── VideoPlayer.svelte          # Mux player with custom controls
  ├── AnnotationCanvas.svelte     # Fabric.js canvas overlaid on video
  ├── VoiceRecorder.svelte        # MediaRecorder + WaveSurfer waveform
  ├── AnnotationTimeline.svelte   # Shows all annotations on a timeline scrubber
  └── ReviewToolbar.svelte        # Tool palette: draw, arrow, text, highlight, erase
```

### Player Controls

- Play / Pause
- Scrub (timeline)
- Speed: 0.25×, 0.5×, 1×, 1.5×, 2×
- Frame step: ±1 frame (via keyboard shortcut)
- Loop region (set in/out points)

### Canvas (Fabric.js)

- Canvas is absolutely positioned over the video, pointer-events toggled based on active tool
- When a draw annotation is placed, record: `{ timestampMs: player.currentTime * 1000, type, data, color }`
- On playback, show/hide annotations based on their `timestampMs` and `durationMs`
- Annotation layer is transparent during voice recording so coach can continue drawing while narrating

### Voice Recording

- Single continuous recording per review session (not per-annotation)
- Waveform shown via WaveSurfer.js
- Voice track stored as `.webm` to Supabase Storage
- During compositing, voice audio replaces/overlays original video audio

---

## Composite Video Generation

When coach clicks "Complete Review":

```
1. POST /api/v1/videos/:id/reviews/:reviewId/complete
2. Server queues a compositing job
3. Compositing worker (server-side):
   a. Download original video from Supabase/Mux
   b. Download voice track from Supabase Storage
   c. Render annotation frames using Canvas API (Node.js canvas or similar)
   d. FFmpeg command:
      ffmpeg -i original.mp4 -i voice.webm \
        -filter_complex "[0:v][annotations.mp4][0:a][1:a]complex_filter" \
        output.mp4
   e. Upload output.mp4 to Mux
   f. On Mux ready webhook → update review record, notify student
4. Review status: in_progress → compositing → complete
```

### Compositing Notes

- This is the most complex part of the system — scope as its own milestone
- v1: Voice over + annotations as burned-in frames (no fancy blending)
- v2: Add annotation fade in/out, better timing sync
- If compositing fails, preserve the raw annotations in the DB — coach's work is never lost
- Show a "processing" state to student while composite is being generated

---

## Mux Integration

```typescript
// src/lib/server/services/video/mux.ts

import Mux from '@mux/mux-node';

const mux = new Mux({
	tokenId: process.env.MUX_TOKEN_ID,
	tokenSecret: process.env.MUX_TOKEN_SECRET
});

export async function ingestVideo(supabasePublicUrl: string): Promise<{ assetId: string }> {
	const asset = await mux.video.assets.create({
		input: [{ url: supabasePublicUrl }],
		playback_policy: ['signed'], // private playback
		mp4_support: 'capped-1080p' // needed for FFmpeg download during compositing
	});
	return { assetId: asset.id };
}

export function getPlaybackUrl(playbackId: string): string {
	return `https://stream.mux.com/${playbackId}.m3u8`;
}

// Verify webhook signature before processing
export function verifyMuxWebhook(rawBody: string, signature: string): boolean {
	return Mux.Webhooks.verifySignature(
		rawBody,
		{ 'mux-signature': signature },
		process.env.MUX_WEBHOOK_SECRET!
	);
}
```

---

## Access Control

- Students can only see reviews for their own videos
- Coaches can only see reviews they created
- A coach cannot see another coach's review of the same student's video
- Video deletion by student also deletes all reviews and notifies coaches

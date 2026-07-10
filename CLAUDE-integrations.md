# External Integrations — Claude Instructions

See `CLAUDE.md` for project-wide conventions.

---

## Notification Service

All notifications route through a single service. **Never call Resend or Twilio directly from route handlers.**

```typescript
// src/lib/server/services/notifications.ts

type NotificationType =
	| 'video_review_ready'
	| 'lesson_booking_confirmed'
	| 'lesson_booking_declined'
	| 'lesson_booking_request' // coach receives this
	| 'booking_window_open'
	| 'priority_booking_window_open'
	| 'lesson_reminder';

interface NotificationPayload {
	type: NotificationType;
	recipientId: string;
	data: Record<string, string | number>; // template variables
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
	const user = await getUserWithPreferences(payload.recipientId);

	// Always send email if address exists
	if (user.email) {
		await sendEmail(payload.type, user.email, payload.data);
	}

	// SMS only if user has opted in and phone exists
	if (user.phone && user.smsOptIn) {
		await sendSms(payload.type, user.phone, payload.data);
	}
}
```

---

## Email (Resend)

```typescript
// src/lib/server/services/notifications/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_TEMPLATES: Record<NotificationType, { subject: string; template: string }> = {
	video_review_ready: {
		subject: 'Your video review is ready',
		template: 'video-review-ready'
	},
	lesson_booking_confirmed: {
		subject: 'Lesson confirmed',
		template: 'booking-confirmed'
	},
	lesson_booking_declined: {
		subject: 'Lesson request update',
		template: 'booking-declined'
	},
	lesson_booking_request: {
		subject: 'New lesson request',
		template: 'booking-request'
	},
	booking_window_open: {
		subject: 'Booking is now open',
		template: 'booking-open'
	},
	priority_booking_window_open: {
		subject: 'Early booking access is open for you',
		template: 'priority-booking-open'
	},
	lesson_reminder: {
		subject: 'Lesson reminder',
		template: 'lesson-reminder'
	}
};

export async function sendEmail(
	type: NotificationType,
	to: string,
	data: Record<string, string | number>
): Promise<void> {
	const template = EMAIL_TEMPLATES[type];
	await resend.emails.send({
		from: 'noreply@yourdomain.com',
		to,
		subject: template.subject,
		react: renderEmailTemplate(template.template, data) // use react-email
	});
}
```

### Email templates to build (react-email):

- `video-review-ready` — link to video, coach name
- `booking-confirmed` — date, time, coach, location
- `booking-declined` — coach name, optional note
- `booking-request` — student name, requested time (coach notification)
- `booking-open` — event name, link to booking
- `priority-booking-open` — event name, link, explains they have early access
- `lesson-reminder` — 24h and 1h before lesson

---

## SMS (Twilio)

```typescript
// src/lib/server/services/notifications/sms.ts
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const SMS_TEMPLATES: Partial<
	Record<NotificationType, (data: Record<string, string | number>) => string>
> = {
	video_review_ready: (d) => `Your video review from ${d.coachName} is ready. View it in the app.`,
	lesson_booking_confirmed: (d) =>
		`Lesson confirmed with ${d.coachName} on ${d.date} at ${d.time}.`,
	booking_window_open: (d) => `Booking is now open for ${d.eventName}. Open the app to book.`,
	priority_booking_window_open: (d) =>
		`Early access: booking for ${d.eventName} is open for you. Book now before general release.`,
	lesson_reminder: (d) => `Reminder: lesson with ${d.coachName} in ${d.hoursUntil} hours.`
};

export async function sendSms(
	type: NotificationType,
	to: string,
	data: Record<string, string | number>
): Promise<void> {
	const templateFn = SMS_TEMPLATES[type];
	if (!templateFn) return; // some notifications are email-only

	await client.messages.create({
		body: templateFn(data),
		from: process.env.TWILIO_PHONE_NUMBER,
		to
	});
}
```

---

## Video Processing (Mux)

See `CLAUDE-video.md` for the full Mux integration details.

```typescript
// src/lib/server/services/video/mux.ts

import Mux from '@mux/mux-node';

const mux = new Mux({
	tokenId: process.env.MUX_TOKEN_ID,
	tokenSecret: process.env.MUX_TOKEN_SECRET
});

export { mux };
```

### Webhook Handler

```typescript
// src/routes/api/v1/webhooks/mux/+server.ts

export async function POST({ request }) {
	const rawBody = await request.text();
	const signature = request.headers.get('mux-signature') ?? '';

	if (!verifyMuxWebhook(rawBody, signature)) {
		return err('INVALID_SIGNATURE', 'Invalid webhook signature', 401);
	}

	const event = JSON.parse(rawBody);

	switch (event.type) {
		case 'video.asset.ready':
			await handleVideoReady(event.data);
			break;
		case 'video.asset.errored':
			await handleVideoError(event.data);
			break;
	}

	return ok({ received: true });
}
```

---

## AI (Anthropic Claude API)

```typescript
// src/lib/server/services/ai/client.ts
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY
});
```

### Usage pattern — always use structured output requests:

```typescript
// Skill suggestion — expects JSON array back
const response = await anthropic.messages.create({
	model: 'claude-opus-4-5',
	max_tokens: 2048,
	messages: [{ role: 'user', content: prompt }]
});

// Parse the response content
const text = response.content[0].type === 'text' ? response.content[0].text : '';
const suggestions = JSON.parse(text); // wrap in try/catch
```

### Error handling for AI calls:

```typescript
export async function safeAiCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		console.error('AI call failed:', error);
		return fallback;
	}
}
```

---

## Location (Google Places API)

Used to autocomplete and geocode event venues.

```typescript
// src/lib/server/services/location.ts

export async function geocodePlace(
	placeId: string
): Promise<{ lat: number; lng: number; formattedAddress: string }> {
	const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${process.env.GOOGLE_PLACES_API_KEY}`;
	const res = await fetch(url);
	const data = await res.json();
	return {
		lat: data.result.geometry.location.lat,
		lng: data.result.geometry.location.lng,
		formattedAddress: data.result.formatted_address
	};
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
	const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=establishment&key=${process.env.GOOGLE_PLACES_API_KEY}`;
	const res = await fetch(url);
	const data = await res.json();
	return data.predictions.map((p: any) => ({
		placeId: p.place_id,
		description: p.description
	}));
}
```

### Proximity search (find coaches near a location):

```sql
-- Using Haversine formula (no PostGIS extension needed)
SELECT *,
  (6371 * acos(
    cos(radians(:lat)) * cos(radians(lat)) *
    cos(radians(lng) - radians(:lng)) +
    sin(radians(:lat)) * sin(radians(lat))
  )) AS distance_km
FROM events
WHERE is_published = true
HAVING distance_km < :radius_km
ORDER BY distance_km;
```

---

## Cron Jobs (Vercel Cron)

```typescript
// src/routes/api/v1/cron/booking-release/+server.ts
// Configured in vercel.json to run every hour

export async function GET({ request }) {
	// Verify it's actually Vercel calling this
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return err('UNAUTHORIZED', 'Invalid cron secret', 401);
	}

	await processBatchRelease();
	return ok({ processed: true });
}
```

```json
// vercel.json
{
	"crons": [
		{
			"path": "/api/v1/cron/booking-release",
			"schedule": "0 * * * *"
		},
		{
			"path": "/api/v1/cron/lesson-reminders",
			"schedule": "0 * * * *"
		}
	]
}
```

---

## External Event Calendar (TBD)

The source for external WCS events (WSDC, community calendars) is not yet determined. When implemented:

```typescript
// src/lib/server/services/events/import.ts

// Interface to implement for any external source
interface EventImporter {
	fetchEvents(fromDate: string, toDate: string): Promise<ExternalEvent[]>;
	normalizeEvent(raw: ExternalEvent): EventInput;
}

// Implementations to build:
// - WsdcImporter — if WSDC exposes an API or scrapeable data
// - CommunityCalendarImporter — if there's a community-maintained feed
// - ManualImporter — admin uploads a CSV/JSON (fallback)
```

For now, coaches create events manually. External import is a future enhancement.

// Client-safe utility functions

/**
 * Returns the schedule date string (YYYY-MM-DD) for a given timestamp.
 * A "day" ends at 2:00 AM the following morning (the 2am rule).
 */
export function toScheduleDate(date: Date): string {
	const adjusted = new Date(date);
	if (adjusted.getHours() < 2) {
		adjusted.setDate(adjusted.getDate() - 1);
	}
	return adjusted.toISOString().slice(0, 10);
}

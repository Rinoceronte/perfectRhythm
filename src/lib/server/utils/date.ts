// Schedule date utilities
// A calendar "day" ends at 2:00 AM the following morning.
// Always use toScheduleDate() — never raw new Date() in scheduling logic.

/**
 * Returns the schedule date string (YYYY-MM-DD) for a given timestamp,
 * where a "day" ends at 2:00 AM the following morning.
 */
export function toScheduleDate(date: Date): string {
	const adjusted = new Date(date);
	// If before 2am, roll back to the previous calendar day
	if (adjusted.getHours() < 2) {
		adjusted.setDate(adjusted.getDate() - 1);
	}
	return adjusted.toISOString().slice(0, 10);
}

/**
 * The start of a schedule day (6am — comfortable buffer after the 2am cutoff).
 */
export function scheduleDayStart(dateStr: string): Date {
	return new Date(`${dateStr}T06:00:00`);
}

/**
 * The end of a schedule day (2am the following morning).
 */
export function scheduleDayEnd(dateStr: string): Date {
	const next = new Date(`${dateStr}T02:00:00`);
	next.setDate(next.getDate() + 1);
	return next;
}

/**
 * Parse a HH:MM time string against a schedule date, handling overnight (past midnight).
 * If the resulting Date is before `reference`, add one day (crossed midnight).
 */
export function parseBlockTime(scheduleDate: string, timeStr: string, reference?: Date): Date {
	const base = new Date(`${scheduleDate}T${timeStr}:00`);
	if (reference && base < reference) {
		base.setDate(base.getDate() + 1);
	}
	return base;
}

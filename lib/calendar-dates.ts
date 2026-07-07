/**
 * Pure date helpers for the content calendar — no filesystem, no Node built-ins,
 * so they are safe to import into client components and page render bodies
 * (unlike lib/calendar, which reads content and must stay server-only).
 * Weeks are Monday-based and computed in UTC to avoid off-by-one across zones.
 */

/** ISO (YYYY-MM-DD) Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
	const d = new Date(`${iso}T00:00:00Z`);
	// getUTCDay: 0=Sun..6=Sat. Days since Monday = (day + 6) % 7.
	const back = (d.getUTCDay() + 6) % 7;
	d.setUTCDate(d.getUTCDate() - back);
	return d.toISOString().slice(0, 10);
}

/** The seven ISO dates Mon..Sun of the week starting at `monday`. */
export function weekDates(monday: string): string[] {
	const d = new Date(`${monday}T00:00:00Z`);
	return Array.from({length: 7}, (_, i) => {
		const day = new Date(d);
		day.setUTCDate(d.getUTCDate() + i);
		return day.toISOString().slice(0, 10);
	});
}

/** Add `n` weeks (may be negative) to an ISO Monday, returning the ISO Monday. */
export function addWeeks(monday: string, n: number): string {
	const d = new Date(`${monday}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n * 7);
	return d.toISOString().slice(0, 10);
}

/** True for Monday-Friday; false for Saturday/Sunday. */
export function isWeekday(iso: string): boolean {
	const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
	return day >= 1 && day <= 5;
}

/** The month key "YYYY-MM" containing an ISO date. */
export function monthKeyOf(iso: string): string {
	return iso.slice(0, 7);
}

/** Add `n` months (may be negative) to a "YYYY-MM" key. */
export function addMonths(key: string, n: number): string {
	const [y, m] = key.split('-').map(s => Number.parseInt(s, 10));
	const total = y * 12 + (m - 1) + n;
	const year = Math.floor(total / 12);
	const month = (total % 12) + 1;
	return `${year}-${String(month).padStart(2, '0')}`;
}

/** Human label for a "YYYY-MM" key, e.g. "July 2026". */
export function monthLabel(key: string): string {
	return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', {
		timeZone: 'UTC',
		month: 'long',
		year: 'numeric',
	});
}

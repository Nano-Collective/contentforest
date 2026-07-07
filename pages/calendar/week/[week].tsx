import {ArrowLeft, ChevronLeft, ChevronRight} from 'lucide-react';
import type {GetStaticPaths, GetStaticProps} from 'next';
import Head from 'next/head';
import Link from 'next/link';
import CalendarWeek from '@/components/calendar/CalendarWeek';
import {
	listCalendarWeeks,
	type ResolvedWeek,
	readCalendarWeek,
} from '@/lib/calendar';
import {addWeeks, monthKeyOf, weekDates} from '@/lib/calendar-dates';

type Props = {
	week: ResolvedWeek;
	monthKey: string;
	prevWeek: string | null;
	nextWeek: string | null;
};

function weekRange(weekOf: string): string {
	const dates = weekDates(weekOf);
	const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
			timeZone: 'UTC',
			...opts,
		});
	return `${fmt(dates[0], {month: 'short', day: 'numeric'})} – ${fmt(dates[6], {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})}`;
}

export default function CalendarWeekPage({
	week,
	monthKey,
	prevWeek,
	nextWeek,
}: Props) {
	return (
		<>
			<Head>
				<title>Week of {week.weekOf} · Calendar · ContentForest</title>
			</Head>
			<main className="max-w-6xl mx-auto px-4 py-10">
				<Link
					href={`/calendar/${monthKey}`}
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
				>
					<ArrowLeft className="h-4 w-4" />
					Month view
				</Link>

				<header className="mb-8 flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
							Content calendar · week
						</p>
						<h1 className="text-3xl font-bold">{weekRange(week.weekOf)}</h1>
					</div>
					<nav className="flex items-center gap-2">
						{prevWeek ? (
							<Link
								href={`/calendar/week/${prevWeek}`}
								className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
							>
								<ChevronLeft className="h-4 w-4" />
								Previous
							</Link>
						) : null}
						{nextWeek ? (
							<Link
								href={`/calendar/week/${nextWeek}`}
								className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
							>
								Next
								<ChevronRight className="h-4 w-4" />
							</Link>
						) : null}
					</nav>
				</header>

				<CalendarWeek week={week} />
			</main>
		</>
	);
}

export const getStaticPaths: GetStaticPaths = async () => {
	return {
		paths: listCalendarWeeks().map(w => ({params: {week: w.weekOf}})),
		fallback: false,
	};
};

export const getStaticProps: GetStaticProps<Props> = async ({params}) => {
	const weekOf = params?.week as string;
	const week = readCalendarWeek(weekOf);
	if (!week) return {notFound: true};
	const available = new Set(listCalendarWeeks().map(w => w.weekOf));
	const prev = addWeeks(weekOf, -1);
	const next = addWeeks(weekOf, 1);
	return {
		props: {
			week,
			monthKey: monthKeyOf(weekOf),
			prevWeek: available.has(prev) ? prev : null,
			nextWeek: available.has(next) ? next : null,
		},
	};
};

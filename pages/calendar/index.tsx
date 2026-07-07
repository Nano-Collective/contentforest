import {ArrowLeft} from 'lucide-react';
import type {GetStaticProps} from 'next';
import Head from 'next/head';
import Link from 'next/link';
import CalendarMonth from '@/components/calendar/CalendarMonth';
import {
	addMonths,
	listCalendarMonths,
	monthKeyOf,
	type ResolvedMonth,
	readCalendarMonth,
} from '@/lib/calendar';

type Props = {
	month: ResolvedMonth;
	today: string;
	prevKey: string | null;
	nextKey: string | null;
};

export default function CalendarIndexPage({
	month,
	today,
	prevKey,
	nextKey,
}: Props) {
	return (
		<>
			<Head>
				<title>Content calendar · ContentForest</title>
			</Head>
			<main className="max-w-6xl mx-auto px-4 py-10">
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
				>
					<ArrowLeft className="h-4 w-4" />
					All products
				</Link>
				<p className="text-xs uppercase tracking-wider text-muted-foreground mb-6">
					Content calendar — what to post, day by day
				</p>
				<CalendarMonth
					month={month}
					today={today}
					prevKey={prevKey}
					nextKey={nextKey}
				/>
			</main>
		</>
	);
}

export const getStaticProps: GetStaticProps<Props> = async () => {
	const today = new Date().toISOString().slice(0, 10);
	const key = monthKeyOf(today);
	const available = new Set(listCalendarMonths().map(m => m.key));
	const prev = addMonths(key, -1);
	const next = addMonths(key, 1);
	return {
		props: {
			month: readCalendarMonth(key),
			today,
			prevKey: available.has(prev) ? prev : null,
			nextKey: available.has(next) ? next : null,
		},
	};
};

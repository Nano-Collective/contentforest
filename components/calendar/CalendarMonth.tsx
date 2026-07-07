'use client';

import {ChevronLeft, ChevronRight, ExternalLink} from 'lucide-react';
import Link from 'next/link';
import {useState} from 'react';
import type {
	MonthCell,
	ResolvedItem,
	ResolvedMonth,
	SlotType,
} from '@/lib/calendar';
import {mondayOf} from '@/lib/calendar-dates';
import {cn} from '@/lib/utils';
import {
	CHANNEL_SHORT,
	isDealt,
	PostPane,
	type Status,
	TYPE_META,
	useDistribute,
} from './shared';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function xCountOf(items: ResolvedItem[]): number {
	return items.filter(i => i.channel === 'x').length;
}

function dayNumber(date: string): number {
	return Number.parseInt(date.slice(8), 10);
}

function dayLabel(date: string): string {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
		timeZone: 'UTC',
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	});
}

type Section = {
	key: string;
	kind: SlotType;
	label: string | null;
	items: ResolvedItem[];
};

/**
 * Group a day's posts so an article's channels read as one thing (the article +
 * its supporting cross-posts) and releases group by version, rather than a flat
 * list of "nanocoder v1.28.0" rows that look like release spam.
 */
function sectionsOf(dayItems: ResolvedItem[]): Section[] {
	const byKey = new Map<string, Section>();
	const order: string[] = [];
	for (const it of dayItems) {
		let key: string;
		let label: string | null;
		if (it.type === 'release' && it.releaseSet) {
			key = `rel:${it.releaseSet}`;
			label = `Release · ${it.releaseSet}`;
		} else if (it.type === 'backlog-article' && it.articleKey) {
			key = `art:${it.articleKey}`;
			label = `Article · ${it.articleTitle ?? 'Untitled'}`;
		} else {
			key = 'evergreen';
			label = null;
		}
		if (!byKey.has(key)) {
			byKey.set(key, {key, kind: it.type, label, items: []});
			order.push(key);
		}
		byKey.get(key)?.items.push(it);
	}
	return order.map(k => byKey.get(k) as Section);
}

/** The label shown on a post row inside its section. */
function rowLabel(it: ResolvedItem): string {
	if (it.articleKey) {
		return it.channel === 'github-discussion'
			? (it.articleTitle ?? 'Read the article')
			: 'Supporting post';
	}
	return it.title ?? it.preview ?? it.sourceLabel;
}

/** Compact per-day summary shown inside a month cell. */
function CellTags({items}: {items: ResolvedItem[]}) {
	const x = xCountOf(items);
	const hasRelease = items.some(i => i.type === 'release');
	const hasArticle = items.some(i => i.type === 'backlog-article');
	if (items.length === 0) return null;
	return (
		<div className="mt-auto flex flex-wrap items-center gap-1">
			{x > 0 ? (
				<span className="rounded bg-muted px-1 text-[10px] leading-4 text-muted-foreground">
					{x} X
				</span>
			) : null}
			{hasRelease ? (
				<span
					className={cn(
						'rounded px-1 text-[10px] leading-4',
						TYPE_META.release.chip,
					)}
				>
					REL
				</span>
			) : null}
			{hasArticle ? (
				<span
					className={cn(
						'rounded px-1 text-[10px] leading-4',
						TYPE_META['backlog-article'].chip,
					)}
				>
					ART
				</span>
			) : null}
			<span className="ml-auto text-[10px] leading-4 text-muted-foreground">
				{items.length}
			</span>
		</div>
	);
}

export default function CalendarMonth({
	month,
	today,
	prevKey,
	nextKey,
}: {
	month: ResolvedMonth;
	today: string;
	prevKey: string | null;
	nextKey: string | null;
}) {
	const cells = month.weeks.flat();
	const allItems = cells.flatMap(c => c.items);
	const {statusMap, marking, markError, mark} = useDistribute(allItems);

	const inMonth = cells.filter(c => c.inMonth);
	const defaultDay =
		inMonth.find(c => c.date === today && c.items.length > 0)?.date ??
		inMonth.find(c => c.items.length > 0)?.date ??
		inMonth[0]?.date ??
		today;

	const [selectedDate, setSelectedDate] = useState(defaultDay);
	const dayItemsFor = (date: string): ResolvedItem[] =>
		cells.find(c => c.date === date)?.items ?? [];
	const [selectedRef, setSelectedRef] = useState(
		dayItemsFor(defaultDay)[0]?.ref ?? '',
	);

	const selectDay = (cell: MonthCell) => {
		setSelectedDate(cell.date);
		setSelectedRef(cell.items[0]?.ref ?? '');
	};

	const dayItems = dayItemsFor(selectedDate);
	const selectedItem =
		dayItems.find(i => i.ref === selectedRef) ?? dayItems[0] ?? null;
	const selStatus: Status | undefined = selectedItem
		? statusMap[selectedItem.ref]
		: undefined;

	return (
		<div>
			{/* Month header + nav */}
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{month.label}</h1>
				<div className="flex items-center gap-2">
					{prevKey ? (
						<Link
							href={`/calendar/${prevKey}`}
							aria-label="Previous month"
							className="inline-flex items-center rounded-md border border-border px-2 py-1.5 text-sm hover:bg-accent transition-colors"
						>
							<ChevronLeft className="h-4 w-4" />
						</Link>
					) : null}
					{nextKey ? (
						<Link
							href={`/calendar/${nextKey}`}
							aria-label="Next month"
							className="inline-flex items-center rounded-md border border-border px-2 py-1.5 text-sm hover:bg-accent transition-colors"
						>
							<ChevronRight className="h-4 w-4" />
						</Link>
					) : null}
					<Link
						href={`/calendar/week/${mondayOf(selectedDate)}`}
						className="ml-1 inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
					>
						Week view
					</Link>
				</div>
			</div>

			{/* Weekday header */}
			<div className="grid grid-cols-7 gap-1">
				{WEEKDAYS.map(d => (
					<div
						key={d}
						className="py-1 text-center text-xs font-medium text-muted-foreground"
					>
						{d}
					</div>
				))}
			</div>

			{/* Day grid */}
			<div className="grid grid-cols-7 gap-1">
				{cells.map(cell => {
					const isToday = cell.date === today;
					const isSelected = cell.date === selectedDate;
					return (
						<button
							type="button"
							key={cell.date}
							onClick={() => selectDay(cell)}
							className={cn(
								'flex min-h-[4.75rem] flex-col rounded-md border p-1.5 text-left transition-colors',
								cell.inMonth ? 'bg-card' : 'bg-transparent opacity-40',
								isSelected
									? 'border-primary ring-1 ring-primary'
									: 'border-border/50 hover:border-primary/40',
							)}
						>
							<span
								className={cn(
									'text-xs',
									isToday
										? 'font-bold text-primary'
										: cell.inMonth
											? 'text-foreground'
											: 'text-muted-foreground',
								)}
							>
								{dayNumber(cell.date)}
							</span>
							<CellTags items={cell.items} />
						</button>
					);
				})}
			</div>

			{/* Selected day detail */}
			<div className="mt-8">
				<h2 className="mb-4 text-lg font-semibold">
					{dayLabel(selectedDate)}
					<span className="ml-2 text-sm font-normal text-muted-foreground">
						{dayItems.length} post{dayItems.length === 1 ? '' : 's'}
					</span>
				</h2>

				{dayItems.length === 0 ? (
					<p className="text-muted-foreground">Nothing scheduled this day.</p>
				) : (
					<div className="grid gap-6 md:grid-cols-[minmax(200px,260px)_1fr]">
						<div className="flex flex-col gap-3">
							{sectionsOf(dayItems).map(section => (
								<div key={section.key} className="flex flex-col gap-1">
									{section.label ? (
										<div className="flex items-center gap-2 px-1 text-[11px] font-medium">
											<span
												className={cn(
													'rounded px-1.5 py-0.5',
													TYPE_META[section.kind].chip,
												)}
											>
												{TYPE_META[section.kind].label}
											</span>
											<span
												className="truncate text-muted-foreground"
												title={section.label}
											>
												{section.label}
											</span>
										</div>
									) : null}
									{section.items.map(it => {
										const dealt = isDealt(statusMap[it.ref]);
										const supporting =
											!!it.articleKey && it.channel !== 'github-discussion';
										return (
											<button
												key={it.ref}
												type="button"
												onClick={() => setSelectedRef(it.ref)}
												className={cn(
													'flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs transition-colors',
													selectedItem?.ref === it.ref
														? 'border-primary bg-primary/10'
														: 'border-transparent hover:bg-primary/5',
													dealt && 'text-muted-foreground line-through',
													supporting && 'pl-4',
												)}
											>
												<span
													className={cn(
														'h-1.5 w-1.5 shrink-0 rounded-full',
														TYPE_META[it.type].dot,
													)}
												/>
												<span className="w-16 shrink-0 text-muted-foreground">
													{CHANNEL_SHORT[it.channel] ?? it.channel}
												</span>
												<span className="truncate" title={rowLabel(it)}>
													{rowLabel(it)}
												</span>
											</button>
										);
									})}
								</div>
							))}
						</div>

						<section className="min-w-0">
							{selectedItem ? (
								<>
									<div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
										<span
											className={cn(
												'rounded px-2 py-0.5 text-xs font-medium',
												TYPE_META[selectedItem.type].chip,
											)}
										>
											{TYPE_META[selectedItem.type].label}
										</span>
										<span className="text-sm font-medium">
											{CHANNEL_SHORT[selectedItem.channel] ??
												selectedItem.channel}
										</span>
										{selectedItem.articleTitle ? (
											<span className="text-sm text-muted-foreground">
												· {selectedItem.articleTitle}
											</span>
										) : null}
										<span className="text-xs text-muted-foreground">
											{selectedItem.sourceLabel}
										</span>
										{selectedItem.releaseSet ? (
											<span className="font-mono text-xs text-muted-foreground">
												{selectedItem.releaseSet}
											</span>
										) : null}
										{selectedItem.packPath ? (
											<Link
												href={selectedItem.packPath}
												className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
											>
												<ExternalLink className="h-3 w-3" />
												Open in pack
											</Link>
										) : null}
									</div>
									<PostPane
										item={selectedItem}
										status={selStatus}
										marking={marking}
										markError={
											markError && markError.ref === selectedItem.ref
												? markError.message
												: null
										}
										onMark={status => mark(selectedItem, status)}
									/>
								</>
							) : null}
						</section>
					</div>
				)}
			</div>
		</div>
	);
}

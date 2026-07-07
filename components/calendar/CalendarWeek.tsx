'use client';

import {ExternalLink} from 'lucide-react';
import Link from 'next/link';
import {useState} from 'react';
import type {ResolvedWeek} from '@/lib/calendar';
import {cn} from '@/lib/utils';
import {
	CHANNEL_SHORT,
	isDealt,
	PostPane,
	TYPE_META,
	useDistribute,
} from './shared';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarWeek({week}: {week: ResolvedWeek}) {
	const allItems = week.days.flatMap(d => d.items);
	const {statusMap, marking, markError, mark} = useDistribute(allItems);
	const [selected, setSelected] = useState(allItems[0]?.ref ?? '');

	const selectedItem = allItems.find(i => i.ref === selected) ?? null;
	const selStatus = selectedItem ? statusMap[selectedItem.ref] : undefined;

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
				{(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map(type => (
					<span key={type} className="flex items-center gap-1.5">
						<span className={cn('h-2 w-2 rounded-full', TYPE_META[type].dot)} />
						{TYPE_META[type].label}
					</span>
				))}
			</div>

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
				{week.days.map((day, i) => (
					<div
						key={day.date}
						className="flex min-h-[7rem] flex-col rounded-lg border border-border/60 p-2"
					>
						<div className="mb-2 flex items-baseline justify-between">
							<span className="text-xs font-medium">{WEEKDAYS[i]}</span>
							<span className="text-xs text-muted-foreground">
								{day.date.slice(5)}
							</span>
						</div>
						{day.items.length === 0 ? (
							<span className="text-[11px] text-muted-foreground">—</span>
						) : (
							<ul className="flex flex-col gap-1">
								{day.items.map(it => {
									const dealt = isDealt(statusMap[it.ref]);
									return (
										<li key={it.ref}>
											<button
												type="button"
												onClick={() => setSelected(it.ref)}
												title={`${it.sourceLabel} · ${TYPE_META[it.type].label}`}
												className={cn(
													'flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-left text-[11px] transition-colors',
													selected === it.ref
														? 'border-primary bg-primary/10'
														: 'border-transparent hover:bg-primary/5',
													dealt && 'text-muted-foreground line-through',
												)}
											>
												<span
													className={cn(
														'h-1.5 w-1.5 shrink-0 rounded-full',
														TYPE_META[it.type].dot,
													)}
												/>
												<span className="truncate">
													{CHANNEL_SHORT[it.channel] ?? it.channel}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				))}
			</div>

			{selectedItem ? (
				<div className="mt-8">
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
							{CHANNEL_SHORT[selectedItem.channel] ?? selectedItem.channel}
						</span>
						<span className="text-sm text-muted-foreground">
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
				</div>
			) : (
				<p className="mt-8 text-muted-foreground">
					Nothing scheduled this week yet.
				</p>
			)}
		</div>
	);
}

'use client';

import {useState} from 'react';
import MarkdownPane from '@/components/MarkdownPane';
import type {ResolvedItem, SlotType} from '@/lib/calendar';
import {type MarkStatus, markStatus} from '@/lib/distribute';

/** Short display label per channel slug. */
export const CHANNEL_SHORT: Record<string, string> = {
	x: 'X',
	reddit: 'Reddit',
	linkedin: 'LinkedIn',
	'github-discussion': 'Discussion',
};

/** Colour + label per scheduling type, shared by the month and week views. */
export const TYPE_META: Record<
	SlotType,
	{label: string; dot: string; chip: string}
> = {
	release: {
		label: 'Release',
		dot: 'bg-primary',
		chip: 'bg-primary/10 text-primary',
	},
	'backlog-article': {
		label: 'Article',
		dot: 'bg-emerald-500',
		chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
	},
	'evergreen-x': {
		label: 'Evergreen',
		dot: 'bg-muted-foreground',
		chip: 'bg-muted text-muted-foreground',
	},
};

export type Status = {distributedAt: string | null; wontUseAt: string | null};

function fileNameOf(ref: string): string {
	return ref.split('/').pop() ?? ref;
}

export function isDealt(s: Status | undefined): boolean {
	return !!(s?.distributedAt || s?.wontUseAt);
}

/**
 * Distribution state for a set of items, keyed by ref. Handles the optimistic
 * update + Worker call + rollback that the "Mark distributed / won't use"
 * buttons drive. Shared by the month and week calendar views.
 */
export function useDistribute(items: ResolvedItem[]) {
	const [statusMap, setStatusMap] = useState<Record<string, Status>>(() => {
		const m: Record<string, Status> = {};
		for (const it of items) {
			m[it.ref] = {distributedAt: it.distributedAt, wontUseAt: it.wontUseAt};
		}
		return m;
	});
	const [marking, setMarking] = useState(false);
	const [markError, setMarkError] = useState<{
		ref: string;
		message: string;
	} | null>(null);

	const mark = async (item: ResolvedItem, status: MarkStatus) => {
		const cur = statusMap[item.ref];
		if (marking || cur?.distributedAt || cur?.wontUseAt) return;
		const ref = item.ref;
		const optimistic = new Date().toISOString();
		const key = status === 'distributed' ? 'distributedAt' : 'wontUseAt';
		setStatusMap(m => ({...m, [ref]: {...m[ref], [key]: optimistic}}));
		setMarking(true);
		setMarkError(null);
		try {
			const result = await markStatus(ref, status, optimistic);
			setStatusMap(m => ({...m, [ref]: {...m[ref], [key]: result.markedAt}}));
		} catch (err) {
			setStatusMap(m => ({...m, [ref]: {...m[ref], [key]: null}}));
			setMarkError({
				ref,
				message:
					err instanceof Error
						? err.message
						: status === 'distributed'
							? 'Failed to mark distributed'
							: "Failed to mark won't use",
			});
		} finally {
			setMarking(false);
		}
	};

	return {statusMap, marking, markError, mark};
}

/** The read/distribute pane for one selected post. */
export function PostPane({
	item,
	status,
	marking,
	markError,
	onMark,
}: {
	item: ResolvedItem;
	status: Status | undefined;
	marking: boolean;
	markError: string | null;
	onMark: (status: MarkStatus) => void;
}) {
	if (item.missing) {
		return (
			<p className="text-sm text-destructive">
				Source file not found: <code>{item.ref}</code>. The planner will prune
				this on its next run.
			</p>
		);
	}
	return (
		<MarkdownPane
			key={item.ref}
			filename={fileNameOf(item.ref)}
			raw={item.raw}
			body={item.body}
			distributedAt={status?.distributedAt ?? null}
			wontUseAt={status?.wontUseAt ?? null}
			marking={marking}
			markError={markError}
			onMarkDistributed={() => onMark('distributed')}
			onMarkWontUse={() => onMark('wont_use')}
		/>
	);
}

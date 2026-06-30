import {useRouter} from 'next/router';
import {useEffect, useRef} from 'react';

/**
 * When a pack page is opened with `?file=<channel>` (a deep link, e.g. from the
 * weekly digest), preselect that file once — as soon as the router is ready.
 *
 * `channels` is the set of valid channel keys on the page; an absent or unknown
 * param is ignored, leaving the page's default selection. The preselect is
 * applied at most once so it never fights a manual click in the file tree.
 */
export function useFileQueryParam(
	channels: string[],
	onSelect: (channel: string) => void,
): void {
	const router = useRouter();
	const applied = useRef(false);
	useEffect(() => {
		if (applied.current || !router.isReady) return;
		const raw = router.query.file;
		const value = Array.isArray(raw) ? raw[0] : raw;
		if (value && channels.includes(value)) onSelect(value);
		applied.current = true;
	}, [router.isReady, router.query.file, channels, onSelect]);
}

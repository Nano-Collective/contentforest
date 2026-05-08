'use client';

import {Check, Code, Copy, Download, Eye, Send} from 'lucide-react';
import {marked} from 'marked';
import {useMemo, useState} from 'react';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';

type Props = {
	filename: string;
	raw: string;
	body: string;
	distributedAt: string | null;
	marking: boolean;
	markError: string | null;
	onMark: () => void;
};

type Mode = 'preview' | 'raw';

function formatDistributedAt(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString();
}

export default function MarkdownPane({
	filename,
	raw,
	body,
	distributedAt,
	marking,
	markError,
	onMark,
}: Props) {
	const [mode, setMode] = useState<Mode>('preview');
	const [copied, setCopied] = useState(false);

	const rendered = useMemo(() => marked.parse(body) as string, [body]);

	const onCopy = async () => {
		await navigator.clipboard.writeText(body);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	const onDownload = () => {
		const blob = new Blob([raw], {type: 'text/markdown'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	return (
		<div className="flex flex-col h-full min-h-[60vh]">
			<div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3 mb-4">
				<div className="flex items-center gap-1 rounded-md border border-border p-0.5">
					<button
						type="button"
						onClick={() => setMode('preview')}
						className={cn(
							'flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors',
							mode === 'preview'
								? 'bg-accent text-accent-foreground'
								: 'text-muted-foreground hover:text-foreground',
						)}
					>
						<Eye className="h-3.5 w-3.5" />
						Preview
					</button>
					<button
						type="button"
						onClick={() => setMode('raw')}
						className={cn(
							'flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors',
							mode === 'raw'
								? 'bg-accent text-accent-foreground'
								: 'text-muted-foreground hover:text-foreground',
						)}
					>
						<Code className="h-3.5 w-3.5" />
						Raw
					</button>
				</div>
				<div className="flex items-center gap-2">
					{distributedAt ? (
						<span className="text-xs text-muted-foreground">
							Distributed {formatDistributedAt(distributedAt)}
						</span>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={onMark}
							disabled={marking}
						>
							<Send className="h-3.5 w-3.5" />
							{marking ? 'Marking…' : 'Mark distributed'}
						</Button>
					)}
					<Button variant="outline" size="sm" onClick={onCopy}>
						{copied ? (
							<>
								<Check className="h-3.5 w-3.5" />
								Copied
							</>
						) : (
							<>
								<Copy className="h-3.5 w-3.5" />
								Copy
							</>
						)}
					</Button>
					<Button variant="outline" size="sm" onClick={onDownload}>
						<Download className="h-3.5 w-3.5" />
						Download
					</Button>
				</div>
			</div>

			{markError ? (
				<p className="text-xs text-destructive mb-3">{markError}</p>
			) : null}

			{mode === 'preview' ? (
				<article
					className="prose prose-sm dark:prose-invert max-w-none"
					// nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- markdown is sourced from content/ files we author and the validator gates, not user input
					dangerouslySetInnerHTML={{__html: rendered}}
				/>
			) : (
				<pre className="text-xs font-mono bg-muted rounded-md p-4 overflow-x-auto whitespace-pre-wrap break-words">
					{raw}
				</pre>
			)}
		</div>
	);
}

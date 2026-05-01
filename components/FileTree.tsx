import {File} from 'lucide-react';
import {cn} from '@/lib/utils';

export type FileTreeItem = {
	channel: string;
	label: string;
	group: 'channels' | 'personal';
};

export type FileTreeSection = {
	key: string;
	title: string;
	subtitle?: string;
	items: FileTreeItem[];
};

type Props = {
	sections: FileTreeSection[];
	selected: string;
	onSelect: (channel: string) => void;
};

const GROUP_LABELS: Record<FileTreeItem['group'], string> = {
	channels: 'Channels',
	personal: 'Personal',
};

export default function FileTree({sections, selected, onSelect}: Props) {
	return (
		<div className="flex flex-col gap-6">
			{sections.map(section => {
				if (section.items.length === 0) return null;
				const groups = (
					Object.keys(GROUP_LABELS) as FileTreeItem['group'][]
				).map(group => ({
					group,
					items: section.items.filter(i => i.group === group),
				}));

				return (
					<div key={section.key}>
						<p className="text-xs uppercase tracking-wider text-foreground font-semibold mb-1 px-2">
							{section.title}
						</p>
						{section.subtitle && (
							<p className="text-xs text-muted-foreground mb-2 px-2 leading-snug">
								{section.subtitle}
							</p>
						)}
						<div className="flex flex-col gap-3">
							{groups.map(
								({group, items: groupItems}) =>
									groupItems.length > 0 && (
										<div key={group}>
											<p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 px-2">
												{GROUP_LABELS[group]}
											</p>
											<ul className="flex flex-col gap-0.5">
												{groupItems.map(item => {
													const isSelected = item.channel === selected;
													return (
														<li key={item.channel}>
															<button
																type="button"
																onClick={() => onSelect(item.channel)}
																className={cn(
																	'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
																	isSelected
																		? 'bg-accent text-foreground font-medium'
																		: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
																)}
															>
																<File className="h-4 w-4 shrink-0" />
																<span className="truncate text-left">
																	{item.label}
																</span>
															</button>
														</li>
													);
												})}
											</ul>
										</div>
									),
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

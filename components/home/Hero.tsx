import {Folder, GitBranch} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';

// Three.js + WebGL only run client-side. SSR-skipping the import keeps the
// static export build clean and avoids a flash of an unrendered canvas.
const EffectScene = dynamic(
	() => import('@/components/EffectScene').then(m => m.EffectScene),
	{ssr: false},
);

export function Hero() {
	return (
		<section className="relative overflow-hidden min-h-[70vh] hero-section">
			<div className="absolute inset-0" style={{minHeight: '70vh'}}>
				<EffectScene />
			</div>
			<div className="absolute inset-0 pointer-events-none hero-overlay" />
			<div className="max-w-6xl mx-auto px-4 py-20 sm:py-28 relative z-10">
				<div className="max-w-2xl text-center sm:text-left mx-auto sm:mx-0 space-y-6">
					<div className="inline-block animate-on-scroll">
						<Badge variant="secondary" className="mb-2 text-sm px-4 py-1.5">
							Internal · Nano Collective
						</Badge>
					</div>
					<h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-foreground animate-on-scroll animate-delay-100">
						ContentForest
					</h1>
					<p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl leading-relaxed animate-on-scroll animate-delay-200">
						Release content for the Nano Collective. Browse, copy, post.
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center sm:justify-start items-center sm:items-start pt-4 w-full sm:w-auto">
						<Button
							size="lg"
							className="group text-base w-full sm:w-auto"
							asChild
						>
							<Link href="#products">
								<Folder className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
								Browse packs
							</Link>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="group text-base w-full sm:w-auto"
							asChild
						>
							<a
								href="https://github.com/Nano-Collective/contentforest"
								target="_blank"
								rel="noopener noreferrer"
							>
								<GitBranch className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
								Repo
							</a>
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}

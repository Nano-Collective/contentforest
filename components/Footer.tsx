export default function Footer() {
	return (
		<footer className="border-t border-border/40 py-8 mt-16">
			<div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-muted-foreground">
				<p>ContentForest · © {new Date().getFullYear()} Nano Collective</p>
				<p>
					Internal tool. Content here is unpublished — copy out, post manually.
				</p>
			</div>
		</footer>
	);
}

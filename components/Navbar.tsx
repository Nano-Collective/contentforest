import { LogOut } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
        >
          <span className="text-lg">ContentForest</span>
          <span className="hidden sm:inline text-xs text-muted-foreground font-normal">
            · Nano Collective
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <a
            href="/cdn-cgi/access/logout"
            className="p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </a>
        </div>
      </div>
    </header>
  );
}

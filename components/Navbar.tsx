import { LogOut } from "lucide-react";
import Link from "next/link";
import { logoutUrlFor, useIdentity } from "@/hooks/useIdentity";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const identity = useIdentity();
  const logoutUrl =
    identity.status === "identified" ? logoutUrlFor(identity.identity) : null;

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

        <div className="flex items-center gap-2">
          {identity.status === "identified" && (
            <IdentityBadge
              login={identity.identity.github_login}
              name={identity.identity.name}
              email={identity.identity.email}
            />
          )}
          <ThemeToggle />
          {logoutUrl && (
            <a
              href={logoutUrl}
              className="p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

function IdentityBadge({
  login,
  name,
  email,
}: {
  login?: string;
  name?: string;
  email?: string;
}) {
  const display = login || name || email || "";
  // GitHub serves a per-user avatar at https://github.com/<login>.png. Fall
  // back to a Gravatar-style initial when we only have name/email.
  const avatarUrl = login ? `https://github.com/${login}.png?size=48` : null;
  const title = [name, email, login ? `@${login}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className="hidden sm:flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground"
      title={title}
    >
      {avatarUrl ? (
        // Avatar is decorative; the title attribute carries the identity for SR users.
        // biome-ignore lint/performance/noImgElement: external GH avatar URL, next/image static export incompatibility
        <img
          src={avatarUrl}
          alt=""
          className="h-6 w-6 rounded-full border border-border/40"
          width={24}
          height={24}
        />
      ) : (
        <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground/70">
          {display.charAt(0).toUpperCase() || "?"}
        </span>
      )}
      <span className="hidden md:inline truncate max-w-[12rem]">{display}</span>
    </span>
  );
}

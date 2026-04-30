import { useEffect, useState } from "react";

export type Identity = {
  name?: string;
  email?: string;
  // Cloudflare Access populates this from the GitHub IdP token claims when
  // the user signed in via the GitHub provider.
  github_login?: string;
  // The team's Access auth domain (e.g. "https://<team>.cloudflareaccess.com").
  // Used to build the canonical logout URL — the per-app `/cdn-cgi/access/logout`
  // path 404s on Cloudflare Pages static-export sites because Pages serves its
  // 404 before Access intercepts. The team-domain logout always works.
  iss?: string;
};

type State =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "identified"; identity: Identity };

/**
 * Reads the signed-in user from Cloudflare Access's edge endpoint. Returns
 * { status: "anonymous" } when the endpoint isn't reachable — that's the
 * shape on local dev (no Access intercept) and inside the build (no fetch
 * possible). The Access-protected production hostname always serves the
 * endpoint.
 */
export function useIdentity(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/cdn-cgi/access/get-identity", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Identity | null) => {
        if (cancelled) return;
        if (data && (data.name || data.email || data.github_login)) {
          setState({ status: "identified", identity: data });
        } else {
          setState({ status: "anonymous" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * The canonical Access logout URL for the signed-in user's team. Returns
 * null when we don't have an identity (local dev, or before the identity
 * fetch resolves) — caller should hide the sign-out affordance in that case.
 */
export function logoutUrlFor(identity: Identity | null): string | null {
  if (!identity?.iss) return null;
  // iss is "https://<team>.cloudflareaccess.com" — strip any trailing slash
  // before appending the Access logout path.
  const base = identity.iss.replace(/\/$/, "");
  return `${base}/cdn-cgi/access/logout`;
}

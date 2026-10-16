/** A relative path is safe to redirect to: starts with one "/" and isn't protocol-relative. */
function isRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

/**
 * Reduce a `next` value from an email link to a safe in-app path.
 * Accepts a relative path, or an absolute URL on the same origin (Supabase passes the
 * full redirect URL, e.g. https://site/auth/callback?next=%2Fevents). A `/auth/callback`
 * wrapper is unwrapped to its own `next`. Anything else becomes "/".
 */
export function sanitizeNext(raw: string | null | undefined, origin: string): string {
  if (!raw) return "/";

  let path: string;
  let search = "";
  if (isRelativePath(raw)) {
    try {
      const url = new URL(raw, origin);
      if (url.origin !== origin) return "/";
      path = url.pathname;
      search = url.search;
    } catch {
      return "/";
    }
  } else {
    try {
      const url = new URL(raw);
      if (url.origin !== origin) return "/";
      path = url.pathname;
      search = url.search;
    } catch {
      return "/";
    }
  }

  if (path === "/auth/callback") {
    const inner = new URLSearchParams(search).get("next");
    return inner && isRelativePath(inner) && !inner.startsWith("/auth/callback")
      ? sanitizeNext(inner, origin)
      : "/";
  }

  const result = `${path}${search}`;
  return isRelativePath(result) ? result : "/";
}

// SSRF guard for feed URLs: only public http(s) hosts. Loopback is allowed in development
// so a local fixture server can be used for testing.

import { isIP } from "node:net";

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inCidr(ip: string, base: string, bits: number) {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function isLoopback(ip: string): boolean {
  if (isIP(ip) === 4) return inCidr(ip, "127.0.0.0", 8);
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "0:0:0:0:0:0:0:1" || (v6.startsWith("::ffff:") && isLoopback(v6.slice(7)));
}

/** Private, loopback, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
      ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
    ].some(([base, bits]) => inCidr(ip, base as string, bits as number));
  }
  if (version === 6) {
    const v6 = ip.toLowerCase();
    if (v6.startsWith("::ffff:")) {
      const mapped = v6.slice(7);
      return isIP(mapped) === 4 ? isPrivateAddress(mapped) : true;
    }
    return (
      v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") ||
      /^fe[89ab]/.test(v6) || v6.startsWith("ff")
    );
  }
  return true; // not an IP at all → treat as unsafe
}

const PRIVATE_HOSTNAMES = /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/i;

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

/** Static checks on a feed URL (protocol, credentials, obvious private hosts). */
export function checkFeedUrl(raw: string, { allowLoopback = process.env.NODE_ENV === "development" } = {}): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Enter a full URL starting with https://" };
  }
  if (url.protocol === "webcal:") url = new URL(`https:${url.href.slice("webcal:".length)}`);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Only http(s) feed URLs are allowed." };
  }
  if (url.username || url.password) return { ok: false, error: "Feed URLs can't contain a username or password." };

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const loopbackName = host === "localhost" || host.endsWith(".localhost");
  if (isIP(host)) {
    if (isPrivateAddress(host) && !(allowLoopback && isLoopback(host))) {
      return { ok: false, error: "Feeds on private or local network addresses aren't allowed." };
    }
  } else if (loopbackName) {
    if (!allowLoopback) return { ok: false, error: "Feeds on localhost aren't allowed." };
  } else if (PRIVATE_HOSTNAMES.test(host) || !host.includes(".")) {
    return { ok: false, error: "Use a public feed URL." };
  }
  return { ok: true, url };
}

/** Checks the addresses a hostname resolved to. */
export function checkResolvedAddresses(addresses: string[], { allowLoopback = process.env.NODE_ENV === "development" } = {}) {
  if (addresses.length === 0) return "The feed's host didn't resolve.";
  const bad = addresses.find((a) => isPrivateAddress(a) && !(allowLoopback && isLoopback(a)));
  return bad ? "The feed's host points at a private network address." : null;
}

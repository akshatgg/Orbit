import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { checkFeedUrl, checkResolvedAddresses } from "./url-guard";

export const USER_AGENT = "ORBIT event sync (+https://orbit.akshatgg.in)";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

async function assertSafeUrl(raw: string) {
  const check = checkFeedUrl(raw);
  if (!check.ok) throw new Error(check.error);
  const host = check.url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  const problem = checkResolvedAddresses(addresses);
  if (problem) throw new Error(problem);
  return check.url;
}

/**
 * Fetches a feed politely and safely: SSRF checks on every hop, a timeout, a size cap,
 * an identifying User-Agent, and HTTP errors surfaced as errors.
 */
export async function fetchFeedText(rawUrl: string): Promise<string> {
  let url = await assertSafeUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/calendar, text/plain;q=0.8, */*;q=0.1" },
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        if (hop === MAX_REDIRECTS) throw new Error("The feed redirected too many times.");
        url = await assertSafeUrl(new URL(response.headers.get("location")!, url).toString());
        continue;
      }
      break;
    }
    if (!response) throw new Error("No response from the feed.");
    if (response.status === 429 || response.status === 503) {
      throw new Error(`The feed asked us to slow down (HTTP ${response.status}). We'll try again on the next refresh.`);
    }
    if (!response.ok) throw new Error(`The feed returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`);

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new Error("The feed is larger than 5 MB.");
    if (!response.body) return "";

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error("The feed is larger than 5 MB.");
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("The feed took too long to respond (15s).");
    if (e instanceof TypeError && e.message === "fetch failed") {
      const cause = (e as TypeError & { cause?: { code?: string } }).cause;
      throw new Error(`Couldn't reach the feed${cause?.code ? ` (${cause.code})` : ""}.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

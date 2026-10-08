/**
 * Minimal HTTP layer built on Node 18+ global `fetch`. Zero runtime dependencies.
 * Results are cached by (url, accept) so repeated checks don't re-hit the network.
 */

export interface FetchResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
  url: string;
}

export type Fetcher = (url: string, accept?: string) => Promise<FetchResult>;

export const DEFAULT_UA = 'webagent-skills/1.0 (+https://agentskills.io)';
const MAX_BODY = 2 * 1024 * 1024; // 2 MB, mirrors the Markdown-for-Agents origin limit

export interface FetcherOptions {
  timeout: number; // seconds
  userAgent: string;
  insecure: boolean;
}

export function makeFetcher(opts: FetcherOptions): Fetcher {
  // TLS verification is ON by default. --insecure is opt-in and staging-only;
  // it disables verification process-wide, so the CLI warns loudly when set.
  if (opts.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const cache = new Map<string, FetchResult>();

  return async (url: string, accept?: string): Promise<FetchResult> => {
    const key = `${url}|${accept ?? ''}`;
    const hit = cache.get(key);
    if (hit) return hit;

    let result: FetchResult;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': opts.userAgent, Accept: accept ?? '*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(opts.timeout * 1000),
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key2) => { headers[key2.toLowerCase()] = value; });
      const declared = Number(headers['content-length'] ?? 0);
      const body = declared > MAX_BODY ? '' : (await res.text()).slice(0, MAX_BODY);
      result = { status: res.status, headers, body, url };
    } catch (err) {
      const e = err as { name?: string; message?: string };
      result = { status: 0, headers: {}, body: '', url, error: `${e.name ?? 'Error'}: ${e.message ?? String(err)}` };
    }
    cache.set(key, result);
    return result;
  };
}

/** Case-insensitive single-value header lookup ('' when absent). */
export const header = (res: FetchResult, name: string): string => res.headers[name.toLowerCase()] ?? '';

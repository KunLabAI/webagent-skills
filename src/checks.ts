/**
 * Check registry + evaluators. Data-driven: each check is a declarative record;
 * a few need custom probes (attached via `fn`). Mirrors the verified validator logic.
 */
import { header, type Fetcher } from './http.js';

export type Severity = 'core' | 'recommended' | 'optional';
export type Status = 'pass' | 'fail' | 'warn' | 'skip' | 'manual';
export type Category =
  | 'seo' | 'ai' | 'security' | 'discovery' | 'auth' | 'agent' | 'commerce' | 'experimental';

export interface CheckDetail {
  url?: string;
  status?: number;
  error?: string;
  problems?: string[];
  present?: string[];
  missing?: string[];
  note?: string;
  guidance?: string;
  [key: string]: unknown;
}

export interface CheckResult { status: Status; detail: CheckDetail; }

export interface ProbeContext { doh?: string }
export type CustomProbe = (check: Check, base: string, fetcher: Fetcher, ctx: ProbeContext) => Promise<CheckResult>;

export interface Check {
  id: string;
  cat: Category;
  severity: Severity;
  title: string;
  mode?: 'http' | 'fn' | 'doh' | 'manual';
  path?: string;
  accept?: string;
  status?: number;
  contentType?: string;
  bodyAll?: string[];
  bodyAny?: string[];
  jsonKeys?: string[];
  headersPresent?: string[];
  soft?: boolean;
  manualReason?: string;
  fn?: CustomProbe;
}

/** How ABSENCE of an artifact is scored, by severity. */
export const ABSENT_STATUS: Record<Severity, Status> = { core: 'fail', recommended: 'warn', optional: 'skip' };

const AI_BOTS = [
  'gptbot', 'oai-searchbot', 'claudebot', 'claude-web', 'anthropic-ai',
  'google-extended', 'perplexitybot', 'ccbot', 'bytespider',
];
const SECURITY_HEADERS = [
  'strict-transport-security', 'content-security-policy', 'x-frame-options',
  'x-content-type-options', 'referrer-policy', 'permissions-policy',
];
const LINK_RELS = ['api-catalog', 'service-desc', 'service-doc', 'describedby'];

/* eslint-disable @typescript-eslint/no-explicit-any */
export function tryJson(text: string): any | null {
  try { return JSON.parse(text); } catch { return null; }
}

function dig(obj: any, path: string): unknown {
  return path.split('.').reduce<any>(
    (cur, seg) => (cur && typeof cur === 'object' && seg in cur ? cur[seg] : undefined), obj);
}

function resolveUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

function absent(check: Check, detail: CheckDetail): CheckResult {
  return {
    status: ABSENT_STATUS[check.severity],
    detail: { ...detail, note: detail.note ?? `artifact not served (HTTP ${detail.status ?? 0})` },
  };
}

/** Generic evaluator for declarative `http` checks. */
export async function evalHttp(check: Check, base: string, fetcher: Fetcher): Promise<CheckResult> {
  const url = resolveUrl(base, check.path ?? '/');
  const res = await fetcher(url, check.accept);
  const detail: CheckDetail = { url, status: res.status };
  if (res.error) detail.error = res.error;

  const transportOk = !res.error && res.status === (check.status ?? 200);
  if (!transportOk) return absent(check, detail);

  const problems: string[] = [];
  const ct = header(res, 'content-type').toLowerCase();
  const wantCt = check.contentType;
  if (wantCt && !ct.includes(wantCt)) problems.push(`content-type '${ct || 'none'}' lacks '${wantCt}'`);

  const bodyLc = res.body.toLowerCase();
  for (const token of check.bodyAll ?? []) if (!bodyLc.includes(token)) problems.push(`body missing '${token}'`);
  const anyTokens = check.bodyAny;
  if (anyTokens && !anyTokens.some(t => bodyLc.includes(t))) problems.push(`body missing any of ${anyTokens.join(', ')}`);

  if (check.jsonKeys) {
    const parsed = tryJson(res.body);
    if (parsed === null) problems.push('body is not valid JSON');
    else for (const key of check.jsonKeys) if (dig(parsed, key) === undefined) problems.push(`JSON missing key '${key}'`);
  }
  for (const h of check.headersPresent ?? []) if (!header(res, h)) problems.push(`header '${h}' absent`);

  detail.problems = problems;
  // Present-but-malformed is a hard fail, unless the check is `soft` (a feature layered
  // on an existing page, e.g. Markdown negotiation on `/`) — then score by severity.
  const status: Status = problems.length === 0 ? 'pass' : (check.soft ? ABSENT_STATUS[check.severity] : 'fail');
  return { status, detail };
}

// --- Custom probes ---------------------------------------------------------

export const probeSecurityHeaders: CustomProbe = async (_check, base, fetcher) => {
  const res = await fetcher(base);
  const present = SECURITY_HEADERS.filter(h => header(res, h));
  const missing = SECURITY_HEADERS.filter(h => !header(res, h));
  const csp = header(res, 'content-security-policy').toLowerCase();
  // CSP frame-ancestors is an accepted substitute for X-Frame-Options.
  const substituted = missing.includes('x-frame-options') && csp.includes('frame-ancestors');
  const effectiveMissing = missing.filter(h => !(substituted && h === 'x-frame-options'));
  const detail: CheckDetail = { url: base, present, missing: effectiveMissing };
  if (res.error) detail.error = res.error;
  const status: Status = effectiveMissing.length === 0
    ? 'pass'
    : (effectiveMissing.length === SECURITY_HEADERS.length ? 'fail' : 'warn');
  return { status, detail };
};

export const probeContentSignal: CustomProbe = async (check, base, fetcher) => {
  const robots = await fetcher(resolveUrl(base, '/robots.txt'));
  const home = await fetcher(base);
  const inRobots = robots.body.toLowerCase().includes('content-signal');
  const signalHeader = header(home, 'content-signal');
  const found = inRobots || Boolean(signalHeader);
  return {
    status: found ? 'pass' : ABSENT_STATUS[check.severity],
    detail: { robots_directive: inRobots, response_header: signalHeader || null },
  };
};

export const probeLinkHeaders: CustomProbe = async (check, base, fetcher) => {
  const res = await fetcher(base);
  const link = header(res, 'Link').toLowerCase();
  const rels = LINK_RELS.filter(rel => link.includes(`rel="${rel}"`));
  return {
    status: rels.length ? 'pass' : ABSENT_STATUS[check.severity],
    detail: { url: base, link_header: header(res, 'Link') || null, matched_rels: rels },
  };
};

export const probeAuthMd: CustomProbe = async (check, base, fetcher) => {
  const url = resolveUrl(base, '/auth.md');
  const res = await fetcher(url);
  const first = res.body.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? '';
  const ok = res.status === 200 && first.startsWith('#') && first.toLowerCase().includes('auth.md');
  const present = res.status === 200 && !res.error;
  const status: Status = ok ? 'pass' : (present ? 'fail' : ABSENT_STATUS[check.severity]);
  return { status, detail: { url, status: res.status, h1: first || null } };
};

export const probeDnsAid: CustomProbe = async (check, base, fetcher, ctx) => {
  const name = `_index._agents.${new URL(base).hostname}`;
  const resolvers = ctx.doh ? [ctx.doh] : ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'];
  for (const resolver of resolvers) {
    const res = await fetcher(`${resolver}?name=${encodeURIComponent(name)}&type=SVCB`, 'application/dns-json');
    const data = tryJson(res.body);
    if (data && data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0) {
      return { status: 'pass', detail: { name, resolver, answers: data.Answer.length } };
    }
  }
  return { status: ABSENT_STATUS[check.severity], detail: { name, note: 'no SVCB/HTTPS answer under _agents namespace' } };
};

export const probeManual: CustomProbe = async check => ({ status: 'manual', detail: { guidance: check.manualReason ?? '' } });

// --- Registry --------------------------------------------------------------

export function buildChecks(): Check[] {
  return [
    { id: 'robotsTxt', cat: 'seo', severity: 'core', title: 'robots.txt (RFC 9309)', mode: 'http', path: '/robots.txt', contentType: 'text/plain', bodyAll: ['user-agent'] },
    { id: 'contentSignals', cat: 'seo', severity: 'recommended', title: 'Content-Signal policy', mode: 'fn', fn: probeContentSignal },
    { id: 'aiRules', cat: 'seo', severity: 'recommended', title: 'AI crawler rules', mode: 'http', path: '/robots.txt', contentType: 'text/plain', bodyAny: AI_BOTS },
    { id: 'sitemap', cat: 'seo', severity: 'core', title: 'sitemap.xml', mode: 'http', path: '/sitemap.xml', bodyAll: ['<loc'], bodyAny: ['<urlset', '<sitemapindex'] },
    { id: 'llmsTxt', cat: 'seo', severity: 'recommended', title: 'llms.txt', mode: 'http', path: '/llms.txt', bodyAll: ['#'] },
    { id: 'linkHeaders', cat: 'discovery', severity: 'recommended', title: 'Link headers (RFC 8288)', mode: 'fn', fn: probeLinkHeaders },
    { id: 'markdownNegotiation', cat: 'ai', severity: 'recommended', title: 'Markdown-for-Agents', mode: 'http', path: '/', accept: 'text/markdown', contentType: 'text/markdown', soft: true },
    { id: 'securityHeaders', cat: 'security', severity: 'core', title: 'Security response headers', mode: 'fn', fn: probeSecurityHeaders },
    { id: 'apiCatalog', cat: 'discovery', severity: 'optional', title: 'API Catalog (RFC 9727)', mode: 'http', path: '/.well-known/api-catalog', contentType: 'linkset+json', jsonKeys: ['linkset'] },
    { id: 'oauthAS', cat: 'auth', severity: 'optional', title: 'OAuth AS metadata (RFC 8414)', mode: 'http', path: '/.well-known/oauth-authorization-server', contentType: 'json', jsonKeys: ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri'] },
    { id: 'oauthPRM', cat: 'auth', severity: 'optional', title: 'OAuth Protected Resource (RFC 9728)', mode: 'http', path: '/.well-known/oauth-protected-resource', contentType: 'json', jsonKeys: ['resource', 'authorization_servers'] },
    { id: 'oidc', cat: 'auth', severity: 'optional', title: 'OIDC Discovery', mode: 'http', path: '/.well-known/openid-configuration', contentType: 'json', jsonKeys: ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri'] },
    { id: 'authMd', cat: 'auth', severity: 'optional', title: 'Auth.md registration discovery', mode: 'fn', fn: probeAuthMd },
    { id: 'a2aAgentCard', cat: 'agent', severity: 'optional', title: 'A2A Agent Card', mode: 'http', path: '/.well-known/agent-card.json', contentType: 'json', jsonKeys: ['name'] },
    { id: 'agentSkills', cat: 'agent', severity: 'optional', title: 'Agent Skills Discovery Index', mode: 'http', path: '/.well-known/agent-skills/index.json', contentType: 'json', jsonKeys: ['$schema', 'skills'] },
    { id: 'mcpServerCard', cat: 'agent', severity: 'optional', title: 'MCP Server Card', mode: 'http', path: '/.well-known/mcp/server-card.json', contentType: 'json', jsonKeys: ['serverInfo'] },
    { id: 'webBotAuth', cat: 'security', severity: 'optional', title: 'Web Bot Auth JWKS (RFC 9421)', mode: 'http', path: '/.well-known/http-message-signatures-directory', contentType: 'json', jsonKeys: ['keys'] },
    { id: 'acp', cat: 'commerce', severity: 'optional', title: 'ACP discovery', mode: 'http', path: '/.well-known/acp.json', contentType: 'json', jsonKeys: ['protocol.name', 'api_base_url'] },
    { id: 'mpp', cat: 'commerce', severity: 'optional', title: 'MPP payment discovery', mode: 'http', path: '/openapi.json', contentType: 'json', bodyAll: ['x-payment-info'] },
    { id: 'ucp', cat: 'commerce', severity: 'optional', title: 'UCP discovery', mode: 'http', path: '/.well-known/ucp', contentType: 'json', jsonKeys: ['protocol_version', 'services'] },
    { id: 'x402', cat: 'commerce', severity: 'optional', title: 'x402 payment protocol', mode: 'manual', manualReason: 'Requires a route that returns HTTP 402 with payment requirements; cannot be detected passively without triggering a charge.' },
    { id: 'ap2', cat: 'commerce', severity: 'optional', title: 'AP2 payments extension', mode: 'manual', manualReason: 'An AP2 extension entry inside the A2A Agent Card; verify the card declares the AP2 uri and params.roles.' },
    { id: 'dnsAid', cat: 'experimental', severity: 'optional', title: 'DNS-AID (_agents SVCB)', mode: 'doh', fn: probeDnsAid },
    { id: 'webMcp', cat: 'experimental', severity: 'optional', title: 'WebMCP (navigator.modelContext)', mode: 'manual', manualReason: 'Detected by loading the page in a real browser that runs navigator.modelContext.registerTool(); not observable over HTTP.' },
  ];
}

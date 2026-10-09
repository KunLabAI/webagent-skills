/**
 * Human-readable report formatting. JSON output is handled by the CLI directly.
 */
import type { AuditItem, AuditReport } from './audit.js';
import type { Status } from './checks.js';

const BADGE: Record<Status, string> = {
  pass: '✓ PASS', fail: '✗ FAIL', warn: '! WARN', skip: '○ SKIP', manual: '◆ MANUAL',
};
const BADGE_COLOR: Record<Status, string> = {
  pass: '32', fail: '1;31', warn: '33', skip: '2', manual: '36',
};
const ORDER: Record<Status, number> = { fail: 0, warn: 1, manual: 2, skip: 3, pass: 4 };
const GRADE_COLOR: Record<string, string> = { A: '1;32', B: '32', C: '33', D: '33', F: '1;31' };

const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - s.length));

/** ANSI painter; returns input untouched when color is disabled (piped / NO_COLOR). */
type Paint = (code: string, s: string) => string;
const makePaint = (enabled: boolean): Paint =>
  enabled ? (code, s) => `\x1b[${code}m${s}\x1b[0m` : (_code, s) => s;

const RULE = '─'.repeat(58);

function scoreBar(score: number, paint: Paint, code: string, width = 22): string {
  const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)));
  return paint(code, '█'.repeat(filled)) + paint('2', '░'.repeat(width - filled));
}

/**
 * Per-check Chinese annotations, keyed by check id. Each note explains what the
 * check covers and how to satisfy it. Opt-in via `--zh`; the English output is
 * always preserved (bilingual), so JSON consumers and CI are unaffected.
 */
const ZH_NOTES: Record<string, string> = {
  robotsTxt: 'robots.txt（RFC 9309）：声明哪些页面允许爬虫抓取。缺失时需在站点根目录提供 /robots.txt，以 text/plain 返回并含 user-agent 指令。',
  contentSignals: 'Content-Signal 策略：声明是否允许 AI 抓取 / 训练 / 搜索。可在 robots.txt 加 Content-Signal 指令或用响应头，具体取值需按站点政策确认后设置。',
  aiRules: 'AI 爬虫规则：robots.txt 应显式列出 GPTBot、ClaudeBot、Google-Extended、PerplexityBot 等 AI 爬虫的允许 / 禁止规则，以便精细管控。',
  sitemap: 'sitemap.xml：站点地图，帮助搜索引擎与 AI 发现页面。需在 /sitemap.xml 提供含 <loc> 的 <urlset> 或 <sitemapindex>。',
  llmsTxt: 'llms.txt：面向大模型的站点导读文件（llmstxt.org）。建议在 /llms.txt 提供以 # 开头的 Markdown 摘要与关键链接。',
  linkHeaders: 'Link 响应头（RFC 8288）：通过 rel="api-catalog" / "service-desc" 等提示可机读资源的位置，便于 Agent 自动发现接口。',
  markdownNegotiation: 'Markdown-for-Agents：当请求头为 Accept: text/markdown 时应返回 text/markdown 正文，方便 AI 直接消费页面内容。',
  securityHeaders: '安全响应头：建议补齐 CSP、HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy，以满足安全基线与合规扫描。',
  apiCatalog: 'API 目录（RFC 9727）：在 /.well-known/api-catalog 以 linkset+json 公开 API 清单，供 Agent 自动发现可调用接口。',
  oauthAS: 'OAuth 授权服务器元数据（RFC 8414）：在 /.well-known/oauth-authorization-server 暴露 issuer、authorization_endpoint、token_endpoint、jwks_uri，供自动引导授权。',
  oauthPRM: 'OAuth 受保护资源元数据（RFC 9728）：在 /.well-known/oauth-protected-resource 声明 resource 与 authorization_servers。',
  oidc: 'OIDC 发现：在 /.well-known/openid-configuration 暴露 OpenID Connect 配置，供身份提供方自动发现。',
  authMd: 'auth.md：面向 Agent 的鉴权说明文档。首行需为含 “auth.md” 的一级标题，描述如何获取凭据与完成鉴权。',
  a2aAgentCard: 'A2A Agent Card：在 /.well-known/agent-card.json 声明 Agent 的身份与能力（含 name），用于 Agent 间互联（A2A）。',
  agentSkills: 'Agent Skills 发现索引：在 /.well-known/agent-skills/index.json 列出可被调用的技能（含 $schema、skills）。',
  mcpServerCard: 'MCP Server Card：在 /.well-known/mcp/server-card.json 暴露 MCP 服务信息（serverInfo），供工具发现与调用。',
  webBotAuth: 'Web Bot Auth（RFC 9421）：在 /.well-known/http-message-signatures-directory 公开验签公钥（keys），用于校验爬虫 / Agent 的 HTTP 消息签名。仅发布公钥。',
  acp: 'ACP（Agent 商务协议）发现：在 /.well-known/acp.json 声明 protocol.name 与 api_base_url，用于 Agent 下单 / 支付。',
  mpp: 'MPP 支付发现：在 /openapi.json 中包含 x-payment-info 扩展，声明支付能力。',
  ucp: 'UCP 发现：在 /.well-known/ucp 声明 protocol_version 与 services，用于统一商务协议。',
  x402: 'x402 支付协议：需存在返回 HTTP 402 且带支付要求的路由；无法被动探测（探测会触发扣费），需人工核验。',
  ap2: 'AP2 支付扩展：应为 A2A Agent Card 内的 AP2 扩展项；需人工确认卡片声明了 AP2 的 uri 与 params.roles。',
  dnsAid: 'DNS-AID（_agents SVCB）：通过 DNS 的 _agents 命名空间发布 SVCB / HTTPS 记录用于 Agent 发现，属实验性特性。',
  webMcp: 'WebMCP（navigator.modelContext）：需在真实浏览器中运行 navigator.modelContext.registerTool() 才能检测，HTTP 层不可见，需人工核验。',
};

export interface FormatOptions { zh?: boolean; color?: boolean; }

export function formatHuman(report: AuditReport, opts: FormatOptions = {}): string {
  const zh = opts.zh === true;
  const paint = makePaint(opts.color === true);
  const gc = GRADE_COLOR[report.grade] ?? '37';
  const c = report.counts;
  const failedTxt = report.failed > 0 ? paint('1;31', String(report.failed)) : paint('32', '0');

  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${paint('1', 'Agent-readiness audit')} ${paint('2', '—')} ${paint('1;34', report.target)}`);
  lines.push(`  ${paint('2', RULE)}`);
  lines.push(`  ${paint('1', 'Score')} ${paint(gc, String(report.score).padStart(3))}${paint('2', '/100')}   ${paint('2', '[')}${scoreBar(report.score, paint, gc)}${paint('2', ']')}   ${paint('1', 'Grade')} ${paint(gc, report.grade)}`);
  lines.push(`  ${paint('2', 'failing checks:')} ${failedTxt}`);
  if (zh) lines.push(`  ${paint('2', '评分:')} ${paint(gc, `${report.score}/100`)} ${paint('2', `(等级 ${report.grade})   失败检查项:`)} ${failedTxt}`);
  lines.push('');

  const sorted = [...report.results].sort(
    (a, b) => (ORDER[a.status] - ORDER[b.status]) || a.cat.localeCompare(b.cat));

  for (const r of sorted as AuditItem[]) {
    const badge = BADGE[r.status];
    lines.push(`  ${paint(BADGE_COLOR[r.status], badge)}${' '.repeat(9 - badge.length)}${paint('2', pad(r.cat, 13))}${paint('1', r.title)}`);
    const d = r.detail as Record<string, any>;
    const dc = r.status === 'fail' ? '31' : '2';
    for (const p of (d.problems ?? []) as string[]) lines.push(`        ${paint(dc, `- ${p}`)}`);
    if (Array.isArray(d.missing) && d.missing.length) lines.push(`        ${paint(dc, `- missing headers: ${d.missing.join(', ')}`)}`);
    if (d.guidance) lines.push(`        ${paint(dc, `- ${d.guidance}`)}`);
    if (d.note) lines.push(`        ${paint(dc, `- ${d.note}`)}`);
    if (zh && ZH_NOTES[r.id]) lines.push(`        ${paint('2;36', `中文备注: ${ZH_NOTES[r.id]}`)}`);
  }

  lines.push('');
  lines.push(`  ${paint('2', RULE)}`);
  lines.push(`  ${paint('1', 'Summary')}   ${paint('32', `${c.pass} pass`)}  ${paint('1;31', `${c.fail} fail`)}  ${paint('33', `${c.warn} warn`)}  ${paint('36', `${c.manual} manual`)}  ${paint('2', `${c.skip} skip`)}`);
  if (zh) lines.push(`  ${paint('1', '汇总')}     ${paint('32', `${c.pass} 通过`)}  ${paint('1;31', `${c.fail} 失败`)}  ${paint('33', `${c.warn} 警告`)}  ${paint('36', `${c.manual} 人工核验`)}  ${paint('2', `${c.skip} 跳过`)}`);
  return lines.join('\n');
}

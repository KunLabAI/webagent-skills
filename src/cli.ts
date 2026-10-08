/*
 * web-agent
 * Copyright 2026 web-agent contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * CLI entry — `audit` and `install` subcommands. Hand-rolled flag parsing keeps
 * the package dependency-free.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditSite } from './audit.js';
import { DEFAULT_UA } from './http.js';
import { AGENT_DIRS, installSkill, PKG_ROOT, SKILL_NAME } from './install.js';
import { formatHuman } from './report.js';

const VALUE_FLAGS = new Set(['timeout', 'user-agent', 'category', 'doh', 'scope', 'agents', 'base']);

interface Parsed { pos: string[]; flags: Record<string, string | boolean>; }

function parseFlags(args: string[]): Parsed {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) { pos.push(arg); continue; }
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq > -1) { flags[body.slice(0, eq)] = body.slice(eq + 1); continue; }
    if (VALUE_FLAGS.has(body)) { i += 1; flags[body] = args[i] ?? ''; } else { flags[body] = true; }
  }
  return { pos, flags };
}

const str = (v: string | boolean | undefined, fallback = ''): string => (typeof v === 'string' && v ? v : fallback);

function readVersion(): string {
  try {
    return (JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const HELP = `web-agent — audit & harden any website for AI-agent readiness, SEO, and security.

Usage:
  war audit <url> [options]    Audit a live site (exit code 1 if a core check fails)
  war install [options]        Install the SKILL.md bundle into your coding agent(s)
  war help                     Show this help
  war --version                Show version

audit options:
  --json                       Machine-readable output
  --category <list>            Comma list: seo,ai,security,discovery,auth,agent,commerce,experimental
  --timeout <sec>              Per-request timeout (default 12)
  --user-agent <ua>            Override the User-Agent header
  --doh <url>                  DNS-over-HTTPS resolver for DNS-AID (disables fallback)
  --insecure                   Skip TLS verification (staging only)

install options:
  --scope <project|user>       Install scope (default project)
  --agents <list>              Comma list of: ${Object.keys(AGENT_DIRS).join(', ')} (default all)
  --base <dir>                 Override the base directory

Examples:
  npx web-agent audit https://example.com --json
  npx web-agent install --scope user --agents claude,cursor
`;

async function cmdAudit(args: string[]): Promise<void> {
  const { pos, flags } = parseFlags(args);
  const url = pos[0];
  if (!url) {
    console.error('error: audit requires a <url>.\n' + HELP);
    process.exitCode = 2;
    return;
  }
  const insecure = flags['insecure'] === true;
  if (insecure) {
    console.error('WARNING: TLS verification disabled (--insecure). Staging only - never use against production.');
  }
  const categoryArg = str(flags['category']);
  const categories = categoryArg
    ? new Set(categoryArg.split(',').map(s => s.trim()).filter(Boolean))
    : null;

  const report = await auditSite(url, {
    timeout: Number(flags['timeout'] ?? 12),
    userAgent: str(flags['user-agent'], DEFAULT_UA),
    insecure,
    categories,
    doh: str(flags['doh']) || undefined,
  });

  if (flags['json'] === true) console.log(JSON.stringify(report, null, 2));
  else console.log(formatHuman(report));
  process.exitCode = report.failed > 0 ? 1 : 0;
}

function cmdInstall(args: string[]): void {
  const { flags } = parseFlags(args);
  const scope = flags['scope'] === 'user' ? 'user' : 'project';
  const agentsArg = str(flags['agents'], Object.keys(AGENT_DIRS).join(','));
  const agents = agentsArg.split(',').map(s => s.trim()).filter(Boolean);
  const base = str(flags['base']) || undefined;

  const res = installSkill({ scope, agents, base });
  console.log(`Installed '${SKILL_NAME}' (scope=${scope}) into base: ${res.base}`);
  for (const dir of res.installed) console.log(`  installed -> ${dir}`);
  for (const name of res.skipped) console.log(`  skip: unknown agent '${name}'`);
  console.log('Reload your agent if it caches skills (Claude Code: /reload-skills).');
}

export async function run(argv: string[]): Promise<void> {
  const cmd = argv[0] ?? 'help';
  const rest = argv.slice(1);
  if (cmd === 'audit') return cmdAudit(rest);
  if (cmd === 'install') { cmdInstall(rest); return; }
  if (cmd === '--version' || cmd === '-v') { console.log(readVersion()); return; }
  console.log(HELP);
  const known = ['help', '--help', '-h'];
  if (!known.includes(cmd)) process.exitCode = 1;
}

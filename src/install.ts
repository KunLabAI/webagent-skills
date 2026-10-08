/**
 * Skill installer — copies SKILL.md + references/ into each target agent's skills
 * directory. Replaces the former shell/PowerShell installers with one Node CLI.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'webagent-skills';

// dist/install.js -> package root (holds SKILL.md + references/).
export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** agent key -> skills directory (relative to base). */
export const AGENT_DIRS: Record<string, string> = {
  claude: '.claude/skills',
  cursor: '.cursor/skills',
  agents: '.agents/skills',
  codex: '.codex/skills',
  qoder: '.qoder/skills',
};

export interface InstallOptions {
  scope: 'project' | 'user';
  agents: string[];
  base?: string;
}

export interface InstallResult {
  base: string;
  installed: string[];
  skipped: string[];
}

function gitRoot(start: string): string | null {
  try {
    return execFileSync('git', ['-C', start, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function installSkill(opts: InstallOptions): InstallResult {
  const base = opts.base
    ?? (opts.scope === 'user' ? homedir() : (gitRoot(process.cwd()) ?? process.cwd()));

  const installed: string[] = [];
  const skipped: string[] = [];

  for (const agent of opts.agents) {
    const rel = AGENT_DIRS[agent];
    if (!rel) { skipped.push(agent); continue; }

    const dest = join(base, rel, SKILL_NAME);
    mkdirSync(dest, { recursive: true });
    cpSync(join(PKG_ROOT, 'SKILL.md'), join(dest, 'SKILL.md'));

    const refsSrc = join(PKG_ROOT, 'references');
    const refsDest = join(dest, 'references');
    if (existsSync(refsSrc)) {
      rmSync(refsDest, { recursive: true, force: true });
      cpSync(refsSrc, refsDest, { recursive: true });
    }
    installed.push(dest);
  }

  return { base, installed, skipped };
}

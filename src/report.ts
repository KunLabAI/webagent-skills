/**
 * Human-readable report formatting. JSON output is handled by the CLI directly.
 */
import type { AuditItem, AuditReport } from './audit.js';
import type { Status } from './checks.js';

const ICON: Record<Status, string> = {
  pass: '[PASS]', fail: '[FAIL]', warn: '[WARN]', skip: '[SKIP]', manual: '[MANUAL]',
};
const ORDER: Record<Status, number> = { fail: 0, warn: 1, manual: 2, skip: 3, pass: 4 };

const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - s.length));

export function formatHuman(report: AuditReport): string {
  const lines: string[] = [
    '',
    `Agent-readiness audit — ${report.target}`,
    '='.repeat(24 + report.target.length),
    `Score: ${report.score}/100 (grade ${report.grade})   failing checks: ${report.failed}`,
    '',
  ];

  const sorted = [...report.results].sort(
    (a, b) => (ORDER[a.status] - ORDER[b.status]) || a.cat.localeCompare(b.cat));

  for (const r of sorted as AuditItem[]) {
    lines.push(`${pad(ICON[r.status], 9)} ${pad(r.cat, 12)} ${r.title}`);
    const d = r.detail as Record<string, any>;
    for (const p of (d.problems ?? []) as string[]) lines.push(`            - ${p}`);
    if (Array.isArray(d.missing) && d.missing.length) lines.push(`            - missing headers: ${d.missing.join(', ')}`);
    if (d.guidance) lines.push(`            - ${d.guidance}`);
    if (d.note) lines.push(`            - ${d.note}`);
  }

  const c = report.counts;
  lines.push('', `Summary: ${c.pass} pass  ${c.fail} fail  ${c.warn} warn  ${c.manual} manual  ${c.skip} skip`);
  return lines.join('\n');
}

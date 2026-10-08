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
 * Audit engine — the reusable core. `auditSite(url, opts)` returns a structured
 * report; the CLI formats it, and any consumer can import it directly.
 */
import { DEFAULT_UA, makeFetcher, type Fetcher } from './http.js';
import {
  ABSENT_STATUS, buildChecks, evalHttp, probeManual,
  type Check, type CheckResult, type ProbeContext, type Severity, type Status,
} from './checks.js';

export interface AuditOptions {
  timeout?: number;          // seconds, per request (default 12)
  userAgent?: string;
  insecure?: boolean;        // skip TLS verification (staging only)
  categories?: Set<string> | null;
  doh?: string;              // DNS-over-HTTPS resolver override for DNS-AID
}

export interface AuditItem {
  id: string;
  title: string;
  cat: string;
  severity: Severity;
  status: Status;
  detail: Record<string, unknown>;
}

export interface AuditReport {
  target: string;
  score: number;             // 0..100, weighted; skip/manual excluded
  grade: string;             // A..F
  failed: number;            // count of `fail`
  counts: Record<Status, number>;
  results: AuditItem[];
}

/** Normalize a user-supplied URL to `scheme://host` (https assumed when missing). */
export function normalizeBase(url: string): string {
  const withScheme = url.includes('://') ? url : `https://${url}`;
  const parsed = new URL(withScheme);
  return `${parsed.protocol}//${parsed.host}`;
}

// Weight per severity, and how each status earns credit (-1 = excluded from scoring).
const WEIGHT: Record<Severity, number> = { core: 3, recommended: 2, optional: 1 };
const EARNED: Record<Status, number> = { pass: 1, warn: 0.5, fail: 0, skip: -1, manual: -1 };

const gradeFor = (score: number): string =>
  score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

async function runCheck(check: Check, base: string, fetcher: Fetcher, ctx: ProbeContext): Promise<CheckResult> {
  const mode = check.mode ?? 'http';
  if (mode === 'manual') return probeManual(check, base, fetcher, ctx);
  if (check.fn) return check.fn(check, base, fetcher, ctx);
  return evalHttp(check, base, fetcher);
}

export async function auditSite(url: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const base = normalizeBase(url);
  const fetcher = makeFetcher({
    timeout: opts.timeout ?? 12,
    userAgent: opts.userAgent ?? DEFAULT_UA,
    insecure: opts.insecure ?? false,
  });
  const ctx: ProbeContext = { doh: opts.doh };
  const cats = opts.categories ?? null;

  const results: AuditItem[] = [];
  for (const check of buildChecks()) {
    if (cats && !cats.has(check.cat)) continue;
    const outcome = await runCheck(check, base, fetcher, ctx);
    results.push({
      id: check.id, title: check.title, cat: check.cat,
      severity: check.severity, status: outcome.status, detail: outcome.detail,
    });
  }

  const counts: Record<Status, number> = { pass: 0, fail: 0, warn: 0, skip: 0, manual: 0 };
  for (const r of results) counts[r.status] += 1;

  let earned = 0;
  let possible = 0;
  for (const r of results) {
    const credit = EARNED[r.status];
    if (credit < 0) continue;                 // skip/manual are excluded from the score
    const weight = WEIGHT[r.severity] ?? 1;
    earned += credit * weight;
    possible += weight;
  }
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  return { target: base, score, grade: gradeFor(score), failed: counts.fail, counts, results };
}

export { buildChecks, ABSENT_STATUS };
export type { Check, CheckResult, Severity, Status, ProbeContext };

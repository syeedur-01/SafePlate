import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HealthRulesFileSchema,
  SafetyRulesFileSchema,
  type HealthRule,
  type SafetyRule,
} from '@sp/contracts';
import { getSources } from '@sp/knowledge';
import { mergeRules } from './merge-lib';

const knowledgeDataUrl = new URL('../../packages/knowledge/data/', import.meta.url);

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Returns parsed JSON from a path relative to packages/knowledge/data/, failing loudly when absent. */
function readJson(relativePath: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(fileURLToPath(new URL(relativePath, knowledgeDataUrl)), 'utf8');
  } catch {
    throw new Error(`missing file: ${relativePath} (${what})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`cannot parse ${what}: ${relativePath}`);
  }
}

function main(): void {
  const safetyProposals = SafetyRulesFileSchema.parse(
    readJson('proposals/safety-rules-proposals.json', 'safety rule proposals'),
  ).rules;
  const healthProposals = HealthRulesFileSchema.parse(
    readJson('proposals/health-rules-proposals.json', 'health rule proposals'),
  ).rules;
  const sourceIds = new Set(getSources().map((source) => source.id));

  const safety = mergeRules<SafetyRule>(safetyProposals, sourceIds);
  const health = mergeRules<HealthRule>(healthProposals, sourceIds);

  const rulesUrl = new URL('rules/', knowledgeDataUrl);
  mkdirSync(fileURLToPath(rulesUrl), { recursive: true });
  writeFileSync(
    fileURLToPath(new URL('safety-rules.json', rulesUrl)),
    `${JSON.stringify(SafetyRulesFileSchema.parse({ rules: safety }), null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    fileURLToPath(new URL('health-rules.json', rulesUrl)),
    `${JSON.stringify(HealthRulesFileSchema.parse({ rules: health }), null, 2)}\n`,
    'utf8',
  );

  const statusOf = (rules: Array<{ status: string }>): string => {
    const counts = new Map<string, number>();
    for (const rule of rules) counts.set(rule.status, (counts.get(rule.status) ?? 0) + 1);
    return [...counts].map(([status, count]) => `${status} ${count}`).join(', ');
  };
  writeln(
    `safety-rules.json: ${safety.length} rules (${statusOf(safety)}); ` +
      `health-rules.json: ${health.length} rules (${statusOf(health)})`,
  );
  writeln('done: packages/knowledge/data/rules/safety-rules.json, health-rules.json');
}

main();

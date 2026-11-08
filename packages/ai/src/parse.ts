import { ParseError } from './errors';

/** Returns the JSON object found in model text (handles code fences and prose around it). Throws ParseError. */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates = [];
  candidates.push(trimmed);
  const unfenced = trimmed.replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '');
  candidates.push(unfenced.trim());
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace)
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try the next extraction strategy
    }
  }
  throw new ParseError('no JSON object found in model output');
}

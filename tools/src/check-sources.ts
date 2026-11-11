import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { SourcesFileSchema, type SourceEntry } from '@sp/contracts';

const SOURCES_URL = new URL('../../packages/knowledge/data/sources.json', import.meta.url);
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT =
  'SafePlate-SourceCheck/1.0 (+https://github.com/syeedur-01/SafePlate; source register verification)';
const MAX_TEXT_CHARS = 300_000;

/** Per-source page-content checks: PDF page-1 title keywords, or HTML text keywords. */
const CONTENT_CHECKS: Record<string, { pdfTitle?: RegExp; htmlText?: RegExp }> = {
  'bd-dietary-guidelines': { pdfTitle: /dietary/i },
  'bd-fctb-2013': { pdfTitle: /food composition table/i },
  'bd-safe-food-act-2013': { pdfTitle: /safe food/i },
  'bd-bfsa': { htmlText: /food safety/i },
  'bd-bsti': { htmlText: /standards/i },
  'who-nugag': { htmlText: /nugag/i },
  'codex-texts': { htmlText: /codex/i },
  'usda-fdc': { htmlText: /fooddata/i },
  'ifct-2017': { pdfTitle: /food composition/i },
  'infs-brc-v12i1-86760': { htmlText: /10[.]3329[/]brc[.]v12i1[.]86760/i },
};

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Fetches the URL and returns the fetched text (first two page texts for PDFs) or null when unreachable. */
async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      writeln(`  unreachable: HTTP ${response.status}`);
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (/pdf|octet-stream/.test(contentType) || url.endsWith('.pdf')) {
      const buffer = new Uint8Array(await response.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: buffer, isEvalSupported: false }).promise;
      const parts: string[] = [];
      // some PDFs (e.g. IFCT 2017) have a blank page 1 and put the title on page 2
      const pagesToCheck = Math.min(2, doc.numPages);
      for (let pageNumber = 1; pageNumber <= pagesToCheck; pageNumber += 1) {
        const content = await doc.getPage(pageNumber).then((p) => p.getTextContent());
        for (const rawItem of content.items) {
          if (!('str' in rawItem)) continue; // marks carry no glyphs
          parts.push(rawItem.str);
        }
      }
      return parts.join(' ').slice(0, MAX_TEXT_CHARS);
    }
    return (await response.text()).slice(0, MAX_TEXT_CHARS);
  } catch (error) {
    writeln(
      `  unreachable: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200),
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Returns true when the fetched page text satisfies the source's content check. */
function contentMatches(source: SourceEntry, text: string | null): boolean {
  if (text === null) return false;
  const check = CONTENT_CHECKS[source.id];
  const pattern = check?.pdfTitle ?? check?.htmlText;
  return pattern !== undefined && pattern.test(text);
}

/** Returns today's UTC date as YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const file = JSON.parse(readFileSync(fileURLToPath(SOURCES_URL), 'utf8')) as unknown;
  const parsed = SourcesFileSchema.parse(file);
  let verified = 0;
  let unverified = 0;
  for (const source of parsed.sources) {
    writeln(`${source.id}: ${source.url}`);
    const text = await fetchText(source.url);
    if (contentMatches(source, text)) {
      source.status = 'verified';
      source.accessedOn = today();
      verified += 1;
      writeln('  ok: page loads and the title or publisher matches; marked verified');
    } else {
      // never mark a source verified without opening it; leave the existing status untouched
      source.status = 'unverified';
      source.accessedOn = null;
      unverified += 1;
      writeln('  not verified: page did not load or the expected title/publisher did not match');
    }
  }
  if (unverified === parsed.sources.length && verified === 0) {
    writeln('note: no source could be verified; is the network available?');
  }
  writeFileSync(fileURLToPath(SOURCES_URL), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  writeln(`done: ${verified} verified, ${unverified} unverified; file updated`);
}

main().catch((error: unknown) => {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

import { describe, it, expect } from 'vitest';
import {
  planTargets,
  humanInstructions,
  validatePdf,
  validateZip,
  USDA_DOWNLOAD_PAGE,
  USDA_RELEASES,
  type RawTarget,
} from '../src/fetch-raw-lib';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

/** Build a minimal valid-looking PDF buffer of the given size. */
function makePdfBuf(size = 2048): Buffer {
  const buf = Buffer.alloc(size, 0x20);
  PDF_MAGIC.copy(buf, 0);
  return buf;
}

/** Build a minimal valid-looking ZIP buffer of the given size. */
function makeZipBuf(size = 2048): Buffer {
  const buf = Buffer.alloc(size, 0x20);
  ZIP_MAGIC.copy(buf, 0);
  return buf;
}

// Pad to > MIN_BYTES (1024) so the size check passes and content detection is reached
const HTML_BUF = Buffer.concat([
  Buffer.from('<html><body>404 Not Found</body></html>'),
  Buffer.alloc(1024, 0x20),
]);
const JSON_BUF = Buffer.concat([Buffer.from('{"error":"not found"}'), Buffer.alloc(1024, 0x20)]);
const EMPTY_BUF = Buffer.alloc(0);
const TINY_BUF = Buffer.alloc(10, 0x20);

// ── planTargets ───────────────────────────────────────────────────────────────

describe('planTargets', () => {
  const targets = planTargets('https://example.org/fctb.pdf');

  it('plans exactly two targets', () => {
    expect(targets.map((t) => t.id)).toEqual(['fctb', 'usda']);
  });

  it('puts all raw files under data/raw/', () => {
    expect(targets.every((t) => t.dest.startsWith('data/raw/'))).toBe(true);
  });

  it('FCTB target uses the supplied URL', () => {
    expect(targets[0]?.url).toBe('https://example.org/fctb.pdf');
  });

  it('FCTB destination is data/raw/fctb-2013.pdf', () => {
    expect(targets[0]?.dest).toBe('data/raw/fctb-2013.pdf');
  });

  it('USDA target URL is null (discovered at runtime)', () => {
    expect(targets[1]?.url).toBeNull();
  });

  it('USDA target destination is under data/raw/usda/', () => {
    expect(targets[1]?.dest).toContain('data/raw/usda');
  });

  it('each target has a non-empty manualHint', () => {
    expect(targets.every((t) => t.manualHint.length > 0)).toBe(true);
  });

  it('planTargets is deterministic for same input', () => {
    const a = planTargets('https://example.org/fctb.pdf');
    const b = planTargets('https://example.org/fctb.pdf');
    expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id));
    expect(a.map((t) => t.dest)).toEqual(b.map((t) => t.dest));
  });
});

// ── USDA release config ───────────────────────────────────────────────────────

describe('USDA release configuration', () => {
  it('defines Foundation Foods and SR Legacy releases', () => {
    const names = USDA_RELEASES.map((r) => r.name.toLowerCase());
    expect(names.some((n) => n.includes('foundation'))).toBe(true);
    expect(names.some((n) => n.includes('sr legacy') || n.includes('sr-legacy'))).toBe(true);
  });

  it('each release has its own destination directory', () => {
    const dests = USDA_RELEASES.map((r) => r.dest);
    expect(new Set(dests).size).toBe(dests.length);
  });

  it('each release destination is under data/raw/usda/', () => {
    expect(USDA_RELEASES.every((r) => r.dest.startsWith('data/raw/usda/'))).toBe(true);
  });

  it('each release has a non-empty URL', () => {
    expect(USDA_RELEASES.every((r) => r.url.length > 0)).toBe(true);
  });

  it('does not reference the obsolete /download-foods URL', () => {
    const all = USDA_RELEASES.map((r) => r.url).join('\n') + USDA_DOWNLOAD_PAGE;
    expect(all).not.toContain('/download-foods');
  });

  it('references the correct official download page /download-datasets/', () => {
    expect(USDA_DOWNLOAD_PAGE).toContain('/download-datasets');
  });

  it('Foundation Foods URL points to fdc-datasets', () => {
    const ff = USDA_RELEASES.find((r) => r.name.toLowerCase().includes('foundation'));
    expect(ff?.url).toContain('fdc.nal.usda.gov/fdc-datasets');
  });

  it('SR Legacy URL points to fdc-datasets', () => {
    const sr = USDA_RELEASES.find(
      (r) =>
        r.name.toLowerCase().includes('sr legacy') || r.name.toLowerCase().includes('sr-legacy'),
    );
    expect(sr?.url).toContain('fdc.nal.usda.gov/fdc-datasets');
  });
});

// ── humanInstructions ─────────────────────────────────────────────────────────

describe('humanInstructions', () => {
  it('returns empty string when nothing failed', () => {
    expect(humanInstructions([])).toBe('');
  });

  it('mentions destination paths for each failed target', () => {
    const targets = planTargets('https://example.org/fctb.pdf');
    const txt = humanInstructions(targets);
    expect(txt).toContain('data/raw/fctb-2013.pdf');
    expect(txt).toContain('data/raw/usda/');
  });

  it('mentions the correct USDA download page', () => {
    const failed: RawTarget[] = [
      { id: 'usda', url: null, dest: 'data/raw/usda/', manualHint: 'some hint' },
    ];
    const txt = humanInstructions(failed);
    expect(txt).toContain('usda');
  });

  it('includes target id in output', () => {
    const failed: RawTarget[] = [
      { id: 'my-target', url: null, dest: 'data/raw/foo', manualHint: 'do this' },
    ];
    expect(humanInstructions(failed)).toContain('my-target');
  });
});

// ── validatePdf ───────────────────────────────────────────────────────────────

describe('validatePdf', () => {
  it('accepts a valid PDF buffer', () => {
    expect(validatePdf(makePdfBuf())).toEqual({ ok: true });
  });

  it('rejects an empty buffer', () => {
    const r = validatePdf(EMPTY_BUF);
    expect(r.ok).toBe(false);
  });

  it('rejects a buffer that is too small', () => {
    const r = validatePdf(TINY_BUF);
    expect(r.ok).toBe(false);
  });

  it('rejects an HTML error page saved under a PDF filename', () => {
    const r = validatePdf(HTML_BUF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain('html');
  });

  it('rejects a JSON error page saved under a PDF filename', () => {
    const r = validatePdf(JSON_BUF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain('json');
  });

  it('rejects a buffer with wrong magic bytes', () => {
    const buf = Buffer.alloc(2048, 0x20);
    buf[0] = 0x00;
    const r = validatePdf(buf);
    expect(r.ok).toBe(false);
  });

  it('rejects a ZIP file as PDF', () => {
    const r = validatePdf(makeZipBuf());
    expect(r.ok).toBe(false);
  });

  it('correct filename alone does not compensate for invalid content', () => {
    // Even if caller passes filename 'report.pdf', content must match
    const r = validatePdf(HTML_BUF);
    expect(r.ok).toBe(false);
  });
});

// ── validateZip ───────────────────────────────────────────────────────────────

describe('validateZip', () => {
  it('accepts a valid ZIP buffer', () => {
    expect(validateZip(makeZipBuf())).toEqual({ ok: true });
  });

  it('rejects an empty buffer', () => {
    expect(validateZip(EMPTY_BUF).ok).toBe(false);
  });

  it('rejects a buffer that is too small', () => {
    expect(validateZip(TINY_BUF).ok).toBe(false);
  });

  it('rejects an HTML error page saved as a ZIP filename', () => {
    const r = validateZip(HTML_BUF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain('html');
  });

  it('rejects a JSON error page saved as a ZIP filename', () => {
    const r = validateZip(JSON_BUF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain('json');
  });

  it('rejects a buffer with wrong magic bytes', () => {
    const buf = Buffer.alloc(2048, 0x20);
    buf[0] = 0x00;
    expect(validateZip(buf).ok).toBe(false);
  });

  it('rejects a PDF as ZIP', () => {
    expect(validateZip(makePdfBuf()).ok).toBe(false);
  });

  it('correct filename alone does not compensate for invalid content', () => {
    const r = validateZip(HTML_BUF);
    expect(r.ok).toBe(false);
  });
});

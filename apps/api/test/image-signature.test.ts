import { describe, it, expect } from 'vitest';
import { hasValidImageSignature } from '../src/image-signature';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x0c, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const riffOnly = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const b64 = (bytes: Buffer) => bytes.toString('base64') + 'A'.repeat(120);

describe('hasValidImageSignature', () => {
  it('accepts real JPEG, PNG and WebP bytes for their declared types', () => {
    expect(hasValidImageSignature('image/jpeg', b64(jpeg))).toBe(true);
    expect(hasValidImageSignature('image/png', b64(png))).toBe(true);
    expect(hasValidImageSignature('image/webp', b64(webp))).toBe(true);
  });
  it('rejects bytes that do not match the declared type', () => {
    expect(hasValidImageSignature('image/jpeg', b64(png))).toBe(false);
    expect(hasValidImageSignature('image/png', b64(jpeg))).toBe(false);
    expect(hasValidImageSignature('image/webp', b64(riffOnly))).toBe(false);
    expect(hasValidImageSignature('image/jpeg', b64(png.subarray(0, 2)))).toBe(false);
  });
  it('rejects undecodable base64 and unknown MIME types', () => {
    expect(hasValidImageSignature('image/jpeg', 'not base64!!!')).toBe(false);
    expect(hasValidImageSignature('image/gif', b64(jpeg))).toBe(false);
  });
  it('tolerates a data-URL prefix', () => {
    expect(hasValidImageSignature('image/jpeg', `data:image/jpeg;base64,${b64(jpeg)}`)).toBe(true);
  });
});

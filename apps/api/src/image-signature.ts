/**
 * Byte signatures for the allowed image types. The server checks the real bytes instead
 * of trusting the client-declared MIME type.
 */
const SIGNATURES: Array<{ mime: string; prefix: ArrayLike<number>; offset: number }> = [
  { mime: 'image/jpeg', prefix: [0xff, 0xd8, 0xff], offset: 0 },
  {
    mime: 'image/png',
    prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
  },
  { mime: 'image/webp', prefix: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
];

const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50]; // WEBP at offset 8 inside the RIFF container

/**
 * Returns true when the base64 image starts with the byte signature of the declared MIME
 * type. Undecodable or truncated data is rejected.
 */
export function hasValidImageSignature(mimeType: string, imageBase64: string): boolean {
  const match = SIGNATURES.find((signature) => signature.mime === mimeType);
  if (match === undefined) return false;
  let bytes: Uint8Array;
  try {
    bytes = base64Bytes(imageBase64, 16);
  } catch {
    return false;
  }
  if (bytes.length < match.offset + match.prefix.length) return false;
  if (mimeType === 'image/webp') {
    if (bytes.length < 12) return false;
    return startsWithAt(bytes, match.prefix, match.offset) && startsWithAt(bytes, WEBP_MARKER, 8);
  }
  return startsWithAt(bytes, match.prefix, match.offset);
}

/** Decodes the first `count` bytes of a base64 string (tolerating a data-URL prefix). */
function base64Bytes(imageBase64: string, count: number): Uint8Array {
  const raw = imageBase64.includes(',')
    ? imageBase64.slice(imageBase64.indexOf(',') + 1)
    : imageBase64;
  const decoded = atob(raw.slice(0, Math.ceil((count * 4) / 3) + 4));
  const bytes = new Uint8Array(Math.min(count, decoded.length));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

function startsWithAt(bytes: Uint8Array, prefix: ArrayLike<number>, offset: number): boolean {
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[offset + i] !== prefix[i]) return false;
  }
  return true;
}

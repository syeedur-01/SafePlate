import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/csv';
describe('toCsv', () => {
  it('writes a BOM, header and CRLF rows', () => {
    expect(toCsv([{ a: 1, b: 'x' }], ['a', 'b'])).toBe('\uFEFFa,b\r\n1,x\r\n');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv([{ a: 'x,y', b: 'say "hi"' }], ['a', 'b'])).toBe(
      '\uFEFFa,b\r\n"x,y","say ""hi"""\r\n',
    );
    expect(toCsv([{ a: 'l1\nl2' }], ['a'])).toBe('\uFEFFa\r\n"l1\nl2"\r\n');
  });
  it('writes null as empty and keeps Bangla intact', () => {
    expect(toCsv([{ a: null, b: 'ইলিশ' }], ['a', 'b'])).toBe('\uFEFFa,b\r\n,ইলিশ\r\n');
  });
});

import { describe, it, expect } from 'vitest';
import { parseModelJson } from '../src/parse';
import { ParseError } from '../src/errors';
describe('parseModelJson', () => {
  it('parses plain JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses fenced JSON', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('parses JSON surrounded by prose', () => {
    expect(parseModelJson('Here you go: {"a":{"b":2}} thanks')).toEqual({ a: { b: 2 } });
  });
  it('throws ParseError on garbage', () => {
    expect(() => parseModelJson('no json here')).toThrow(ParseError);
  });
});

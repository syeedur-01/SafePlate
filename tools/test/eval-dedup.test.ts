import { describe, it, expect } from 'vitest';
import { duplicateGroups, sha256Hex, splitLeaks } from '../src/eval-dedup';

const file = (path: string, hash: string) => ({ path, hash });

describe('sha256Hex', () => {
  it('hashes bytes deterministically', () => {
    expect(sha256Hex(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('duplicateGroups', () => {
  it('groups files that share a hash', () => {
    const groups = duplicateGroups([
      file('a.jpg', 'h1'),
      file('b.jpg', 'h2'),
      file('c.jpg', 'h1'),
      file('d.jpg', 'h1'),
    ]);
    expect(groups).toEqual([['a.jpg', 'c.jpg', 'd.jpg']]);
  });

  it('returns no groups when every hash is unique', () => {
    expect(duplicateGroups([file('a.jpg', 'h1'), file('b.jpg', 'h2')])).toEqual([]);
  });
});

describe('splitLeaks', () => {
  it('flags hashes that appear in both dev and holdout splits', () => {
    const leaks = splitLeaks(
      [
        file('dev/a.jpg', 'h1'),
        file('dev/b.jpg', 'h2'),
        file('holdout/c.jpg', 'h1'),
        file('holdout/d.jpg', 'h3'),
        file('unused/e.jpg', 'h1'),
      ],
      (p) => (p.startsWith('dev/') ? 'dev' : p.startsWith('holdout/') ? 'holdout' : 'unused'),
    );
    expect(leaks).toEqual([{ hash: 'h1', dev: ['dev/a.jpg'], holdout: ['holdout/c.jpg'] }]);
  });

  it('ignores duplicates that are confined to unused files', () => {
    const leaks = splitLeaks([file('dev/a.jpg', 'h1'), file('unused/b.jpg', 'h1')], (p) =>
      p.startsWith('dev/') ? 'dev' : 'unused',
    );
    expect(leaks).toEqual([]);
  });
});

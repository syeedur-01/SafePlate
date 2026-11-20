import '@testing-library/jest-dom/vitest';

// jsdom has no object-URL implementation; components only need a stable string.
URL.createObjectURL = () => 'blob:test';
URL.revokeObjectURL = () => {};

// Node 24 exposes an unusable experimental localStorage; give jsdom tests a small in-memory one.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

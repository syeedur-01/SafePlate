export const HISTORY_KEY = 'sp.history.v1';

export interface HistoryEntry {
  id: string;
  at: string;
  dishId: string | null;
  title: string;
  score: number;
  level: 'low' | 'moderate' | 'high';
  thumb: string | null;
}

export type HistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getDefaultStorage(): HistoryStorage | undefined {
  try {
    return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.at === 'string' &&
    (candidate.dishId === null || typeof candidate.dishId === 'string') &&
    typeof candidate.title === 'string' &&
    typeof candidate.score === 'number' &&
    (candidate.level === 'low' || candidate.level === 'moderate' || candidate.level === 'high') &&
    (candidate.thumb === null || typeof candidate.thumb === 'string')
  );
}

/** Returns a newest-first history store backed by localStorage or the supplied storage. */
export class HistoryStore {
  private readonly storage: HistoryStorage | undefined;
  private readonly max: number;

  constructor(storage?: HistoryStorage, max = 20) {
    this.storage = storage ?? getDefaultStorage();
    this.max = max;
  }

  /** Returns the stored entries newest first, dropping anything corrupt. */
  list(): HistoryEntry[] {
    const raw = this.storage?.getItem(HISTORY_KEY);
    if (raw === null || raw === undefined) {
      return [];
    }
    try {
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data)) {
        return [];
      }
      return data
        .filter(isEntry)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, this.max);
    } catch {
      return [];
    }
  }

  /** Returns nothing; adds an entry and keeps only the newest `max` entries. */
  add(entry: HistoryEntry): void {
    const entries = [entry, ...this.list()]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, this.max);
    this.storage?.setItem(HISTORY_KEY, JSON.stringify(entries));
  }

  /** Returns nothing; removes the whole history from the device. */
  clear(): void {
    this.storage?.removeItem(HISTORY_KEY);
  }
}

export const DEFAULT_HISTORY_STORE = new HistoryStore();

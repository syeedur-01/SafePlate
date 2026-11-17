const ERROR_KEYS: Record<string, string> = {
  rate_limited: 'error.daily_limit',
  ai_unavailable: 'error.unavailable',
  ai_invalid_output: 'error.unreadable',
  too_large: 'error.too_large',
  bad_request: 'error.bad_request',
};

/** Returns the UI message key for an API error code. */
export function errorKeyFor(code: string): string {
  return ERROR_KEYS[code] ?? 'error.generic';
}

export type ThemeChoice = 'light' | 'dark';

const THEME_KEY = 'safeplate.theme';

/** Returns the locally stored theme choice, or null when the OS preference decides. */
export function loadTheme(): ThemeChoice | null {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

/** Persists the theme choice on this device and applies it to the document. */
export function saveTheme(choice: ThemeChoice): void {
  localStorage.setItem(THEME_KEY, choice);
  applyTheme(choice);
}

/** Returns the theme currently in effect (explicit choice, else the OS preference). */
export function effectiveTheme(choice: ThemeChoice | null): ThemeChoice {
  if (choice !== null) {
    return choice;
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true ? 'dark' : 'light';
}

/** Applies a theme choice to the document root without touching any stored data. */
export function applyTheme(choice: ThemeChoice | null): void {
  if (choice === null) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }
}

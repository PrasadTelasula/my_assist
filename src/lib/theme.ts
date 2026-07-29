export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'my-assist-theme';

/**
 * Runs before first paint (inlined in <head>) so the initial frame already
 * carries the right theme — otherwise every load flashes the wrong one.
 * Falls back to the OS preference until the user makes an explicit choice.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / storage disabled: the choice just won't outlive the tab.
  }
}

'use client';

import { useEffect, useState } from 'react';

import { currentTheme, type Theme } from './theme';

/**
 * Tracks the active theme for components that can't be styled by tokens alone
 * (Monaco, canvases). Watches the root class so it stays right regardless of
 * who flipped it.
 */
export function useTheme(): Theme | null {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

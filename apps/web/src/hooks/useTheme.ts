import { useEffect, useState } from 'react';

export type ThemeOption = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'fittrack-theme';

/**
 * Manejo de tema visual (auto, claro, oscuro) guardado en localStorage
 * y aplicado mediante el atributo data-theme en el elemento <html>.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeOption>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
    return 'auto';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    const root = document.documentElement;
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeOption) => {
    setThemeState(newTheme);
  };

  return { theme, setTheme };
}

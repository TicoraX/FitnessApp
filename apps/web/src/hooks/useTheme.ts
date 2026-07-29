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

    if (theme !== 'auto') {
      root.setAttribute('data-theme', theme);
      return;
    }

    /**
     * En auto hay que resolver la preferencia del sistema acá y escribir el
     * atributo igual. Borrarlo no alcanza: tokens.css declara el tema oscuro
     * como `:root, [data-theme="dark"]` y no hay ningún bloque
     * prefers-color-scheme, así que sin atributo el resultado es oscuro
     * siempre y "auto" nunca daría claro.
     */
    const claro = window.matchMedia('(prefers-color-scheme: light)');
    const aplicar = () => root.setAttribute('data-theme', claro.matches ? 'light' : 'dark');

    aplicar();
    claro.addEventListener('change', aplicar);
    return () => claro.removeEventListener('change', aplicar);
  }, [theme]);

  const setTheme = (newTheme: ThemeOption) => {
    setThemeState(newTheme);
  };

  return { theme, setTheme };
}

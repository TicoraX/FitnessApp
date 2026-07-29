import { useEffect, useState } from 'react';

export type ViewRoute = 'diario' | 'recetas' | 'progreso' | 'perfil';

export interface ParsedRoute {
  view: ViewRoute;
  param?: string; // e.g. date 'YYYY-MM-DD' for #/diario/YYYY-MM-DD
}

function parseHash(hash: string): ParsedRoute {
  // Limpiar # y slashes iniciales
  const clean = hash.replace(/^#\/?/, '').trim();
  const parts = clean.split('/').filter(Boolean);

  const viewName = parts[0]?.toLowerCase();
  let view: ViewRoute = 'diario';
  if (viewName === 'recetas') view = 'recetas';
  else if (viewName === 'progreso') view = 'progreso';
  else if (viewName === 'perfil') view = 'perfil';
  else if (viewName === 'diario') view = 'diario';

  const param = parts[1];
  return { view, param };
}

/**
 * Hook ligero de enrutamiento por hash sin librerías de terceros.
 * Soporta #/diario, #/diario/YYYY-MM-DD, #/recetas, #/progreso, #/perfil.
 */
export function useHashRoute() {
  const [route, setRoute] = useState<ParsedRoute>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    const targetHash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
    if (window.location.hash === targetHash) {
      setRoute(parseHash(targetHash));
    } else {
      window.location.hash = targetHash;
    }
  };

  return { route, navigate };
}

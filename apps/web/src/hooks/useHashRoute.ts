import { useEffect, useState } from 'react';

export type ViewRoute = 'diario' | 'recetas' | 'progreso' | 'perfil' | 'reset';

export interface ParsedRoute {
  view: ViewRoute;
  param?: string; // e.g. date 'YYYY-MM-DD' for #/diario/YYYY-MM-DD or token for #/reset?token=...
}

function parseHash(hash: string): ParsedRoute {
  // Limpiar # y slashes iniciales
  const clean = hash.replace(/^#\/?/, '').trim();
  const [pathPart, queryPart] = clean.split('?');
  const parts = pathPart.split('/').filter(Boolean);

  const viewName = parts[0]?.toLowerCase();
  let view: ViewRoute = 'diario';
  if (viewName === 'recetas') view = 'recetas';
  else if (viewName === 'progreso') view = 'progreso';
  else if (viewName === 'perfil') view = 'perfil';
  else if (viewName === 'reset') view = 'reset';
  else if (viewName === 'diario') view = 'diario';

  let param: string | undefined = parts[1];
  if (!param && queryPart) {
    const params = new URLSearchParams(queryPart);
    const token = params.get('token');
    if (token) param = token;
  }
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

import { useCallback, useSyncExternalStore } from 'react';

export type ViewRoute = 'diario' | 'ejercicio' | 'recetas' | 'progreso' | 'perfil' | 'reset';

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
  if (viewName === 'ejercicio') view = 'ejercicio';
  else if (viewName === 'recetas') view = 'recetas';
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

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function getSnapshot() {
  return window.location.hash;
}

function setHash(path: string) {
  const targetHash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
}

/**
 * Hook ligero de enrutamiento por hash usando useSyncExternalStore nativo.
 */
export function useHashRoute() {
  const hash = useSyncExternalStore(subscribeHash, getSnapshot, () => '#/diario');
  const route = parseHash(hash);

  const navigate = useCallback((path: string) => {
    setHash(path);
  }, []);

  return { route, navigate };
}

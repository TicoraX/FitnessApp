import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api, escucharCambios, setToken, today, type DaySummary } from './api';
import Dock, { type DockItemData } from './components/Dock';
import { useHashRoute } from './hooks/useHashRoute';
import { DiarioView } from './views/DiarioView';
import { teclaModificadora } from './hooks/useTeclaModificadora';

const EjercicioView = lazy(() => import('./views/EjercicioView').then((m) => ({ default: m.EjercicioView })));
const RecetasView = lazy(() => import('./views/RecetasView').then((m) => ({ default: m.RecetasView })));
const ProgresoView = lazy(() => import('./views/ProgresoView').then((m) => ({ default: m.ProgresoView })));
const PerfilView = lazy(() => import('./views/PerfilView').then((m) => ({ default: m.PerfilView })));
const ResetPasswordView = lazy(() => import('./views/ResetPasswordView').then((m) => ({ default: m.ResetPasswordView })));

const VIEW_INDEX: Record<string, number> = {
  diario: 0,
  ejercicio: 1,
  recetas: 2,
  progreso: 3,
  perfil: 4,
};

/**
 * Sin blur a propósito: al terminar la transición el elemento queda con
 * `filter: blur(0px)`, y un filtro no vacío convierte al contenedor en el
 * bloque de referencia de todo `position: fixed` que haya adentro. Con eso, una
 * modal de pantalla completa se recorta al alto de la vista y sus botones
 * quedan fuera de pantalla si la vista es corta. El desplazamiento y el fade
 * dan la misma sensación y no rompen nada.
 */
const pageVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.28,
      ease: [0.25, 1, 0.5, 1] as const,
    },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -30 : 30,
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.5, 0, 0.75, 0] as const,
    },
  }),
};

export function Diary({ onLogout }: { onLogout: () => void }) {
  const { route, navigate } = useHashRoute();
  const initialDate = route.view === 'diario' && route.param && /^\d{4}-\d{2}-\d{2}$/.test(route.param)
    ? route.param
    : today();

  const [date, setDateState] = useState(initialDate);
  const [day, setDay] = useState<DaySummary | null>(null);
  const [error, setError] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentIndex = VIEW_INDEX[route.view] ?? 0;
  const prevIndexRef = useRef(currentIndex);
  const direction = currentIndex >= prevIndexRef.current ? 1 : -1;

  useEffect(() => {
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Sincronizar fecha en la URL hash (#/diario/2026-07-28)
  const setDate = (newDate: string) => {
    setDateState(newDate);
    navigate(`diario/${newDate}`);
  };

  // Si la URL cambia externamente (ej: botón atrás/adelante en el navegador)
  useEffect(() => {
    if (route.view === 'diario' && route.param && /^\d{4}-\d{2}-\d{2}$/.test(route.param)) {
      if (route.param !== date) {
        setDateState(route.param);
      }
    }
  }, [route, date]);

  const load = useCallback(async (d: string) => {
    try {
      setError('');
      setDay((await api.get<{ data: DaySummary }>(`/logs/${d}`)).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el día');
    }
  }, []);

  /**
   * Recarga también al volver de otra vista, no solo al cambiar de día: el
   * ejercicio se registra en #/ejercicio y devuelve margen, así que el anillo
   * llegaría desactualizado. El aviso por BroadcastChannel no sirve para esto,
   * que solo cruza pestañas y no llega al que lo emitió.
   */
  useEffect(() => {
    if (route.view !== 'diario') return;
    void load(date);
  }, [date, load, route.view]);

  /**
   * Una sola vez por sesión: si la cuenta es de invitado no cambia sola, y lo
   * único que sale de acá es ese cartel. Pedirlo en cada vuelta al diario era
   * un round trip por navegación para una respuesta siempre igual.
   */
  useEffect(() => {
    api.get<{ data: { is_guest: boolean } }>('/profile')
      .then((res) => setIsGuest(Boolean(res.data.is_guest)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return escucharCambios((tipo) => {
      if (tipo === 'diario-cambiado') void load(date);
      if (tipo === 'sesion-cerrada') onLogout();
    });
  }, [date, load, onLogout]);

  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          navigate(`diario/${date}`);
        } else if (e.key === '2') {
          e.preventDefault();
          navigate('ejercicio');
        } else if (e.key === '3') {
          e.preventDefault();
          navigate('recetas');
        } else if (e.key === '4') {
          e.preventDefault();
          navigate('progreso');
        } else if (e.key === '5') {
          e.preventDefault();
          navigate('perfil');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalHotkeys);
    return () => window.removeEventListener('keydown', handleGlobalHotkeys);
  }, [date, navigate]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimBusy(true);
    setClaimError('');
    try {
      const res = await api.post<{ data: { token: string } }>('/auth/claim', {
        email: claimEmail,
        password: claimPassword,
      });
      setToken(res.data.token);
      setIsGuest(false);
      setShowClaimModal(false);
      void load(date);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Error al guardar la cuenta');
    } finally {
      setClaimBusy(false);
    }
  };

  const dockItems: DockItemData[] = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      label: 'Diario (Alt+1)',
      onClick: () => navigate(`diario/${date}`),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      label: `Buscar (${teclaModificadora()}K)`,
      onClick: () => {
        navigate(`diario/${date}`);
        setTimeout(() => searchInputRef.current?.focus(), 80);
      },
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 12h10M6.5 7.5v9M17.5 7.5v9M3 10v4M21 10v4" />
        </svg>
      ),
      label: 'Ejercicio (Alt+2)',
      onClick: () => navigate('ejercicio'),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 2v7a2 2 0 002 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6a2 2 0 002 2h3zm0 0v7" />
        </svg>
      ),
      label: 'Recetas (Alt+3)',
      onClick: () => navigate('recetas'),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      label: 'Progreso (Alt+4)',
      onClick: () => navigate('progreso'),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      label: 'Perfil (Alt+5)',
      onClick: () => navigate('perfil'),
    },
  ];

  return (
    <div className="shell" style={{ paddingBottom: '6rem' }}>
      <header className="topbar">
        <span className="topbar__mark">FitTrack</span>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button type="button" className="btn btn--quiet" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      {error && (
        <p className="alert" role="alert" style={{ marginBottom: 'var(--space-md)' }}>
          {error}
        </p>
      )}

      {/* Transición animada direccional entre apartados */}
      <main className="view-container" style={{ position: 'relative', width: '100%', minHeight: '60vh' }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={route.view}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ width: '100%' }}
          >
            <Suspense fallback={null}>
              {route.view === 'diario' && (
                <DiarioView
                  date={date}
                  setDate={setDate}
                  day={day}
                  loadDate={load}
                  searchInputRef={searchInputRef}
                />
              )}

              {route.view === 'ejercicio' && <EjercicioView fechaInicial={route.param ?? date} />}

              {route.view === 'recetas' && <RecetasView />}

              {route.view === 'progreso' && <ProgresoView onGoalChanged={() => load(date)} />}

              {route.view === 'reset' && (
                <ResetPasswordView token={route.param} onSuccess={() => navigate('diario')} />
              )}

              {route.view === 'perfil' && (
                <PerfilView
                  isGuest={isGuest}
                  showClaimModal={showClaimModal}
                  setShowClaimModal={setShowClaimModal}
                  claimEmail={claimEmail}
                  setClaimEmail={setClaimEmail}
                  claimPassword={claimPassword}
                  setClaimPassword={setClaimPassword}
                  claimError={claimError}
                  claimBusy={claimBusy}
                  handleClaim={handleClaim}
                  onSaved={() => load(date)}
                  onLogout={onLogout}
                />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <Dock items={dockItems} />
    </div>
  );
}

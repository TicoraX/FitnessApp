import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api, escucharCambios, setToken, today, type DaySummary } from './api';
import Dock, { type DockItemData } from './components/Dock';
import { useHashRoute } from './hooks/useHashRoute';
import { Profile } from './Profile';
import { DiarioView } from './views/DiarioView';

const RecetasView = lazy(() => import('./views/RecetasView').then((m) => ({ default: m.RecetasView })));
const ProgresoView = lazy(() => import('./views/ProgresoView').then((m) => ({ default: m.ProgresoView })));
const PerfilView = lazy(() => import('./views/PerfilView').then((m) => ({ default: m.PerfilView })));
const ResetPasswordView = lazy(() => import('./views/ResetPasswordView').then((m) => ({ default: m.ResetPasswordView })));

const VIEW_INDEX: Record<string, number> = {
  diario: 0,
  recetas: 1,
  progreso: 2,
  perfil: 3,
};

const pageVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 30 : -30,
    opacity: 0,
    filter: 'blur(3px)',
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.28,
      ease: [0.25, 1, 0.5, 1] as const,
    },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -30 : 30,
    opacity: 0,
    filter: 'blur(3px)',
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
  const [showProfile, setShowProfile] = useState(false);
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

  useEffect(() => {
    void load(date);
    api.get<{ data: { is_guest: boolean } }>('/profile')
      .then((res) => setIsGuest(Boolean(res.data.is_guest)))
      .catch(() => {});
  }, [date, load]);

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
          navigate('recetas');
        } else if (e.key === '3') {
          e.preventDefault();
          navigate('progreso');
        } else if (e.key === '4') {
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
      label: 'Buscar (⌘K)',
      onClick: () => {
        navigate(`diario/${date}`);
        setTimeout(() => searchInputRef.current?.focus(), 80);
      },
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
      label: 'Recetas (Alt+2)',
      onClick: () => navigate('recetas'),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      label: 'Progreso (Alt+3)',
      onClick: () => navigate('progreso'),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      label: 'Perfil (Alt+4)',
      onClick: () => navigate('perfil'),
    },
  ];

  return (
    <div className="shell" style={{ paddingBottom: '6rem' }}>
      <header className="topbar">
        <span className="topbar__mark">FitTrack</span>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button type="button" className="btn btn--quiet" onClick={() => setShowProfile(true)}>
            Perfil
          </button>
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

      {showProfile && (
        <section className="card" aria-labelledby="perfil" style={{ marginBottom: 'var(--space-xl)' }}>
          <h2 id="perfil" className="card__title">
            Perfil y objetivo
          </h2>
          <Profile onSaved={() => load(date)} onClose={() => setShowProfile(false)} />
        </section>
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

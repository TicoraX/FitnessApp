import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { escucharCambios, getToken, notificarCambio, setToken, setUnauthorizedHandler } from './api';
import { Auth } from './Auth';
import { Diary } from './Diary';
import './app.css';

function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  useEffect(() => {
    // Un 401 en cualquier llamada vuelve al login en vez de dejar la app
    // trabada con un banner de error.
    setUnauthorizedHandler(() => setAuthed(false));

    // Si otra pestaña cierra sesión, esta la sigue. `storage` cubre el caso de
    // navegadores sin BroadcastChannel y el de borrar el token a mano.
    const dejarDeEscuchar = escucharCambios((tipo) => {
      if (tipo === 'sesion-cerrada') setAuthed(false);
    });
    const alCambiarStorage = () => setAuthed(Boolean(getToken()));
    window.addEventListener('storage', alCambiarStorage);

    return () => {
      dejarDeEscuchar();
      window.removeEventListener('storage', alCambiarStorage);
    };
  }, []);

  return authed ? (
    <Diary
      onLogout={() => {
        setToken(null);
        notificarCambio('sesion-cerrada');
        setAuthed(false);
      }}
    />
  ) : (
    <Auth onAuthed={() => setAuthed(true)} />
  );
}

if ('serviceWorker' in navigator && (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD) {
  window.addEventListener('load', () => {
    // La version viaja en la query: cambia con cada build y con eso el service
    // worker estrena cache y borra el del deploy anterior.
    navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`).catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

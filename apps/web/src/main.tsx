import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getToken, setToken } from './api';
import { Auth } from './Auth';
import { Diary } from './Diary';
import './app.css';

function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  return authed ? (
    <Diary
      onLogout={() => {
        setToken(null);
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

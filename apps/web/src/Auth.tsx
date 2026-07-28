import { useState, type FormEvent } from 'react';
import { api, setToken, today } from './api';

type AuthResponse = { data: { token: string } };

const ACTIVITY = [
  [1.2, 'Sedentario'],
  [1.375, 'Ligeramente activo'],
  [1.55, 'Moderadamente activo'],
  [1.725, 'Muy activo'],
  [1.9, 'Atleta'],
] as const;

export function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'guest'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const raw = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const payload =
        mode === 'login'
          ? { email: raw.email, password: raw.password }
          : {
              ...raw,
              // Día local: el servidor no conoce la zona del cliente.
              logged_on: today(),
              height_cm: Number(raw.height_cm),
              current_weight_kg: Number(raw.current_weight_kg),
              target_weight_kg: Number(raw.target_weight_kg),
              activity_level: Number(raw.activity_level),
              weekly_goal_kg: Number(raw.weekly_goal_kg),
            };
      const res = await api.post<AuthResponse>(`/auth/${mode}`, payload);
      setToken(res.data.token);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar');
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth__aside">
        <p className="eyebrow">FitTrack</p>
        <div>
          <p className="formula">
            Tu gasto diario sale de tu <b>peso</b>, tu <b>altura</b>, tu <b>edad</b> y cuánto te{' '}
            <b>movés</b>. Mifflin-St Jeor para el metabolismo basal, factor de actividad para el
            total.
          </p>
          <p className="muted" style={{ marginTop: 'var(--space-lg)' }}>
            Al registrarte calculamos tu BMR, tu TDEE y el reparto de macros, y los guardamos como
            tu objetivo activo.
          </p>
        </div>
        <p className="muted">Seguimiento nutricional con cálculo metabólico.</p>
      </aside>

      <div className="auth__form">
        <h1>
          {mode === 'login'
            ? 'Entrar'
            : mode === 'register'
              ? 'Crear cuenta'
              : 'Probar sin cuenta'}
        </h1>
        <p className="muted" style={{ marginTop: 'var(--space-xs)' }}>
          {mode === 'login'
            ? 'Seguí donde dejaste el diario.'
            : mode === 'register'
              ? 'Son unos pocos datos, una sola vez.'
              : 'Entrá al instante sin email. Podrás guardar tus datos después.'}
        </p>

        <form onSubmit={submit} style={{ marginTop: 'var(--space-xl)' }}>
          {mode !== 'guest' && (
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
          )}

          {mode !== 'guest' && (
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={mode === 'register' ? 10 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {mode === 'register' && (
                <span className="muted">Mínimo 10 caracteres, con mayúscula, minúscula y número.</span>
              )}
            </div>
          )}

          {mode !== 'login' && (
            <>
              <div className="field">
                <label htmlFor="first_name">Nombre</label>
                <input
                  id="first_name"
                  name="first_name"
                  required={mode === 'register'}
                  maxLength={100}
                  placeholder={mode === 'guest' ? 'Invitado (opcional)' : undefined}
                />
              </div>

              <div className="field">
                <label htmlFor="dob">Fecha de nacimiento</label>
                <input id="dob" name="dob" type="date" required max="2015-01-01" />
              </div>

              <div className="field">
                <label htmlFor="gender">Sexo biológico</label>
                <select id="gender" name="gender" required defaultValue="male">
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
                <span className="muted">Define la constante de la ecuación de Mifflin-St Jeor.</span>
              </div>

              <div className="field">
                <label htmlFor="height_cm">Altura (cm)</label>
                <input id="height_cm" name="height_cm" type="number" step="0.5" min={80} max={260} required />
              </div>

              <div className="field">
                <label htmlFor="current_weight_kg">Peso actual (kg)</label>
                <input
                  id="current_weight_kg"
                  name="current_weight_kg"
                  type="number"
                  step="0.1"
                  min={25}
                  max={500}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="target_weight_kg">Peso objetivo (kg)</label>
                <input
                  id="target_weight_kg"
                  name="target_weight_kg"
                  type="number"
                  step="0.1"
                  min={25}
                  max={500}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="activity_level">Nivel de actividad</label>
                <select id="activity_level" name="activity_level" defaultValue="1.55">
                  {ACTIVITY.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="weekly_goal_kg">Cambio semanal (kg)</label>
                <input
                  id="weekly_goal_kg"
                  name="weekly_goal_kg"
                  type="number"
                  step="0.1"
                  min={-1}
                  max={1}
                  defaultValue={-0.5}
                  required
                />
                <span className="muted">Negativo para bajar, positivo para subir.</span>
              </div>
            </>
          )}

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}

          <div className="stack">
            <button
              className="btn btn--block"
              type="submit"
              disabled={busy}
              data-state={busy ? 'loading' : undefined}
            >
              {busy
                ? 'Enviando'
                : mode === 'login'
                  ? 'Entrar'
                  : mode === 'register'
                    ? 'Crear cuenta'
                    : 'Entrar como invitado'}
            </button>

            {mode === 'login' && (
              <>
                <button
                  className="btn btn--quiet btn--block"
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                >
                  No tengo cuenta
                </button>
                <button
                  className="btn btn--quiet btn--block"
                  type="button"
                  onClick={() => {
                    setMode('guest');
                    setError('');
                  }}
                >
                  Probar sin cuenta
                </button>
              </>
            )}

            {mode !== 'login' && (
              <button
                className="btn btn--quiet btn--block"
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Ya tengo cuenta
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

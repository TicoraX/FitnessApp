import { useState, type FormEvent } from 'react';
import { api, setToken } from './api';

type AuthResponse = { data: { token: string } };

const ACTIVITY = [
  [1.2, 'Sedentario'],
  [1.375, 'Ligeramente activo'],
  [1.55, 'Moderadamente activo'],
  [1.725, 'Muy activo'],
  [1.9, 'Atleta'],
] as const;

export function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
    <div className="shell" style={{ maxWidth: '32rem' }}>
      <p className="eyebrow">FitTrack</p>
      <h1>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</h1>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        {mode === 'login'
          ? 'Seguí donde dejaste el diario.'
          : 'Calculamos tu BMR, tu TDEE y el reparto de macros al registrarte.'}
      </p>

      <form className="stack" onSubmit={submit} style={{ marginTop: '2rem' }}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>

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

        {mode === 'register' && (
          <>
            <div className="field">
              <label htmlFor="first_name">Nombre</label>
              <input id="first_name" name="first_name" required maxLength={100} />
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

        <button className="btn" type="submit" disabled={busy} data-state={busy ? 'loading' : undefined}>
          {busy ? 'Enviando' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <button
          className="btn btn--quiet"
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
        </button>
      </form>
    </div>
  );
}

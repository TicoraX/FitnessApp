import { useState, type FormEvent } from 'react';
import { api } from '../api';

export function ResetPasswordView({
  token,
  onSuccess,
}: {
  token?: string;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('El token de restablecimiento es inválido o no está presente.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view-reset stack" style={{ maxWidth: '440px', margin: '2rem auto' }}>
      <section className="card">
        <h2 className="card__title" style={{ marginBottom: '0.5rem' }}>
          Nueva Contraseña
        </h2>
        <p className="muted" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          Ingresá tu nueva clave para recuperar el acceso a tu cuenta.
        </p>

        {done ? (
          <div>
            <p className="alert alert--ok" style={{ marginBottom: '1.5rem' }}>
              ¡Tu contraseña se actualizó correctamente!
            </p>
            <button type="button" className="btn btn--block" onClick={onSuccess}>
              Iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <p className="alert" role="alert" style={{ marginBottom: '1rem' }}>
                {error}
              </p>
            )}

            <div className="field" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="reset-pass">Nueva Contraseña (mínimo 8 caracteres)</label>
              <input
                id="reset-pass"
                type="password"
                required
                minLength={8}
                maxLength={255}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn--block" disabled={busy}>
              {busy ? 'Guardando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

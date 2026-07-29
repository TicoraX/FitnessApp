import { Profile } from '../Profile';
import { useTheme, type ThemeOption } from '../hooks/useTheme';

export function PerfilView({
  isGuest,
  showClaimModal,
  setShowClaimModal,
  claimEmail,
  setClaimEmail,
  claimPassword,
  setClaimPassword,
  claimError,
  claimBusy,
  handleClaim,
  onSaved,
}: {
  isGuest: boolean;
  showClaimModal: boolean;
  setShowClaimModal: (v: boolean) => void;
  claimEmail: string;
  setClaimEmail: (v: string) => void;
  claimPassword: string;
  setClaimPassword: (v: string) => void;
  claimError: string;
  claimBusy: boolean;
  handleClaim: (e: React.FormEvent) => void;
  onSaved: () => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="view-perfil stack" style={{ gap: 'var(--space-lg)' }}>
      {isGuest && (
        <div
          className="alert alert--ok"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-xs)',
          }}
        >
          <span>
            Estás usando una <b>cuenta de invitado</b>. Agregá email y contraseña para no perder tus datos.
          </span>
          <button className="btn" onClick={() => setShowClaimModal(true)}>
            Guardar cuenta permanente
          </button>
        </div>
      )}

      {showClaimModal && (
        <section className="card">
          <h2 className="card__title">Guardar cuenta de invitado</h2>
          <p className="muted" style={{ marginBottom: 'var(--space-md)' }}>
            Ingresá tu correo y una contraseña para vincular tu historial actual a una cuenta registrada.
          </p>
          <form onSubmit={handleClaim} style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <div className="field">
              <label htmlFor="claim-email">Email</label>
              <input
                id="claim-email"
                type="email"
                required
                value={claimEmail}
                onChange={(e) => setClaimEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="claim-password">Contraseña</label>
              <input
                id="claim-password"
                type="password"
                required
                minLength={10}
                value={claimPassword}
                onChange={(e) => setClaimPassword(e.target.value)}
              />
              <span className="muted">Mínimo 10 caracteres, con mayúscula, minúscula y número.</span>
            </div>
            {claimError && (
              <p className="alert" role="alert">
                {claimError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              <button className="btn" type="submit" disabled={claimBusy}>
                {claimBusy ? 'Guardando' : 'Guardar cuenta'}
              </button>
              <button
                className="btn btn--quiet"
                type="button"
                onClick={() => setShowClaimModal(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Selector de tema claro / oscuro / auto */}
      <section className="card">
        <h2 className="card__title">Apariencia y Tema</h2>
        <p className="muted" style={{ marginBottom: 'var(--space-md)' }}>
          Elegí cómo se ve la aplicación en este dispositivo.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          {(['auto', 'dark', 'light'] as ThemeOption[]).map((t) => {
            const label = t === 'auto' ? 'Sistema' : t === 'dark' ? 'Oscuro' : 'Claro';
            const isSelected = theme === t;
            return (
              <button
                key={t}
                type="button"
                className={isSelected ? 'btn' : 'btn btn--quiet'}
                onClick={() => setTheme(t)}
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isSelected ? 700 : 500,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card" aria-labelledby="perfil">
        <h2 id="perfil" className="card__title">
          Perfil y objetivo
        </h2>
        <Profile onSaved={onSaved} onClose={() => {}} />
      </section>
    </div>
  );
}

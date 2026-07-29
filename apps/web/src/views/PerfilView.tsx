import { useState } from 'react';
import { api, setToken, today } from '../api';
import { useTheme, type ThemeOption } from '../hooks/useTheme';
import { Profile } from '../Profile';

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
  onLogout,
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
  onLogout?: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [exporting, setExporting] = useState(false);

  // Modal para eliminar cuenta
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleExportData = async () => {
    try {
      setExporting(true);
      const res = await api.get<Record<string, unknown>>('/account/export');
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fittrack-export-${today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudieron exportar los datos');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.trim() !== 'ELIMINAR') {
      setDeleteError('Tenés que escribir "ELIMINAR" en mayúsculas para confirmar.');
      return;
    }
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.del('/account', { password: deletePassword });
      setToken(null);
      if (onLogout) onLogout();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar la cuenta');
    } finally {
      setDeleteBusy(false);
    }
  };

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

      {/* Datos Personales y Objetivos */}
      <section className="card" aria-labelledby="perfil">
        <h2 id="perfil" className="card__title">
          Perfil y objetivo
        </h2>
        <Profile onSaved={onSaved} onClose={() => {}} />
      </section>

      {/* Exportar e Importar Datos */}
      <section className="card">
        <h2 className="card__title">Exportación de Datos</h2>
        <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
          Descargá todo tu historial de peso, comidas y registros diarios en formato JSON portable.
        </p>
        <button type="button" className="btn btn--quiet" onClick={handleExportData} disabled={exporting}>
          {exporting ? 'Generando archivo...' : '📥 Descargar mis datos (JSON)'}
        </button>
      </section>

      {/* Zona de Peligro / Eliminar Cuenta */}
      <section className="card" style={{ borderColor: 'oklch(0.6 0.25 25 / 0.5)' }}>
        <h2 className="card__title" style={{ color: 'var(--color-danger)' }}>
          Zona de Peligro
        </h2>
        <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
          Eliminar tu cuenta borrará de forma permanente todo tu historial de pesajes, comidas y recetas. Esta acción no se puede deshacer.
        </p>
        <button type="button" className="btn" style={{ background: 'var(--color-danger)', border: 'none' }} onClick={() => setShowDeleteModal(true)}>
          🗑️ Eliminar cuenta permanente
        </button>
      </section>

      {/* Modal Confirmación de Eliminación de Cuenta */}
      {showDeleteModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onSubmit={handleDeleteAccount} className="card" style={{ width: '100%', maxWidth: '420px', border: '1px solid var(--color-danger)' }}>
            <h3 className="card__title" style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>
              Confirmar Eliminación Permanente
            </h3>
            <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Para confirmar que querés borrar tu cuenta por completo, escribí <strong>ELIMINAR</strong> a continuación.
            </p>

            {!isGuest && (
              <div className="field" style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="del-pass">Contraseña actual</label>
                <input
                  id="del-pass"
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              </div>
            )}

            <div className="field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="del-confirm">Escribí ELIMINAR</label>
              <input
                id="del-confirm"
                type="text"
                required
                placeholder="ELIMINAR"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>

            {deleteError && (
              <p className="alert" role="alert" style={{ marginBottom: '1rem' }}>
                {deleteError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" style={{ background: 'var(--color-danger)', border: 'none', flex: 1 }} disabled={deleteBusy}>
                {deleteBusy ? 'Eliminando...' : 'Sí, eliminar cuenta'}
              </button>
              <button type="button" className="btn btn--quiet" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

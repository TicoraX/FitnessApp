import { useEffect, useState } from 'react';
import { api, notificarCambio, setToken, today } from '../api';
import { useTheme, type ThemeOption } from '../hooks/useTheme';
import { Profile } from '../Profile';

const PRESETS = [
  { name: 'Alta Proteína', desc: 'Ganancia Muscular & Saciación', p: 40, c: 40, f: 20 },
  { name: 'Equilibrado', desc: 'Mantenimiento & Salud General', p: 30, c: 40, f: 30 },
  { name: 'Cetogénico / Low Carb', desc: 'Control de Insulina & Quema de Grasa', p: 30, c: 10, f: 60 },
  { name: 'Deportivo', desc: 'Resistencia & Rendimiento', p: 25, c: 55, f: 20 },
];

function MacroPresetCalculator() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cals, setCals] = useState(2000);
  const [userCals, setUserCals] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const res = await api.get<{ data: { daily_calories: number | null } }>('/profile');
        if (res.data && res.data.daily_calories) {
          setUserCals(res.data.daily_calories);
          setCals(res.data.daily_calories);
        }
      } catch {
        // Fallback default
      }
    }
    void loadUserProfile();
  }, []);

  const preset = PRESETS[selectedIdx];
  const proteinG = Math.round((cals * (preset.p / 100)) / 4);
  const carbsG = Math.round((cals * (preset.c / 100)) / 4);
  const fatG = Math.round((cals * (preset.f / 100)) / 9);

  const handleApplyStrategy = async () => {
    setSaving(true);
    setSavedMsg('');
    try {
      await api.patch('/profile', { daily_calories: cals });
      setUserCals(cals);
      setSavedMsg(`Estrategia "${preset.name}" (${cals} kcal/día) aplicada a tu perfil.`);
      notificarCambio('diario-cambiado');
    } catch {
      setSavedMsg('No se pudo guardar la estrategia.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div>
          <h2 className="card__title" style={{ margin: 0 }}>Estrategias Nutricionales & Macros</h2>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Ajustá y calculá las metas en gramos según tu objetivo de calorías diarias.
          </p>
        </div>
        {userCals && (
          <span className="badge" style={{ background: 'var(--color-primary-dim)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-glow)' }}>
            ✔ Sincronizado con tu perfil ({userCals} kcal)
          </span>
        )}
      </div>

      {savedMsg && (
        <p className="alert alert--ok" style={{ marginBottom: 'var(--space-md)', fontSize: '0.85rem' }} role="status">
          {savedMsg}
        </p>
      )}

      <div className="field" style={{ marginBottom: 'var(--space-md)' }}>
        <label htmlFor="preset-cals">Calorías Diarias Objetivo (kcal)</label>
        <input
          id="preset-cals"
          type="number"
          min={1000}
          max={6000}
          step={50}
          value={cals}
          onChange={(e) => setCals(Number(e.target.value))}
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {PRESETS.map((p, i) => {
          const isSel = i === selectedIdx;
          return (
            <button
              key={p.name}
              type="button"
              className={isSel ? 'btn' : 'btn btn--quiet'}
              onClick={() => setSelectedIdx(i)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.6rem 0.8rem',
                textAlign: 'left',
              }}
            >
              <strong style={{ fontSize: '0.85rem' }}>{p.name}</strong>
              <span style={{ fontSize: '0.68rem', opacity: isSel ? 0.9 : 0.6, marginTop: '0.15rem' }}>{p.desc}</span>
            </button>
          );
        })}
      </div>

      <div style={{ height: '10px', borderRadius: 'var(--radius-full)', display: 'flex', overflow: 'hidden', marginBottom: '1rem', background: 'var(--bg-elevated)' }}>
        <div style={{ width: `${preset.p}%`, background: 'var(--color-protein)', transition: 'width 300ms ease' }} title={`Proteína ${preset.p}%`} />
        <div style={{ width: `${preset.c}%`, background: 'var(--color-carbs)', transition: 'width 300ms ease' }} title={`Carbohidratos ${preset.c}%`} />
        <div style={{ width: `${preset.f}%`, background: 'var(--color-fats)', transition: 'width 300ms ease' }} title={`Grasas ${preset.f}%`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', marginBottom: '1rem' }} className="num">
        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <span className="eyebrow" style={{ color: 'var(--color-protein)', fontSize: '0.65rem', display: 'block' }}>Proteína ({preset.p}%)</span>
          <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{proteinG} g</strong>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <span className="eyebrow" style={{ color: 'var(--color-carbs)', fontSize: '0.65rem', display: 'block' }}>Carbos ({preset.c}%)</span>
          <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{carbsG} g</strong>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <span className="eyebrow" style={{ color: 'var(--color-fats)', fontSize: '0.65rem', display: 'block' }}>Grasas ({preset.f}%)</span>
          <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{fatG} g</strong>
        </div>
      </div>

      <button
        type="button"
        className="btn"
        onClick={handleApplyStrategy}
        disabled={saving}
        style={{ width: '100%' }}
      >
        {saving ? 'Guardando en perfil...' : `Guardar Estrategia "${preset.name}" en Mi Perfil`}
      </button>
    </section>
  );
}

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

  const [importStatus, setImportStatus] = useState('');

  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await api.get<Record<string, unknown>>('/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fittrack-datos-${today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al exportar los datos.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFoodsJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Procesando e importando alimentos...');
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const items = Array.isArray(raw) ? raw : (raw.foods || raw.data || []);
      let count = 0;
      for (const item of items) {
        if (item.name && (item.calories !== undefined || item.calories_100g !== undefined)) {
          try {
            await api.post('/foods', {
              name: String(item.name).trim(),
              brand: item.brand ? String(item.brand).trim() : null,
              serving_size_amount: Number(item.serving_size_amount || item.servingSizeAmount || 100),
              serving_size_unit: String(item.serving_size_unit || item.servingSizeUnit || 'g'),
              calories: Number(item.calories || item.calories_100g || 0),
              protein: Number(item.protein || item.protein_100g || 0),
              carbohydrates: Number(item.carbohydrates || item.carbs || item.carbohydrates_100g || 0),
              fat: Number(item.fat || item.fat_100g || 0),
              barcode: item.barcode ? String(item.barcode) : undefined,
            });
            count++;
          } catch {
            // Ignorar duplicados
          }
        }
      }
      setImportStatus(`¡Importación completa! Se agregaron ${count} alimentos/marcas a tu catálogo.`);
    } catch {
      setImportStatus('Error al procesar el archivo JSON. Asegurate de que sea un JSON válido con lista de alimentos.');
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
          <button type="button" className="btn" onClick={() => setShowClaimModal(true)}>
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

      {/* Estrategias de Macronutrientes */}
      <MacroPresetCalculator />

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
          {exporting ? (
            'Generando archivo...'
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Descargar mis datos (JSON)
            </span>
          )}
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Eliminar cuenta permanente
          </span>
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

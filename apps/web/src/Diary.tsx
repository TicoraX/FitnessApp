import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { api, escucharCambios, notificarCambio, setToken, today, type DaySummary, type Food } from './api';
import { Weight } from './Weight';
import { NewFood } from './NewFood';
import { Profile } from './Profile';
import Dock, { type DockItemData } from './components/Dock';
import Counter from './components/Counter';

const MEALS = [
  ['breakfast', 'Desayuno'],
  ['lunch', 'Almuerzo'],
  ['dinner', 'Cena'],
  ['snack', 'Snack'],
] as const;

function formatDateLabel(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const todayStr = today();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) return 'Hoy';
  if (dateStr === yesterdayStr) return 'Ayer';

  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  const formatted = target.toLocaleDateString('es-ES', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function getWeekDays(centerDateStr: string): Array<{ iso: string; dayName: string; dayNum: number; isToday: boolean; isFuture: boolean }> {
  const [y, m, d] = centerDateStr.split('-').map(Number);
  const center = new Date(y, m - 1, d);
  const todayStr = today();

  const result = [];
  for (let i = -3; i <= 3; i++) {
    const dt = new Date(center);
    dt.setDate(center.getDate() + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const dayName = dt.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3).toUpperCase();
    const dayNum = dt.getDate();
    result.push({
      iso,
      dayName,
      dayNum,
      isToday: iso === todayStr,
      isFuture: iso > todayStr,
    });
  }
  return result;
}

function CyberDayStrip({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const days = getWeekDays(date);

  return (
    <div
      className="cyber-day-strip"
      aria-label="Barra de calendario"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.4rem 0.6rem',
        marginBottom: '1.25rem',
        boxShadow: 'var(--shadow-card)',
        gap: '0.25rem',
      }}
    >
      <button
        type="button"
        className="btn btn--quiet"
        aria-label="Semana anterior"
        title="Semana anterior"
        style={{ padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}
        onClick={() => setDate(shiftDate(date, -7))}
      >
        ‹‹
      </button>

      <div style={{ display: 'flex', gap: '0.25rem', flex: 1, justifyContent: 'center', overflowX: 'auto' }}>
        {days.map((d) => {
          const isSelected = d.iso === date;
          return (
            <button
              key={d.iso}
              type="button"
              disabled={d.isFuture}
              onClick={() => setDate(d.iso)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem 0.5rem',
                minWidth: '42px',
                borderRadius: 'var(--radius-md)',
                background: isSelected ? 'oklch(0.82 0.22 145 / 0.15)' : 'transparent',
                color: isSelected ? 'var(--color-primary)' : d.isFuture ? 'var(--text-faint)' : 'var(--text-muted)',
                border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                fontWeight: isSelected ? 700 : 500,
                cursor: d.isFuture ? 'not-allowed' : 'pointer',
                opacity: d.isFuture ? 0.35 : 1,
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', opacity: isSelected ? 1 : 0.7 }}>
                {d.dayName}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                {d.dayNum}
              </span>
              {d.isToday && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    width: '12px',
                    height: '2px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary)',
                    boxShadow: '0 0 6px var(--color-primary)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn--quiet"
        aria-label="Semana siguiente"
        title="Semana siguiente"
        disabled={shiftDate(date, 7) > today()}
        style={{
          padding: '0.3rem 0.5rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          opacity: shiftDate(date, 7) > today() ? 0.3 : 1,
        }}
        onClick={() => setDate(shiftDate(date, 7))}
      >
        ››
      </button>
    </div>
  );
}

export function Diary({ onLogout }: { onLogout: () => void }) {
  const [date, setDate] = useState(today());
  const [day, setDay] = useState<DaySummary | null>(null);
  const [error, setError] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState('');

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
    // Otra pestaña tocó el diario, o esta volvió a primer plano tras un rato:
    // en los dos casos lo que hay en pantalla puede estar viejo.
    const dejarDeEscuchar = escucharCambios((tipo) => {
      if (tipo === 'diario-cambiado') void load(date);
    });
    const alVolver = () => document.visibilityState === 'visible' && void load(date);
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      dejarDeEscuchar();
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [date, load]);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setClaimBusy(true);
    setClaimError('');
    try {
      const res = await api.post<{ data: { token: string } }>('/auth/claim', {
        email: claimEmail,
        password: claimPassword,
      });
      if (res.data?.token) {
        setToken(res.data.token);
      }
      setIsGuest(false);
      setShowClaimModal(false);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'No se pudo vincular la cuenta');
    } finally {
      setClaimBusy(false);
    }
  }

  const dockItems: DockItemData[] = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      label: 'Diario',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      label: 'Agregar Comida',
      onClick: () => {
        const input = document.querySelector('input[type="search"]') as HTMLInputElement;
        input?.focus();
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
      ),
      label: 'Peso',
      onClick: () => {
        const el = document.getElementById('peso');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      label: 'Perfil',
      onClick: () => {
        setShowProfile((prev) => !prev);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
      label: 'Salir',
      onClick: onLogout,
    },
  ];

  return (
    <div className="shell" style={{ paddingBottom: '6rem' }}>
      <header className="topbar">
        <span className="topbar__mark">FitTrack</span>
        <div className="topbar__tools">
          {isGuest && (
            <button
              className="btn"
              style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-xs)' }}
              onClick={() => setShowClaimModal(true)}
            >
              Guardar cuenta
            </button>
          )}

          <div
            className="date-picker-capsule"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 4px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              className="btn btn--quiet"
              title="Día anterior"
              aria-label="Día anterior"
              style={{
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.85rem',
                lineHeight: 1,
                minHeight: 'auto',
              }}
              onClick={() => setDate((d) => shiftDate(d, -1))}
            >
              ‹
            </button>

            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  padding: '0 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatDateLabel(date)} ({date})
              </span>
              <input
                id="date"
                type="date"
                className="num"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%',
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn--quiet"
              title="Día siguiente"
              aria-label="Día siguiente"
              disabled={date >= today()}
              style={{
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.85rem',
                lineHeight: 1,
                minHeight: 'auto',
                opacity: date >= today() ? 0.3 : 1,
              }}
              onClick={() => setDate((d) => shiftDate(d, 1))}
            >
              ›
            </button>
          </div>
          <button
            className="btn btn--quiet"
            aria-expanded={showProfile}
            onClick={() => setShowProfile(!showProfile)}
          >
            Perfil
          </button>
          <button className="btn btn--quiet" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      {isGuest && (
        <div
          className="alert alert--ok"
          style={{
            marginBottom: 'var(--space-lg)',
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
        <section className="card" style={{ marginBottom: 'var(--space-xl)' }}>
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

      {error && (
        <p className="alert" role="alert">
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

      <CyberDayStrip date={date} setDate={setDate} />

      <div className="columns">
        <section aria-labelledby="resumen">
          <h2 id="resumen">Resumen</h2>
          {day ? (
            <>
              <div className="card card--raised" style={{ marginTop: 'var(--space-md)' }}>
                <Dial day={day} />
                <Macros day={day} />
                <Water date={date} day={day} onChanged={() => load(date)} />
              </div>
              <Meals day={day} onChanged={() => load(date)} />
            </>
          ) : (
            <p className="muted">Cargando el día.</p>
          )}
        </section>

        <section aria-labelledby="agregar">
          <h2 id="agregar">Agregar comida</h2>
          <div className="card" style={{ marginTop: 'var(--space-md)' }}>
            <AddFood date={date} onAdded={() => load(date)} />
          </div>
          <Weight onGoalChanged={() => load(date)} />
        </section>
      </div>

      <Dock items={dockItems} />
    </div>
  );
}

function Dial({ day }: { day: DaySummary }) {
  const { totals, remaining } = day;
  const goal = remaining ? totals.calories + remaining.calories : 0;
  const pct = goal > 0 ? Math.min((totals.calories / goal) * 100, 100) : 0;
  const over = remaining ? remaining.calories < 0 : false;

  return (
    <div className="dial">
      <div
        className="ring"
        role="meter"
        aria-label="Calorías del día"
        aria-valuenow={totals.calories}
        aria-valuemin={0}
        aria-valuemax={goal || undefined}
        style={
          { '--pct': pct, '--ring-color': over ? 'var(--color-danger)' : undefined } as CSSProperties
        }
      />
      <div className="dial__figures">
        <span className="calories__value num">
          <Counter value={totals.calories} fontSize={38} fontWeight={700} />
        </span>
        <span className="dial__unit">kcal consumidas{goal > 0 && ` de ${goal}`}</span>
        {remaining ? (
          <span className="dial__left num" data-over={over}>
            {over ? `${Math.abs(remaining.calories)} de más` : `${remaining.calories} restantes`}
          </span>
        ) : (
          <span className="dial__left muted">Sin objetivo activo</span>
        )}
      </div>
    </div>
  );
}

function Macros({ day }: { day: DaySummary }) {
  const { totals, remaining } = day;
  const macros = [
    { key: 'protein', label: 'Proteína', eaten: totals.protein_g, left: remaining?.protein_g },
    { key: 'carbs', label: 'Carbohidratos', eaten: totals.carbs_g, left: remaining?.carbs_g },
    { key: 'fat', label: 'Grasa', eaten: totals.fat_g, left: remaining?.fat_g },
  ];

  return (
    <div className="macros">
      {macros.map((m) => {
        const goal = m.left === undefined ? 0 : m.eaten + m.left;
        const pct = goal > 0 ? Math.min((m.eaten / goal) * 100, 100) : 0;
        const style = { '--macro-color': `var(--color-${m.key})` } as CSSProperties;
        return (
          <div className="macro" key={m.key} style={style}>
            <div className="macro__head">
              <span className="macro__name">
                <span className="macro__chip" />
                {m.label}
              </span>
              <span className="macro__value num">
                {m.eaten} g{goal > 0 && ` / ${Math.round(goal)} g`}
              </span>
            </div>
            <div
              className="macro__track"
              role="meter"
              aria-label={m.label}
              aria-valuenow={m.eaten}
              aria-valuemin={0}
              aria-valuemax={goal || undefined}
            >
              <div className="macro__fill" data-over={goal > 0 && m.eaten > goal} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Vasos de 250 ml: en el teléfono se suma tocando, no tipeando un número. */
const GLASS_ML = 250;

function Water({
  date,
  day,
  onChanged,
}: {
  date: string;
  day: DaySummary;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function set(ml: number) {
    setBusy(true);
    try {
      await api.patch(`/logs/${date}/water`, { water_ml: Math.max(0, ml) });
      notificarCambio('diario-cambiado');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="water">
      <span className="water__label muted">Agua</span>
      <span className="num water__value">
        {(day.water_ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L
      </span>
      <span className="water__buttons">
        <button
          className="btn btn--quiet btn--icon"
          onClick={() => set(day.water_ml - GLASS_ML)}
          disabled={busy || day.water_ml === 0}
          aria-label="Quitar un vaso de agua"
        >
          −
        </button>
        <button
          className="btn btn--quiet btn--icon"
          onClick={() => set(day.water_ml + GLASS_ML)}
          disabled={busy}
          aria-label="Agregar un vaso de agua"
        >
          +
        </button>
      </span>
    </div>
  );
}

function Meals({ day, onChanged }: { day: DaySummary; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="meals">
      {MEALS.map(([key, label]) => {
        const entries = day.entries.filter((e) => e.meal_type === key);
        // Sumar primero y redondear al final, igual que el total del día.
        const subtotal = Math.round(entries.reduce((sum, e) => sum + e.calories, 0));
        return (
          <div key={key} className="meal__card">
            <div className="meal__head">
              <p className="eyebrow">{label}</p>
              <span className="muted num">{subtotal > 0 ? `${subtotal} kcal` : '—'}</span>
            </div>
            {entries.length > 0 ? (
              <ul className="entries">
                {entries.map((e) => (
                  <Entry key={e.id} entry={e} busy={busy === e.id} onChanged={onChanged} setBusy={setBusy} />
                ))}
              </ul>
            ) : (
              <p className="meal__empty">Sin registros en este tiempo.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Fila de entrada. Las porciones se editan en el lugar y se confirman al salir
 * del campo o con Enter, no por tecla: una request por dígito es cara y el
 * teclado móvil dispara muchos eventos intermedios.
 */
function Entry({
  entry,
  busy,
  onChanged,
  setBusy,
}: {
  entry: DaySummary['entries'][number];
  busy: boolean;
  onChanged: () => void;
  setBusy: (id: string | null) => void;
}) {
  // Redondear a máximo 2 decimales limpios para evitar ruido de punto flotante (ej: 2.010000002 -> 2.01 o 1.00 -> 1)
  const formatVal = (v: number) => Number(Math.round(v * 100) / 100).toString();
  const [servings, setServings] = useState(formatVal(entry.servings_consumed));

  // Si el día se recarga por otro motivo, el input sigue al servidor.
  useEffect(() => setServings(formatVal(entry.servings_consumed)), [entry.servings_consumed]);

  async function commit() {
    const value = Math.round(Number(servings) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0 || value === entry.servings_consumed) {
      setServings(formatVal(entry.servings_consumed));
      return;
    }
    setBusy(entry.id);
    try {
      await api.patch(`/logs/meal/${entry.id}`, { servings_consumed: value });
      notificarCambio('diario-cambiado');
      onChanged();
    } catch {
      setServings(formatVal(entry.servings_consumed));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy(entry.id);
    try {
      await api.del(`/logs/meal/${entry.id}`);
      notificarCambio('diario-cambiado');
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="entry">
      <span className="entry__label">
        <span className="entry__name">{entry.food.name}</span>
        {entry.food.brand && <span className="muted"> · {entry.food.brand}</span>}
      </span>
      <span className="entry__right">
        <input
          type="number"
          className="num entry__servings"
          inputMode="decimal"
          step="0.25"
          min="0"
          value={servings}
          disabled={busy}
          aria-label={`Porciones de ${entry.food.name}`}
          onChange={(e) => setServings(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className="muted num entry__meta">
          × {entry.food.serving_size_amount}
          {entry.food.serving_size_unit} · {Math.round(entry.calories)} kcal
        </span>
        <button
          type="button"
          className="entry__delete"
          aria-label={`Quitar ${entry.food.name}`}
          disabled={busy}
          onClick={remove}
        >
          Quitar
        </button>
      </span>
    </li>
  );
}

function AddFood({ date, onAdded }: { date: string; onAdded: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [servings, setServings] = useState('1');
  const [unitMode, setUnitMode] = useState<string>('serving');
  const [qty, setQty] = useState('1');
  const [meal, setMeal] = useState<string>('breakfast');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [recent, setRecent] = useState<Food[]>([]);
  const [activo, setActivo] = useState(-1);

  // Con menos de dos letras la lista muestra los recientes; con más, la
  // búsqueda. Es la misma lista para el teclado y para el mouse.
  const visibles = query.trim().length < 2 ? recent : results;

  // La lista cambió: el índice viejo apuntaría a otro alimento.
  useEffect(() => setActivo(-1), [query, results, recent]);

  const loadRecent = useCallback(async () => {
    try {
      setRecent((await api.get<{ data: Food[] }>('/foods/recent')).data);
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // Una búsqueda por pausa de tecleo, no una por tecla.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await api.get<{ data: Food[] }>(`/foods/search?q=${encodeURIComponent(query)}`);
        setResults((prev) => {
          if (prev.length === 0 && res.data.length === 0) return prev;
          return res.data;
        });
      } catch {
        setResults((prev) => (prev.length === 0 ? prev : []));
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const handleSelectFood = (food: Food) => {
    setSelected(food);
    setUnitMode('serving');
    setQty('1');
    setServings('1');
  };

  async function add() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    const finalServings = Math.round(Number(servings) * 1000) / 1000;
    try {
      await api.post('/logs/meal', {
        log_date: date,
        meal_type: meal,
        food_item_id: selected.id,
        servings_consumed: finalServings,
      });
      setMessage({ text: `${selected.name} registrado.`, ok: true });
      setSelected(null);
      setQuery('');
      setServings('1');
      setQty('1');
      setUnitMode('serving');
      setResults([]);
      notificarCambio('diario-cambiado');
      onAdded();
      void loadRecent();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'No se pudo registrar', ok: false });
    }
    setBusy(false);
  }

  return (
    <div>
      {/* Selector de tiempo de comida destacado (Desayuno, Almuerzo, Cena, Snacks) */}
      <div
        className="meal-selector-strip"
        style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '3px',
          gap: '3px',
          marginBottom: 'var(--space-md)',
        }}
      >
        {MEALS.map(([key, label]) => {
          const isSelected = meal === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMeal(key)}
              style={{
                flex: 1,
                padding: '0.45rem 0.2rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: isSelected ? 700 : 500,
                borderRadius: 'var(--radius-sm)',
                background: isSelected ? 'var(--color-primary)' : 'transparent',
                color: isSelected ? 'oklch(0.12 0 0)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Patrón combobox de ARIA: el input conserva el foco y las flechas
          mueven un descendiente activo. Sin esto un lector de pantalla no
          anuncia que aparecieron resultados. */}
      <input
        type="search"
        placeholder="Buscar alimento"
        aria-label="Buscar alimento"
        role="combobox"
        aria-expanded={visibles.length > 0}
        aria-controls="resultados-busqueda"
        aria-autocomplete="list"
        aria-activedescendant={activo >= 0 ? `alimento-${visibles[activo].id}` : undefined}
        style={{ width: '100%' }}
        value={query}
        onChange={(e) => {
          // Solo al tipear: add() también limpia el query, y ahí la
          // confirmación tiene que quedar visible.
          setQuery(e.target.value);
          setMessage(null);
        }}
        onKeyDown={(e) => {
          if (visibles.length === 0) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault(); // si no, el cursor salta al principio o al final
            const paso = e.key === 'ArrowDown' ? 1 : -1;
            setActivo((i) => (i + paso + visibles.length) % visibles.length);
          } else if (e.key === 'Enter' && activo >= 0) {
            e.preventDefault();
            handleSelectFood(visibles[activo]);
          } else if (e.key === 'Escape') {
            setActivo(-1);
            setSelected(null);
          }
        }}
      />

      {/* Los resultados llegan tras una pausa de tecleo: sin esto el cambio es
          silencioso para quien no ve la pantalla. */}
      <p className="visually-hidden" role="status">
        {query.trim().length >= 2 &&
          (results.length > 0 ? `${results.length} resultados` : 'Sin resultados')}
      </p>

      {query.trim().length < 2 && (
        <p className="hint">
          {recent.length > 0
            ? 'Lo que registraste antes, o buscá con al menos dos letras.'
            : 'Escribí al menos dos letras. La búsqueda tolera errores de tipeo y no distingue acentos.'}
        </p>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <>
          <p className="hint">Sin resultados para “{query}”. Podés darlo de alta vos.</p>
          <NewFood
            key={query.trim()}
            name={query.trim()}
            onCreated={(food) => {
              handleSelectFood(food);
              setResults([food]);
              setMessage(null);
            }}
          />
        </>
      )}

      <ul className="results" id="resultados-busqueda" role="listbox" aria-label="Resultados">
        {visibles.map((f, i) => (
          // role="option" va en el elemento en sí: una opción no puede contener
          // un botón sin romper la semántica del listbox.
          <li
            key={f.id}
            id={`alimento-${f.id}`}
            role="option"
            className="result"
            aria-selected={selected?.id === f.id}
            data-activo={i === activo}
            onClick={() => handleSelectFood(f)}
          >
            <span>
              {f.name}
              {f.brand && <span className="muted"> · {f.brand}</span>}
            </span>
            <span className="muted num result__kcal">
              {f.calories} kcal / {f.serving_size_amount}
              {f.serving_size_unit}
            </span>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="food-preview" style={{ marginTop: 'var(--space-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-xs)' }}>
            <div>
              <strong style={{ fontSize: 'var(--text-base)', display: 'block', color: 'var(--text-main)' }}>{selected.name}</strong>
              {selected.brand && <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{selected.brand}</span>}
            </div>
            <span className="num" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(selected.calories * (Number(servings) || 1))} kcal
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: '2px' }} className="muted" htmlFor="unit-mode-select">
                Unidad de medida
              </label>
              <select
                id="unit-mode-select"
                value={unitMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  setUnitMode(mode);
                  if (mode === 'serving') {
                    setQty('1');
                    setServings('1');
                  } else if (mode === '100g') {
                    setQty('100');
                    setServings((100 / selected.serving_size_amount).toFixed(3));
                  } else if (mode === 'unit') {
                    setQty(String(selected.serving_size_amount));
                    setServings('1');
                  }
                }}
                aria-label="Unidad de medida"
                style={{ fontSize: 'var(--text-sm)', width: '100%', fontFamily: 'var(--font-mono)' }}
              >
                <option value="serving">1 porción ({selected.serving_size_amount} {selected.serving_size_unit})</option>
                {selected.serving_size_unit === 'g' || selected.serving_size_unit === 'ml' ? (
                  <>
                    <option value="100g">100 {selected.serving_size_unit}</option>
                    <option value="unit">1 {selected.serving_size_unit} (balanza)</option>
                  </>
                ) : null}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: '2px' }} className="muted" htmlFor="quantity-input">
                Cantidad ({unitMode === 'serving' ? 'porciones' : selected.serving_size_unit})
              </label>
              <input
                id="quantity-input"
                type="number"
                className="num"
                step={unitMode === 'serving' ? '0.25' : '1'}
                min="0"
                value={qty}
                onChange={(e) => {
                  const val = e.target.value;
                  setQty(val);
                  const numVal = Number(val);
                  if (unitMode === 'serving') {
                    setServings(val);
                  } else if (unitMode === '100g') {
                    setServings((numVal / selected.serving_size_amount).toFixed(3));
                  } else if (unitMode === 'unit') {
                    setServings((numVal / selected.serving_size_amount).toFixed(3));
                  }
                }}
                aria-label="Porciones"
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              />
            </div>
          </div>

          <div className="nutrition-preview" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-2xs)', textAlign: 'center', padding: '0.4rem 0', marginBottom: 'var(--space-sm)' }}>
            <div>
              <span className="muted" style={{ fontSize: '0.65rem', display: 'block', fontFamily: 'var(--font-mono)' }}>PRO</span>
              <strong className="num" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-protein)' }}>
                {(selected.protein * (Number(servings) || 1)).toFixed(1)}g
              </strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.65rem', display: 'block', fontFamily: 'var(--font-mono)' }}>CHO</span>
              <strong className="num" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-carbs)' }}>
                {(selected.carbohydrates * (Number(servings) || 1)).toFixed(1)}g
              </strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.65rem', display: 'block', fontFamily: 'var(--font-mono)' }}>FAT</span>
              <strong className="num" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fats)' }}>
                {(selected.fat * (Number(servings) || 1)).toFixed(1)}g
              </strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.65rem', display: 'block', fontFamily: 'var(--font-mono)' }}>FIB</span>
              <strong className="num" style={{ fontSize: 'var(--text-sm)' }}>
                {((selected.fiber || 0) * (Number(servings) || 1)).toFixed(1)}g
              </strong>
            </div>
          </div>

          <div className="addbar" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <select value={meal} onChange={(e) => setMeal(e.target.value)} aria-label="Comida">
              {MEALS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className="btn"
              onClick={add}
              disabled={busy || Number(servings) <= 0}
              data-state={busy ? 'loading' : undefined}
            >
              {busy ? 'Guardando' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={message.ok ? 'alert alert--ok' : 'alert'}
          role="status"
          style={{ marginTop: 'var(--space-md)' }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

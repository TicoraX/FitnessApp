import { useEffect, useState } from 'react';
import { api, notificarCambio, type DaySummary } from '../../api';

const formatEntryVal = (v: number) => Number(Math.round(v * 100) / 100).toString();

export function Entry({
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
  const [servings, setServings] = useState(() => formatEntryVal(entry.servings_consumed));
  const [expanded, setExpanded] = useState(false);
  /**
   * Revertir el número sin decir nada deja al usuario sin saber si se equivocó
   * él o si falló la red. El caso normal es el segundo y desde el teléfono es
   * frecuente.
   */
  const [error, setError] = useState('');

  useEffect(() => setServings(formatEntryVal(entry.servings_consumed)), [entry.servings_consumed]);

  const isRecipe = entry.kind === 'recipe';

  async function commit() {
    const value = Math.round(Number(servings) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0 || value === entry.servings_consumed) {
      setServings(formatEntryVal(entry.servings_consumed));
      return;
    }
    setBusy(entry.id);
    setError('');
    try {
      if (isRecipe) {
        await api.patch(`/logs/recipe/${entry.id}`, { servings: value });
      } else {
        await api.patch(`/logs/meal/${entry.id}`, { servings_consumed: value });
      }
      notificarCambio('diario-cambiado');
      onChanged();
    } catch (e) {
      setServings(formatEntryVal(entry.servings_consumed));
      setError(e instanceof Error ? e.message : 'No se pudo cambiar las porciones.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy(entry.id);
    setError('');
    try {
      if (isRecipe) {
        await api.del(`/logs/recipe/${entry.id}`);
      } else {
        await api.del(`/logs/meal/${entry.id}`);
      }
      notificarCambio('diario-cambiado');
      onChanged();
    } catch (e) {
      setServings(formatEntryVal(entry.servings_consumed));
      setError(e instanceof Error ? e.message : 'No se pudo quitar.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="entry" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span
          className="entry__label"
          style={{ cursor: isRecipe ? 'pointer' : 'default' }}
          role={isRecipe ? 'button' : undefined}
          tabIndex={isRecipe ? 0 : undefined}
          onClick={() => isRecipe && setExpanded(!expanded)}
          onKeyDown={(e) => {
            if (isRecipe && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setExpanded(!expanded);
            }
          }}
        >
          <span className="entry__name">
            {isRecipe && (expanded ? '▼ ' : '▶ ')}
            {entry.food.name}
          </span>
          {entry.food.brand && <span className="muted"> · {entry.food.brand}</span>}
          {isRecipe && <span className="badge" style={{ marginLeft: '6px', fontSize: '0.65rem' }}>Receta</span>}
          {entry.kind === 'quick' && <span className="badge" style={{ marginLeft: '6px', fontSize: '0.65rem' }}>Rápido</span>}
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
            {isRecipe
              ? `× porción · ${Math.round(entry.calories)} kcal`
              : entry.kind === 'quick'
              ? `× registro · ${Math.round(entry.calories)} kcal`
              : `× ${entry.food.serving_size_amount}${entry.food.serving_size_unit} · ${Math.round(entry.calories)} kcal`}
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
      </div>

      {error && (
        <p className="alert" role="alert" style={{ marginTop: 'var(--space-xs)' }}>
          {error}
        </p>
      )}

      {isRecipe && expanded && entry.components && entry.components.length > 0 && (
        <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border-subtle)', fontSize: '0.8rem' }} className="muted num">
          {entry.components.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>• {c.food.name}</span>
              <span>{Math.round(c.calories)} kcal</span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}


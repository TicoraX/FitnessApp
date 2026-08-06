import { useState, type CSSProperties } from 'react';
import { api, notificarCambio, type DaySummary } from '../../api';

const GLASS_ML = 250;

export function Water({
  date,
  day,
  onChanged,
}: {
  date: string;
  day: DaySummary;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function set(ml: number) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/logs/${date}/water`, { water_ml: Math.max(0, ml) });
      notificarCambio('diario-cambiado');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el consumo de agua');
    } finally {
      setBusy(false);
    }
  }

  const pct = day.water_goal_ml > 0 ? Math.min((day.water_ml / day.water_goal_ml) * 100, 100) : 0;

  return (
    <div className="water">
      <span className="water__label muted">Agua</span>
      <span className="num water__value">
        {(day.water_ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L
        <span className="muted water__goal">
          {' '}
          de {(day.water_goal_ml / 1000).toFixed(2).replace(/\.?0+$/, '')}
        </span>
        {/* La barra va acá y no en una tarjeta aparte: el vaso se suma con los
            botones de al lado y el progreso tiene que verse sin mover la vista. */}
        <span
          className="water__bar"
          role="meter"
          aria-label="Progreso de agua"
          aria-valuenow={day.water_ml}
          aria-valuemin={0}
          aria-valuemax={day.water_goal_ml}
        >
          <span
            className="water__bar-fill"
            style={
              {
                '--pct': pct,
              } as CSSProperties
            }
          />
        </span>
      </span>
      <span className="water__buttons">
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          onClick={() => set(day.water_ml - GLASS_ML)}
          disabled={busy || day.water_ml === 0}
          aria-label="Quitar un vaso de agua"
        >
          −
        </button>
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          onClick={() => set(day.water_ml + GLASS_ML)}
          disabled={busy}
          aria-label="Agregar un vaso de agua"
        >
          +
        </button>
      </span>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}


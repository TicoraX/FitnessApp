import { useEffect, useState } from 'react';
import { api, notificarCambio, type DaySummary, type Movement } from './api';

/**
 * Registro de fuerza del día: series, repeticiones y kilos.
 *
 * Va aparte del cardio porque no comparte la ecuación: el catálogo de
 * movimientos no trae MET, así que acá no hay calorías quemadas ni margen que
 * mover. Es historial de cargas.
 */
export function Strength({
  date,
  day,
  onChanged,
}: {
  date: string;
  day: DaySummary;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movement[]>([]);
  const [selected, setSelected] = useState<Movement | null>(null);
  const [series, setSeries] = useState('3');
  const [reps, setReps] = useState('10');
  const [kilos, setKilos] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ data: Movement[] }>(
          `/exercise/movements?q=${encodeURIComponent(query)}`,
        );
        // Sin este guard, la respuesta lenta de una búsqueda vieja pisa la nueva.
        if (vigente) setResults(r.data);
      } catch {
        // Sin red: la lista anterior sigue siendo lo mejor que hay.
      }
    }, 200);

    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [query]);

  const elegir = (m: Movement) => {
    setSelected(m);
    setQuery(m.name);
    setResults([]);
    setError('');
  };

  async function registrar() {
    const s = Number(series);
    const r = Number(reps);
    if (!selected) return setError('Elegí un movimiento del catálogo.');
    if (!Number.isInteger(s) || s < 1 || s > 50) return setError('Las series van de 1 a 50.');
    if (!Number.isInteger(r) || r < 1 || r > 500) return setError('Las repeticiones van de 1 a 500.');

    setBusy('add');
    setError('');
    try {
      await api.post('/logs/strength', {
        log_date: date,
        name: selected.name,
        sets: s,
        reps: r,
        ...(kilos ? { weight_kg: Number(kilos) } : {}),
      });
      notificarCambio('diario-cambiado');
      setQuery('');
      setSelected(null);
      setKilos('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar.');
    } finally {
      setBusy(null);
    }
  }

  async function borrar(id: string) {
    setBusy(id);
    try {
      await api.del(`/logs/strength/${id}`);
      notificarCambio('diario-cambiado');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    } finally {
      setBusy(null);
    }
  }

  const entries = day.strength;
  const volumen = entries.reduce((s, e) => s + e.sets * e.reps * (e.weight_kg ?? 0), 0);

  return (
    <div className="card exercise" style={{ marginTop: 'var(--space-md)' }}>
      <div className="exercise__head">
        <p className="eyebrow">Fuerza</p>
        <span className="muted num">{volumen > 0 ? `${Math.round(volumen)} kg de volumen` : '—'}</span>
      </div>

      {entries.length > 0 && (
        <ul className="entries">
          {entries.map((e) => (
            <li key={e.id} className="entry">
              <span className="entry__label">{e.name}</span>
              <span className="muted num">
                {e.sets} × {e.reps}
                {e.weight_kg !== null ? ` · ${e.weight_kg} kg` : ''}
              </span>
              <button
                type="button"
                className="btn btn--quiet"
                disabled={busy === e.id}
                onClick={() => borrar(e.id)}
                aria-label={`Quitar ${e.name}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="exercise__form">
        <div className="field">
          <label htmlFor="fz-movimiento">Movimiento</label>
          <input
            id="fz-movimiento"
            type="text"
            value={query}
            onChange={(ev) => {
              setQuery(ev.target.value);
              setSelected(null);
            }}
            placeholder="bench press, pecho, mancuerna..."
            autoComplete="off"
          />
        </div>

        {results.length > 0 && (
          <ul className="results" role="listbox" aria-label="Movimientos">
            {results.slice(0, 8).map((m) => (
              <li key={m.id} role="option" aria-selected={false} className="result" onClick={() => elegir(m)}>
                <span>{m.name}</span>
                <span className="muted result__kcal">{m.equipment} · {m.target}</span>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <details>
            <summary>Cómo se hace</summary>
            <p className="muted">{selected.howTo}</p>
          </details>
        )}

        <div className="exercise__row">
          <div className="field">
            <label htmlFor="fz-series">Series</label>
            <input
              id="fz-series"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={series}
              onChange={(ev) => setSeries(ev.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fz-reps">Repeticiones</label>
            <input
              id="fz-reps"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={reps}
              onChange={(ev) => setReps(ev.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fz-kilos">Kilos (opcional)</label>
            <input
              id="fz-kilos"
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              max={999}
              value={kilos}
              onChange={(ev) => setKilos(ev.target.value)}
              placeholder="Sin peso"
            />
          </div>
        </div>

        {error && (
          <p className="alert" role="status">
            {error}
          </p>
        )}

        <button type="button" className="btn" onClick={registrar} disabled={busy === 'add' || !selected}>
          {busy === 'add' ? 'Registrando...' : 'Registrar serie'}
        </button>
      </div>
    </div>
  );
}

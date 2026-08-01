import { useEffect, useState } from 'react';
import { api, notificarCambio, type Activity, type DaySummary } from './api';

/**
 * Registro de ejercicio del día.
 *
 * Las calorías las estima el API con el MET del catálogo y el último peso; el
 * campo de calorías queda para las actividades libres y para quien prefiera el
 * número de su reloj.
 */
export function Exercise({
  date,
  day,
  onChanged,
}: {
  date: string;
  day: DaySummary;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [libre, setLibre] = useState(false);
  const [minutos, setMinutos] = useState('30');
  const [kcal, setKcal] = useState('');
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
        const r = await api.get<{ data: Activity[] }>(
          `/exercise/search?q=${encodeURIComponent(query)}`,
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

  const elegir = (a: Activity) => {
    setSelected(a);
    setQuery(a.name);
    setResults([]);
    setLibre(false);
    setError('');
  };

  async function registrar() {
    const nombre = libre ? query.trim() : selected?.name;
    const min = Number(minutos);
    if (!nombre || nombre.length < 2) return setError('Elegí una actividad o escribí su nombre.');
    if (!Number.isInteger(min) || min < 1 || min > 1440) return setError('Los minutos van de 1 a 1440.');
    if (libre && !kcal) return setError('Una actividad fuera del catálogo necesita las calorías.');

    setBusy('add');
    setError('');
    try {
      await api.post('/logs/exercise', {
        log_date: date,
        name: nombre,
        duration_min: min,
        ...(kcal ? { calories_burned: Number(kcal) } : {}),
      });
      notificarCambio('diario-cambiado');
      setQuery('');
      setSelected(null);
      setLibre(false);
      setKcal('');
      setMinutos('30');
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
      await api.del(`/logs/exercise/${id}`);
      notificarCambio('diario-cambiado');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    } finally {
      setBusy(null);
    }
  }

  const { entries, total_burned } = day.exercise;

  return (
    <div className="card exercise cardio">
      <div className="exercise__head">
        <p className="eyebrow">Ejercicio</p>
        <span className="muted num">{total_burned > 0 ? `${total_burned} kcal` : '—'}</span>
      </div>

      {entries.length > 0 && (
        <ul className="entries">
          {entries.map((e) => (
            <li key={e.id} className="entry">
              <span className="entry__label">{e.name}</span>
              <span className="muted num">
                {e.duration_min} min · {e.calories_burned} kcal
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
          <label htmlFor="ex-actividad">Actividad</label>
          <input
            id="ex-actividad"
            type="text"
            value={query}
            onChange={(ev) => {
              setQuery(ev.target.value);
              setSelected(null);
            }}
            placeholder="Correr, pesas, fútbol..."
            autoComplete="off"
          />
        </div>

        {results.length > 0 && (
          <ul className="results" role="listbox" aria-label="Actividades">
            {results.slice(0, 8).map((a) => (
              <li key={a.name} role="option" aria-selected={false} className="result" onClick={() => elegir(a)}>
                <span>{a.name}</span>
                <span className="muted num result__kcal">{a.met} MET</span>
              </li>
            ))}
          </ul>
        )}

        {query.trim().length >= 2 && !selected && results.length === 0 && !libre && (
          <button type="button" className="btn btn--quiet" onClick={() => setLibre(true)}>
            Registrar "{query.trim()}" con mis calorías
          </button>
        )}

        <div className="exercise__row">
          <div className="field">
            <label htmlFor="ex-minutos">Minutos</label>
            <input
              id="ex-minutos"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              value={minutos}
              onChange={(ev) => setMinutos(ev.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ex-kcal">kcal {libre ? '' : '(opcional)'}</label>
            <input
              id="ex-kcal"
              type="number"
              inputMode="numeric"
              min={0}
              max={10000}
              value={kcal}
              onChange={(ev) => setKcal(ev.target.value)}
              placeholder={libre ? 'Requerido' : 'Se estima'}
            />
          </div>
        </div>

        {error && (
          <p className="alert" role="status">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn"
          onClick={registrar}
          disabled={busy === 'add' || (!selected && !libre)}
        >
          {busy === 'add' ? 'Registrando...' : 'Registrar ejercicio'}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  api,
  getCacheado,
  notificarCambio,
  type DaySummary,
  type Movement,
  type StrengthEntry,
  type StrengthHistory,
} from './api';
import { CampoEsfuerzo } from './components/CampoEsfuerzo';
import { NombreMovimiento } from './components/NombreMovimiento';
import { MediaMovimiento } from './components/MediaMovimiento';

type Facets = { body: string[]; equipment: string[] };

/**
 * Registro de fuerza del día: series, repeticiones y kilos.
 *
 * Va aparte del cardio porque no comparte la ecuación: el catálogo de
 * movimientos no trae MET, así que acá no hay calorías quemadas ni margen que
 * mover. Es historial de cargas.
 *
 * Una fila pendiente viene de una rutina cargada: sus números son el objetivo
 * del entreno. Se confirma con lo que salió de verdad, que rara vez es lo
 * planeado.
 */
export function Strength({
  date,
  day,
  onChanged,
  movimientoInicial,
  onMovimientoConsumido,
}: {
  date: string;
  day: DaySummary;
  onChanged: () => void;
  /** Un movimiento elegido desde el Catálogo, para arrancar el registro sin buscarlo de nuevo. */
  movimientoInicial?: Movement | null;
  onMovimientoConsumido?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [zona, setZona] = useState('');
  const [equipo, setEquipo] = useState('');
  const [facets, setFacets] = useState<Facets>({
    body: [],
    equipment: [],
  });
  const [results, setResults] = useState<Movement[]>([]);
  const [selected, setSelected] = useState<Movement | null>(null);
  const [historia, setHistoria] = useState<StrengthHistory | null>(null);
  const [series, setSeries] = useState('3');
  const [reps, setReps] = useState('10');
  const [kilos, setKilos] = useState('');
  const [esfuerzo, setEsfuerzo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Las zonas y equipos no cambian entre despliegues: una vez por sesión.
    getCacheado<{ data: Facets }>('/exercise/facets')
      .then((r) => setFacets(r.data))
      .catch(() => {
        // Sin chips se puede buscar igual escribiendo.
      });
  }, []);

  // Con un filtro puesto la lista se llena sola: explorar el catálogo es el
  // punto de las chips, y exigir además dos letras lo anularía.
  const hayFiltro = Boolean(zona || equipo);
  useEffect(() => {
    if (query.trim().length < 2 && !hayFiltro) {
      setResults([]);
      return;
    }
    let vigente = true;
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ q: query.trim(), limit: '24' });
      if (zona) params.set('body', zona);
      if (equipo) params.set('equipment', equipo);
      try {
        const r = await api.get<{ data: Movement[] }>(`/exercise/movements?${params}`);
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
  }, [query, zona, equipo, hayFiltro]);

  const elegir = async (m: Movement) => {
    setSelected(m);
    setQuery(m.name_es ?? m.name);
    setResults([]);
    setError('');
    setHistoria(null);
    try {
      const r = await api.get<{ data: StrengthHistory }>(
        `/logs/strength/history?name=${encodeURIComponent(m.name)}`,
      );
      setHistoria(r.data);
      // Arrancar donde quedó la última vez ahorra tres campos en el 90% de los casos.
      if (r.data.last) {
        setSeries(String(r.data.last.sets));
        setReps(String(r.data.last.reps));
        setKilos(r.data.last.weight_kg === null ? '' : String(r.data.last.weight_kg));
        setEsfuerzo(r.data.last.rpe === null ? '' : String(r.data.last.rpe));
      }
    } catch {
      // Un movimiento nuevo no tiene historia y eso no es un error.
    }
  };

  // Un movimiento llegado del Catálogo se elige una sola vez: sin el aviso al
  // padre, cada re-render con la misma prop lo volvería a seleccionar y
  // pisaría lo que el usuario ya haya tocado en el formulario.
  useEffect(() => {
    if (movimientoInicial) {
      void elegir(movimientoInicial);
      onMovimientoConsumido?.();
    }
  }, [movimientoInicial]);

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
        ...(esfuerzo ? { rpe: Number(esfuerzo) } : {}),
      });
      notificarCambio('diario-cambiado');
      setQuery('');
      setSelected(null);
      setHistoria(null);
      setKilos('');
      setEsfuerzo('');
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
  const hechas = entries.filter((e) => e.done);
  const pendientes = entries.filter((e) => !e.done);
  const volumen = hechas.reduce((s, e) => s + e.sets * e.reps * (e.weight_kg ?? 0), 0);

  return (
    <div className="card exercise fuerza">
      <div className="exercise__head">
        <p className="eyebrow">Fuerza</p>
        <span className="muted num">
          {volumen > 0 ? `${Math.round(volumen)} kg de volumen` : '—'}
        </span>
      </div>

      {pendientes.length > 0 && (
        <div className="stack" style={{ gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
          <p className="eyebrow muted">Del entreno de hoy ({pendientes.length} sin hacer)</p>
          {pendientes.map((e) => (
            <SeriePendiente
              key={e.id}
              entry={e}
              onDone={() => {
                notificarCambio('diario-cambiado');
                onChanged();
              }}
              onError={setError}
              onQuitar={() => borrar(e.id)}
            />
          ))}
        </div>
      )}

      {hechas.length > 0 && (
        <ul className="entries">
          {hechas.map((e) => (
            <li key={e.id} className="entry">
              <NombreMovimiento name={e.name} nameEs={e.name_es} className="entry__label" />
              <span className="muted num">
                {e.sets} × {e.reps}
                {e.weight_kg !== null ? ` · ${e.weight_kg} kg` : ''}
                {e.rpe !== null ? ` · RPE ${e.rpe}` : ''}
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
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
            <input
              id="fz-movimiento"
              type="text"
              value={query}
              onChange={(ev) => {
                setQuery(ev.target.value);
                setSelected(null);
                setHistoria(null);
              }}
              placeholder="bench press, pecho, mancuerna..."
              autoComplete="off"
              style={{ width: '100%', paddingRight: query ? '2.5rem' : undefined }}
            />
            {query && (
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => {
                  setQuery('');
                  setSelected(null);
                  setHistoria(null);
                  setResults([]);
                }}
                aria-label="Limpiar movimiento seleccionado"
                style={{
                  position: 'absolute',
                  right: '0.4rem',
                  padding: '0.25rem 0.5rem',
                  minHeight: '36px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <Chips
          label="Zona"
          valores={facets.body}
          activo={zona}
          onElegir={(v) => {
            setZona(v);
            setSelected(null);
            setQuery('');
            setHistoria(null);
          }}
        />
        {/* Las zonas son diez y entran a la vista; los equipos son 28 y en el
            teléfono empujan el formulario abajo del todo. */}
        <details className="chips-equipo">
          <summary>Equipo{equipo && `: ${equipo}`}</summary>
          <Chips
            label="Equipo"
            valores={facets.equipment}
            activo={equipo}
            onElegir={(v) => {
              setEquipo(v);
              setSelected(null);
              setQuery('');
              setHistoria(null);
            }}
          />
        </details>

        {results.length > 0 && (
          <ul className="results" role="listbox" aria-label="Movimientos">
            {results.map((m) => (
              <li
                key={m.id}
                role="option"
                aria-selected={false}
                className="result"
                onClick={() => void elegir(m)}
              >
                <NombreMovimiento name={m.name} nameEs={m.name_es} />
                <span className="muted result__kcal">
                  {m.equipment} · {m.target}
                </span>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {historia?.last
                ? `La última vez (${historia.last.log_date}): ${historia.last.sets} × ${historia.last.reps}${
                    historia.last.weight_kg !== null ? ` con ${historia.last.weight_kg} kg` : ''
                  }${historia.last.rpe !== null ? `, RPE ${historia.last.rpe}` : ''}`
                : 'Primera vez con este movimiento.'}
              {historia?.best?.weight_kg != null && ` · Récord: ${historia.best.weight_kg} kg`}
            </p>
            <details>
              <summary>Cómo se hace</summary>
              <p className="muted">{selected.howTo}</p>
              <MediaMovimiento name={selected.name} media={selected.media} />
            </details>
          </>
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
          <CampoEsfuerzo id="fz-esfuerzo" valor={esfuerzo} onCambio={setEsfuerzo} />
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

/**
 * Una serie del entreno todavía sin hacer. Los campos vienen con el objetivo
 * cargado y se corrigen con lo que salió: subir de peso o quedarse corto en
 * reps es la norma, no la excepción.
 */
function SeriePendiente({
  entry,
  onDone,
  onError,
  onQuitar,
}: {
  entry: StrengthEntry;
  onDone: () => void;
  onError: (m: string) => void;
  onQuitar: () => void;
}) {
  const [sets, setSets] = useState(String(entry.sets));
  const [reps, setReps] = useState(String(entry.reps));
  const [kilos, setKilos] = useState(entry.weight_kg === null ? '' : String(entry.weight_kg));
  const [esfuerzo, setEsfuerzo] = useState(entry.rpe === null ? '' : String(entry.rpe));
  const [busy, setBusy] = useState(false);

  async function confirmar() {
    setBusy(true);
    try {
      await api.patch(`/logs/strength/${entry.id}`, {
        sets: Number(sets),
        reps: Number(reps),
        ...(kilos ? { weight_kg: Number(kilos) } : {}),
        ...(esfuerzo ? { rpe: Number(esfuerzo) } : {}),
        done: true,
      });
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo confirmar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="serie-pendiente">
      <NombreMovimiento name={entry.name} nameEs={entry.name_es} className="entry__label" />
      <div className="serie-pendiente__campos">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          aria-label={`Series de ${entry.name}`}
        />
        <span aria-hidden="true">×</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          aria-label={`Repeticiones de ${entry.name}`}
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min={0}
          max={999}
          value={kilos}
          onChange={(e) => setKilos(e.target.value)}
          placeholder="kg"
          aria-label={`Kilos de ${entry.name}`}
        />
        <select
          value={esfuerzo}
          onChange={(e) => setEsfuerzo(e.target.value)}
          aria-label={`Esfuerzo de ${entry.name}`}
        >
          <option value="">RPE</option>
          {['10', '9.5', '9', '8.5', '8', '7.5', '7', '6', '5'].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="serie-pendiente__acciones">
        <button type="button" className="btn" disabled={busy} onClick={confirmar}>
          {busy ? '...' : 'Hecho'}
        </button>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={onQuitar}
          aria-label={`Quitar ${entry.name} del entreno`}
        >
          Quitar
        </button>
      </div>
    </div>
  );
}

/** Filtro de un solo valor: volver a tocar la chip activa lo saca. */
function Chips({
  label,
  valores,
  activo,
  onElegir,
}: {
  label: string;
  valores: string[];
  activo: string;
  onElegir: (v: string) => void;
}) {
  if (valores.length === 0) return null;
  return (
    <div className="chips" role="group" aria-label={label}>
      {valores.map((v) => (
        <button
          key={v}
          type="button"
          className="chip"
          aria-pressed={activo === v}
          onClick={() => onElegir(activo === v ? '' : v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api, notificarCambio, type Movement, type Routine, type RoutineItem } from './api';
import { useModalDialog } from './hooks/useModalDialog';
import { IconoCerrar } from './components/IconoCerrar';

/**
 * Organizador de rutinas: la plantilla de un entreno con sus objetivos.
 *
 * Cargarla en un día copia sus ítems como series pendientes; editar la rutina
 * después no reescribe lo que ya se entrenó, igual que con las recetas.
 */
export function Routines({ date, onLoaded }: { date: string; onLoaded: () => void }) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editando, setEditando] = useState<Routine | 'nueva' | null>(null);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ data: Routine[] }>('/routines');
      setRoutines(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las rutinas');
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cargarEnElDia(r: Routine) {
    setBusy(r.id);
    setError('');
    try {
      await api.post('/logs/routine', { log_date: date, routine_id: r.id });
      notificarCambio('diario-cambiado');
      setMessage(`"${r.name}" cargada: ${r.items.length} movimientos por hacer.`);
      onLoaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la rutina.');
    } finally {
      setBusy(null);
    }
  }

  async function borrar(r: Routine) {
    setConfirmandoBorrar(null);
    try {
      await api.del(`/routines/${r.id}`);
      setMessage(`Rutina "${r.name}" eliminada.`);
      void cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    }
  }

  return (
    <div className="card routines">
      <div className="exercise__head">
        <p className="eyebrow">Rutinas</p>
        <button type="button" className="btn btn--quiet" onClick={() => setEditando('nueva')}>
          Crear rutina
        </button>
      </div>

      {message && (
        <p className="alert alert--ok" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {routines.length === 0 ? (
        <p className="muted">
          Todavía no hay rutinas. Creá una con los movimientos de tu entreno y sus objetivos, y
          cargala en el día para ir tachando.
        </p>
      ) : (
        <ul className="entries">
          {routines.map((r) => (
            <li key={r.id} className="entry entry--rutina">
              <div>
                <span className="entry__label">{r.name}</span>
                <span className="muted" style={{ display: 'block', fontSize: 'var(--text-sm)' }}>
                  {r.items.length} movimientos
                  {r.notes ? ` · ${r.notes}` : ''}
                </span>
              </div>
              <div className="routines__acciones">
                <button
                  type="button"
                  className="btn"
                  disabled={busy === r.id}
                  onClick={() => cargarEnElDia(r)}
                >
                  {busy === r.id ? 'Cargando...' : 'Cargar en el día'}
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => setEditando(r)}>
                  Editar
                </button>
                {confirmandoBorrar === r.id ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'var(--color-danger)' }}
                      onClick={() => borrar(r)}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet"
                      onClick={() => setConfirmandoBorrar(null)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn--quiet"
                    aria-label={`Borrar la rutina ${r.name}`}
                    onClick={() => setConfirmandoBorrar(r.id)}
                  >
                    Borrar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <EditorDeRutina
          rutina={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardada={(nombre) => {
            setEditando(null);
            setMessage(`Rutina "${nombre}" guardada.`);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

function EditorDeRutina({
  rutina,
  onCerrar,
  onGuardada,
}: {
  rutina: Routine | null;
  onCerrar: () => void;
  onGuardada: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(rutina?.name ?? '');
  const [notas, setNotas] = useState(rutina?.notes ?? '');
  const [items, setItems] = useState<RoutineItem[]>(rutina?.items ?? []);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ref = useModalDialog<HTMLDivElement>(true, onCerrar);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ data: Movement[] }>(
          `/exercise/movements?q=${encodeURIComponent(query)}&limit=8`,
        );
        if (vigente) setResults(r.data);
      } catch {
        // La lista anterior sigue siendo lo mejor que hay.
      }
    }, 200);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [query]);

  const agregar = (m: Movement) => {
    setItems((prev) => [...prev, { name: m.name, sets: 3, reps: 10, weight_kg: null, rpe: null }]);
    setQuery('');
    setResults([]);
  };

  const cambiar = (i: number, campo: 'sets' | 'reps' | 'weight_kg' | 'rpe', valor: string) => {
    // sets y reps son obligatorios; kilos y esfuerzo pueden quedar sin poner.
    const opcional = campo === 'weight_kg' || campo === 'rpe';
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === i
          ? { ...it, [campo]: opcional ? (valor ? Number(valor) : null) : Number(valor) }
          : it,
      ),
    );
  };

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2) return setError('La rutina necesita un nombre.');
    if (items.length === 0) return setError('Agregá al menos un movimiento.');
    if (items.some((i) => !i.sets || !i.reps)) {
      return setError('Cada movimiento necesita series y repeticiones.');
    }

    setBusy(true);
    setError('');
    const cuerpo = {
      name: nombre.trim(),
      notes: notas.trim() || undefined,
      items: items.map((i) => ({
        name: i.name,
        sets: i.sets,
        reps: i.reps,
        ...(i.weight_kg !== null ? { weight_kg: i.weight_kg } : {}),
        ...(i.rpe !== null ? { rpe: i.rpe } : {}),
      })),
    };

    try {
      if (rutina) await api.patch(`/routines/${rutina.id}`, cuerpo);
      else await api.post('/routines', cuerpo);
      onGuardada(cuerpo.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={rutina ? 'Editar rutina' : 'Nueva rutina'}
      className="modal-overlay"
    >
      <form onSubmit={guardar} className="card modal-card">
        <div className="exercise__head">
          <h3 className="card__title">{rutina ? `Editar "${rutina.name}"` : 'Nueva rutina'}</h3>
          <button type="button" className="btn btn--quiet" aria-label="Cerrar" onClick={onCerrar}>
            <IconoCerrar />
          </button>
        </div>

        <div className="field">
          <label htmlFor="rt-nombre">Nombre</label>
          <input
            id="rt-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Empuje A"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="rt-notas">Notas (opcional)</label>
          <input
            id="rt-notas"
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Lunes y jueves, descanso de 2 min"
          />
        </div>

        <div className="field">
          <label htmlFor="rt-buscar">Agregar movimiento</label>
          <input
            id="rt-buscar"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="bench press, pecho, mancuerna..."
            autoComplete="off"
          />
        </div>

        {results.length > 0 && (
          <ul className="results" role="listbox" aria-label="Movimientos">
            {results.map((m) => (
              <li
                key={m.id}
                role="option"
                aria-selected={false}
                className="result"
                onClick={() => agregar(m)}
              >
                <span>{m.name}</span>
                <span className="muted result__kcal">
                  {m.equipment} · {m.target}
                </span>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <ul className="entries">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="entry entry--objetivo">
                <span className="entry__label">{it.name}</span>
                <div className="serie-pendiente__campos">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={it.sets}
                    onChange={(e) => cambiar(i, 'sets', e.target.value)}
                    aria-label={`Series objetivo de ${it.name}`}
                  />
                  <span aria-hidden="true">×</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={it.reps}
                    onChange={(e) => cambiar(i, 'reps', e.target.value)}
                    aria-label={`Repeticiones objetivo de ${it.name}`}
                  />
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={999}
                    value={it.weight_kg ?? ''}
                    onChange={(e) => cambiar(i, 'weight_kg', e.target.value)}
                    placeholder="kg"
                    aria-label={`Kilos objetivo de ${it.name}`}
                  />
                  <select
                    value={it.rpe ?? ''}
                    onChange={(e) => cambiar(i, 'rpe', e.target.value)}
                    aria-label={`Esfuerzo objetivo de ${it.name}`}
                  >
                    <option value="">RPE</option>
                    {['10', '9.5', '9', '8.5', '8', '7.5', '7', '6', '5'].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Quitar ${it.name} de la rutina`}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--block" disabled={busy}>
          {busy ? 'Guardando...' : 'Guardar rutina'}
        </button>
      </form>
    </div>
  );
}

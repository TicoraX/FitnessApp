import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  api,
  getCacheado,
  invalidarCache,
  notificarCambio,
  shiftDate,
  type DaySummary,
  type Movement,
  type MovementTrending,
  type StrengthEntry,
  type StrengthHistory,
} from './api';
import { CampoEsfuerzo } from './components/CampoEsfuerzo';
import { NombreMovimiento } from './components/NombreMovimiento';
import { MediaMovimiento } from './components/MediaMovimiento';
import { esRecord } from './record';

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
  onDescanso,
  movimientoInicial,
  onMovimientoConsumido,
}: {
  date: string;
  day: DaySummary;
  onChanged: () => void;
  /** Confirmar una serie arranca el descanso: es lo que uno hace despues. */
  onDescanso: () => void;
  /** Un movimiento elegido desde el Catálogo, para arrancar el registro sin buscarlo de nuevo. */
  movimientoInicial?: Movement | null;
  onMovimientoConsumido?: () => void;
}) {
  const sinMovimiento = useReducedMotion();
  const inputMovimiento = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [zona, setZona] = useState('');
  const [equipo, setEquipo] = useState('');
  const [facets, setFacets] = useState<Facets>({
    body: [],
    equipment: [],
  });
  const [results, setResults] = useState<Movement[]>([]);
  const [semana, setSemana] = useState<MovementTrending[]>([]);
  const [trendingRev, setTrendingRev] = useState(0);

  const refreshTrending = () => {
    invalidarCache('/logs/strength/trending');
    setTrendingRev((r) => r + 1);
  };
  const [selected, setSelected] = useState<Movement | null>(null);
  const [historia, setHistoria] = useState<StrengthHistory | null>(null);
  const [series, setSeries] = useState('3');
  const [reps, setReps] = useState('10');
  const [kilos, setKilos] = useState('');
  const [esfuerzo, setEsfuerzo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  /** Nombre del movimiento cuyo récord se acaba de romper, o null. */
  const [record, setRecord] = useState<string | null>(null);
  /**
   * Borrar una serie es definitivo y el botón está pegado a "Hecho". Un
   * deshacer de unos segundos cuesta menos que un diálogo de confirmación y
   * molesta bastante menos.
   *
   * La unidad es la acción del usuario, no la fila: confirmar seis series de
   * un toque deja un solo deshacer que revierte las seis.
   */
  const [deshacer, setDeshacer] = useState<{ texto: string; accion: () => Promise<void> } | null>(null);

  useEffect(() => {
    // Las zonas y equipos no cambian entre despliegues: una vez por sesión.
    getCacheado<{ data: Facets }>('/exercise/facets')
      .then((r) => setFacets(r.data))
      .catch(() => {
        // Sin chips se puede buscar igual escribiendo.
      });
  }, []);

  // Lo que venís entrenando estos días. Cacheado y invalidado en el cambio, que
  // es el patrón del resto: sin eso, cada montaje de la vista disparaba un
  // pedido y el techo de `ui:check` pasaba a depender del reloj.
  useEffect(() => {
    let vigente = true;
    getCacheado<{ data: MovementTrending[] }>(
      `/logs/strength/trending?limit=6&desde=${shiftDate(date, -7)}`,
    )
      .then((r) => {
        if (vigente) setSemana(r.data.filter((m) => m.id));
      })
      .catch(() => {
        // Es un atajo: sin él se busca escribiendo, como siempre.
      });
    return () => {
      vigente = false;
    };
  }, [date, day.strength.length, trendingRev]);

  // Con un filtro puesto la lista se llena sola: explorar el catálogo es el
  // punto de las chips, y exigir además dos letras lo anularía.
  const hayFiltro = Boolean(zona || equipo);
  useEffect(() => {
    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false;
      setResults([]);
      return;
    }
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

  const elegirRef = useRef(0);
  const isProgrammaticRef = useRef(false);
  const deshacerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const invalidarPendientes = () => {
    ++elegirRef.current;
  };

  const elegir = async (m: Movement) => {
    invalidarPendientes();
    const id = elegirRef.current;
    isProgrammaticRef.current = true;
    setSelected(m);
    setQuery(m.name_es ?? m.name);
    setResults([]);
    setError('');
    setHistoria(null);
    setSeries('3');
    setReps('10');
    setKilos('');
    setEsfuerzo('');
    try {
      const r = await api.get<{ data: StrengthHistory }>(
        `/logs/strength/history?name=${encodeURIComponent(m.name)}`,
      );
      if (id !== elegirRef.current) return;
      setHistoria(r.data);
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

  /**
   * El trending trae el id del catálogo, no el movimiento entero. Pedirlo acá
   * cuesta un request al tocar la chip y a cambio reusa `elegir`, que además
   * trae la historia y precarga los números de la última vez.
   */
  const elegirPorId = async (id: string | null, nombre: string) => {
    if (!id) return;
    try {
      const r = await api.get<{ data: Movement[] }>(`/exercise/movements?id=${encodeURIComponent(id)}`);
      const m = r.data.find((x) => x.name === nombre) ?? r.data[0];
      if (m) await elegir(m);
    } catch {
      setError('No se pudo abrir el movimiento.');
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
      // La comparación ya estaba hecha y no se mostraba: el récord se descubría
      // semanas después entrando al detalle del movimiento.
      if (esRecord(historia?.best, { reps: r, weight_kg: kilos ? Number(kilos) : null })) {
        setRecord(selected.name_es ?? selected.name);
      }
      notificarCambio('diario-cambiado');
      refreshTrending();
      invalidarPendientes();
      isProgrammaticRef.current = false;
      setQuery('');
      setSelected(null);
      setHistoria(null);
      setKilos('');
      setEsfuerzo('');
      onChanged();
      onDescanso();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar.');
    } finally {
      setBusy(null);
    }
  }

  /**
   * El caso normal de una rutina es que salga como estaba planeada, y hoy eso
   * cuesta un toque por serie con cuatro campos al lado tentando a mirarlos.
   *
   * Manda los valores del objetivo, no lo que haya tecleado el usuario en una
   * fila sin confirmar: primero corregís las que salieron distinto con su
   * propio "Hecho", después confirmás el resto de un toque.
   *
   * Sin endpoint nuevo: son N PATCH en paralelo y una rutina son seis u ocho.
   * Si alguna falla, las que pasaron quedan confirmadas y el error dice cuáles
   * no. Una serie confirmada es un hecho, no una transacción que revertir.
   */
  async function confirmarTodas() {
    setBusy('todas');
    setError('');
    const resultados = await Promise.allSettled(
      pendientes.map((e) =>
        api.patch(`/logs/strength/${e.id}`, {
          sets: e.sets,
          reps: e.reps,
          ...(e.weight_kg !== null ? { weight_kg: e.weight_kg } : {}),
          ...(e.rpe !== null ? { rpe: e.rpe } : {}),
          done: true,
        }),
      ),
    );
    const fallaron = pendientes.filter((_, i) => resultados[i].status === 'rejected');
    if (fallaron.length) {
      setError(`Quedaron sin confirmar: ${fallaron.map((e) => e.name_es ?? e.name).join(', ')}.`);
    }
    // El deshacer toca solo las que pasaron: si tres fallaron, esas ya estaban
    // pendientes y no hay nada que revertir en ellas.
    const confirmadas = pendientes.filter((_, i) => resultados[i].status === 'fulfilled');
    notificarCambio('diario-cambiado');
    refreshTrending();
    onChanged();
    setBusy(null);
    if (confirmadas.length) {
      ofrecerDeshacer(`Confirmaste ${confirmadas.length} series.`, async () => {
        const res = await Promise.allSettled(confirmadas.map((e) => volverAPendiente(e)));
        const fallaronUndo = confirmadas.filter((_, i) => res[i].status === 'rejected');
        const exito = res.some((r) => r.status === 'fulfilled');
        if (fallaronUndo.length) {
          setError(`No se pudieron deshacer: ${fallaronUndo.map((e) => e.name_es ?? e.name).join(', ')}.`);
        }
        if (!exito) {
          throw new Error('No se pudo deshacer ninguna serie.');
        }
      });
    }
  }

  /** Devuelve una fila a pendiente con sus números del objetivo. */
  function volverAPendiente(e: StrengthEntry) {
    return api.patch(`/logs/strength/${e.id}`, {
      sets: e.sets,
      reps: e.reps,
      ...(e.weight_kg !== null ? { weight_kg: e.weight_kg } : {}),
      ...(e.rpe !== null ? { rpe: e.rpe } : {}),
      done: false,
    });
  }

  async function borrar(id: string) {
    const borrada = day.strength.find((e) => e.id === id);
    setBusy(id);
    try {
      await api.del(`/logs/strength/${id}`);
      notificarCambio('diario-cambiado');
      refreshTrending();
      onChanged();
      if (borrada) {
        // Vuelve con otro id, y no importa: `StrengthEntry` copia el nombre en
        // vez de referenciar el catálogo, así que nada apunta al viejo.
        ofrecerDeshacer(`Quitaste ${borrada.name_es ?? borrada.name}.`, async () => {
          await api.post('/logs/strength', {
            log_date: date,
            name: borrada.name,
            sets: borrada.sets,
            reps: borrada.reps,
            ...(borrada.weight_kg !== null ? { weight_kg: borrada.weight_kg } : {}),
            ...(borrada.rpe !== null ? { rpe: borrada.rpe } : {}),
            done: borrada.done,
          });
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    } finally {
      setBusy(null);
    }
  }

  /** Ocho segundos: lo que tarda en darse cuenta el que se equivocó de fila. */
  function ofrecerDeshacer(texto: string, accion: () => Promise<void>) {
    setDeshacer({ texto, accion });
    clearTimeout(deshacerRef.current);
    deshacerRef.current = setTimeout(() => setDeshacer(null), 8_000);
  }

  async function correrDeshacer() {
    if (!deshacer) return;
    const { accion } = deshacer;
    setDeshacer(null);
    clearTimeout(deshacerRef.current);
    setBusy('deshacer');
    try {
      await accion();
      notificarCambio('diario-cambiado');
      refreshTrending();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo deshacer.');
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

      {/*
        El único lugar de la app donde una animación con algo de personalidad se
        justifica: pasa poco y significa algo. En todo lo demás, contención.
      */}
      <AnimatePresence>
        {record && (
          <motion.p
            className="alert alert--ok record"
            role="status"
            initial={sinMovimiento ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            Récord de {record}. No lo habías levantado tan pesado.
            <button
              type="button"
              className="alert__btn"
              onClick={() => setRecord(null)}
              aria-label="Cerrar el aviso de récord"
            >
              Listo
            </button>
          </motion.p>
        )}
      </AnimatePresence>

      {deshacer && (
        <p className="alert alert--ok alert--reintento" role="status">
          {deshacer.texto}
          <button
            type="button"
            className="alert__btn"
            disabled={busy === 'deshacer'}
            onClick={correrDeshacer}
          >
            {busy === 'deshacer' ? '...' : 'Deshacer'}
          </button>
        </p>
      )}

      {pendientes.length > 1 && (
        <button
          type="button"
          className="btn"
          disabled={busy === 'todas'}
          onClick={confirmarTodas}
          style={{ marginBottom: 'var(--space-xs)' }}
        >
          {busy === 'todas' ? '...' : `Confirmar las ${pendientes.length} como estaban`}
        </button>
      )}

      {/*
        Una sola lista donde cada fila está pendiente o hecha, en vez de dos
        listas con la fila migrando de una a la otra. Confirmar una serie deja
        de mover lo que hay debajo del dedo, y el salto que había entre las dos
        listas desaparece porque no queda nada que saltar.

        Lo único que se anima es la posición de las filas de abajo, que suben
        cuando una se achica al pasar a hecha. Es FLIP: `motion` mide y anima
        transform, que es lo mismo que uno haría a mano.
      */}
      {entries.length > 0 && (
        <ul className="entries">
          {entries.map((e) => (
            <motion.li
              key={e.id}
              layout={sinMovimiento ? false : 'position'}
              className={e.done ? 'entry' : 'entry entry--pendiente'}
            >
              {e.done ? (
                <>
                  <NombreMovimiento name={e.name} nameEs={e.name_es} className="entry__label" />
                  <motion.span
                    className="muted num"
                    initial={sinMovimiento ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    {e.sets} × {e.reps}
                    {e.weight_kg !== null ? ` · ${e.weight_kg} kg` : ''}
                    {e.rpe !== null ? ` · RPE ${e.rpe}` : ''}
                  </motion.span>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    disabled={busy === e.id}
                    onClick={() => borrar(e.id)}
                    aria-label={`Quitar ${e.name}`}
                  >
                    Quitar
                  </button>
                </>
              ) : (
                <SeriePendiente
                  entry={e}
                  disabled={busy === 'todas'}
                  onDone={() => {
                    notificarCambio('diario-cambiado');
                    refreshTrending();
                    onChanged();
                    // Confirmar la última pendiente cierra el entreno: ahí no
                    // hay nada que descansar. La rutina entera tampoco.
                    if (pendientes.length > 1) onDescanso();
                    ofrecerDeshacer(`Confirmaste ${e.name_es ?? e.name}.`, () =>
                      volverAPendiente(e).then(() => undefined),
                    );
                  }}
                  onError={setError}
                  onQuitar={() => borrar(e.id)}
                />
              )}
            </motion.li>
          ))}
        </ul>
      )}

      <div className="exercise__form">
        <div className="field">
          <label htmlFor="fz-movimiento">Movimiento</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
            <input
              id="fz-movimiento"
              ref={inputMovimiento}
              type="text"
              value={query}
              onChange={(ev) => {
                invalidarPendientes();
                isProgrammaticRef.current = false;
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
                  invalidarPendientes();
                  isProgrammaticRef.current = false;
                  setQuery('');
                  setSelected(null);
                  setHistoria(null);
                  setResults([]);
                  inputMovimiento.current?.focus();
                }}
                aria-label="Limpiar búsqueda de movimiento"
                style={{
                  position: 'absolute',
                  right: '0.4rem',
                  padding: '0.25rem 0.5rem',
                  minHeight: '44px',
                  minWidth: '44px',
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

        {/* En la mitad de un entreno lo que servís es lo de esta semana, que es
            otro corte que el trending de siempre del catálogo. Solo cuando no
            hay nada escrito ni filtrado: apenas el usuario busca, estorba. */}
        {semana.length > 0 && !query && !zona && !equipo && !selected && (
          <>
            <p className="eyebrow muted">Esta semana</p>
            <div className="chips" role="group" aria-label="Movimientos de esta semana">
              {semana.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  className="chip"
                  onClick={() => elegirPorId(m.id, m.name)}
                >
                  {m.name_es ?? m.name}
                </button>
              ))}
            </div>
          </>
        )}

        <Chips
          label="Zona"
          valores={facets.body}
          activo={zona}
          onElegir={(v) => {
            invalidarPendientes();
            isProgrammaticRef.current = false;
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
              invalidarPendientes();
              isProgrammaticRef.current = false;
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
  disabled = false,
  onDone,
  onError,
  onQuitar,
}: {
  entry: StrengthEntry;
  disabled?: boolean;
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
        <button type="button" className="btn" disabled={busy || disabled} onClick={confirmar}>
          {busy ? '...' : 'Hecho'}
        </button>
        <button
          type="button"
          className="btn btn--quiet"
          disabled={disabled}
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

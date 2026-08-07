import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { api, getCacheado, type Movement, type MovementTrending, type StrengthHistory } from '../api';
import { ErrorConReintento } from '../components/ErrorConReintento';
import { MediaMovimiento } from '../components/MediaMovimiento';
import { NombreMovimiento } from '../components/NombreMovimiento';
import type { ParsedRoute } from '../hooks/useHashRoute';

type Facets = { body: string[]; equipment: string[] };

const PAGE_SIZE = 24;

export function CatalogoEjercicios({
  route,
  navigate,
  onRegistrar,
}: {
  route: ParsedRoute;
  navigate: (path: string) => void;
  onRegistrar: (m: Movement) => void;
}) {
  const rest = route.rest;
  // rest[0] es 'catalogo'
  const subpath = rest.slice(1); // [] para Zonas, [body] para Lista, [body, id] para Detalle

  /**
   * La jerarquía ya está en la URL, así que la animación la refuerza en vez de
   * decorarla: entrar avanza y volver retrocede. Un fade no distingue las dos
   * cosas y deja al usuario reconstruyendo solo dónde quedó.
   */
  const sinMovimiento = useReducedMotion();
  const profundidad = subpath.length;
  const previa = useRef(profundidad);
  const sentido = profundidad >= previa.current ? 1 : -1;
  useEffect(() => {
    previa.current = profundidad;
  }, [profundidad]);

  let pantalla;
  if (subpath.length >= 2) {
    const [body, id] = subpath;
    const busqueda = route.query.toString() ? `?${route.query}` : '';
    pantalla = (
      <PantallaDetalle
        body={body}
        id={id}
        busqueda={busqueda}
        navigate={navigate}
        onRegistrar={onRegistrar}
      />
    );
  } else if (subpath.length === 1) {
    pantalla = <PantallaLista body={subpath[0]} query={route.query} navigate={navigate} />;
  } else {
    pantalla = <PantallaZonas navigate={navigate} />;
  }

  return (
    <AnimatePresence mode="wait" custom={sentido} initial={false}>
      <motion.div
        key={subpath.join('/') || 'zonas'}
        custom={sentido}
        variants={sinMovimiento ? pasosQuietos : pasos}
        initial="entra"
        animate="centro"
        exit="sale"
      >
        {pantalla}
      </motion.div>
    </AnimatePresence>
  );
}

/** Entrar viene de la derecha; volver, de la izquierda. */
const pasos = {
  entra: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  centro: { x: 0, opacity: 1, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const } },
  sale: (dir: number) => ({
    x: dir > 0 ? -24 : 24,
    opacity: 0,
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const },
  }),
};

const pasosQuietos = {
  entra: { x: 0, opacity: 1 },
  centro: { x: 0, opacity: 1, transition: { duration: 0 } },
  sale: { x: 0, opacity: 1, transition: { duration: 0 } },
};

/**
 * Pantalla 1: PantallaZonas
 * Muestra Trending de uso personal + Grid de zonas musculares.
 */
function PantallaZonas({ navigate }: { navigate: (path: string) => void }) {
  const [facets, setFacets] = useState<Facets>({ body: [], equipment: [] });
  const [trending, setTrending] = useState<MovementTrending[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let vigente = true;
    api
      .get<{ data: MovementTrending[] }>('/logs/strength/trending?limit=8')
      .then((r) => vigente && setTrending(r.data))
      .catch(() => {});

    getCacheado<{ data: Facets }>('/exercise/facets')
      .then((r) => vigente && setFacets(r.data))
      .catch(() => vigente && setError(true));

    return () => {
      vigente = false;
    };
  }, [retry]);

  return (
    <div className="card catalogo-ej">
      <div className="exercise__head">
        <p className="eyebrow">Catálogo de Ejercicios</p>
        <span className="muted num">{facets.body.length} zonas</span>
      </div>

      {trending.length > 0 && (
        <div className="stack" style={{ gap: 'var(--space-2xs)' }}>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Lo que más venís haciendo
          </p>
          <div className="chips" role="group" aria-label="Trending">
            {trending.map((t) =>
              t.id ? (
                <button
                  key={t.name}
                  type="button"
                  className="chip"
                  onClick={() => {
                    if (t.body) {
                      navigate(`ejercicio/catalogo/${encodeURIComponent(t.body)}/${encodeURIComponent(t.id!)}`);
                    } else {
                      navigate(`ejercicio/catalogo`);
                    }
                  }}
                >
                  {t.name_es ?? t.name} · {t.count}
                </button>
              ) : (
                <span key={t.name} className="chip">
                  {t.name_es ?? t.name} · {t.count}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {error ? (
        <ErrorConReintento
          mensaje="No se pudieron cargar las zonas musculares."
          onReintentar={() => setRetry((n) => n + 1)}
        />
      ) : (
        <div className="stack" style={{ gap: 'var(--space-xs)' }}>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Selecciona una zona muscular para explorar
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 'var(--space-xs)',
            }}
          >
            {facets.body.map((z) => (
              <button
                key={z}
                type="button"
                className="btn btn--quiet"
                style={{
                  minHeight: '44px',
                  justifyContent: 'center',
                  textTransform: 'capitalize',
                  fontWeight: 600,
                  fontSize: 'var(--text-md)',
                  border: 'var(--rule)',
                }}
                onClick={() => navigate(`ejercicio/catalogo/${encodeURIComponent(z)}`)}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pantalla 2: PantallaLista
 * Muestra lista paginada de movimientos de una zona con filtro por equipo.
 */
function PantallaLista({
  body,
  query,
  navigate,
}: {
  body: string;
  query: URLSearchParams;
  navigate: (path: string) => void;
}) {
  const equipment = query.get('equipment') || '';
  const pageParam = Number(query.get('page') || '1');
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 0 : Math.floor(pageParam) - 1;
  // El detalle se lleva el filtro y la página para poder volver acá tal cual.
  // `history.back()` no sirve: al detalle también se llega por link directo.
  const busqueda = query.toString() ? `?${query}` : '';

  const [facets, setFacets] = useState<Facets>({ body: [], equipment: [] });
  const [items, setItems] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let vigente = true;
    getCacheado<{ data: Facets }>(`/exercise/facets?body=${encodeURIComponent(body)}`)
      .then((r) => vigente && setFacets(r.data))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [body]);

  useEffect(() => {
    let vigente = true;
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({
      body,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (equipment) params.set('equipment', equipment);

    api
      .get<{ data: Movement[]; total: number }>(`/exercise/movements?${params}`)
      .then((r) => {
        if (!vigente) return;
        setItems(r.data);
        setTotal(r.total);
        setLoading(false);
      })
      .catch(() => {
        if (!vigente) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      vigente = false;
    };
  }, [body, equipment, page, retry]);

  const seleccionarEquipo = (eq: string) => {
    const nuevoEq = equipment === eq ? '' : eq;
    const params = new URLSearchParams();
    if (nuevoEq) params.set('equipment', nuevoEq);
    const qStr = params.toString();
    navigate(`ejercicio/catalogo/${encodeURIComponent(body)}${qStr ? '?' + qStr : ''}`);
  };

  const cambiarPagina = (nuevaPagina: number) => {
    const params = new URLSearchParams();
    if (equipment) params.set('equipment', equipment);
    if (nuevaPagina > 0) params.set('page', String(nuevaPagina + 1));
    const qStr = params.toString();
    navigate(`ejercicio/catalogo/${encodeURIComponent(body)}${qStr ? '?' + qStr : ''}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="card catalogo-ej">
      <div className="exercise__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => navigate('ejercicio/catalogo')}
            style={{ padding: '0.2rem 0.5rem' }}
          >
            ← Zonas
          </button>
          <h3 style={{ textTransform: 'capitalize', margin: 0 }}>{body}</h3>
        </div>
        <span className="muted num">{total} movimientos</span>
      </div>

      {facets.equipment.length > 0 && (
        <div className="stack" style={{ gap: 'var(--space-2xs)' }}>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Filtrar por equipo
          </p>
          <div className="chips" role="group" aria-label="Equipo">
            {facets.equipment.map((eq) => (
              <button
                key={eq}
                type="button"
                className="chip"
                aria-pressed={equipment === eq}
                onClick={() => seleccionarEquipo(eq)}
              >
                {eq}
              </button>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <ErrorConReintento
          mensaje="No se pudieron cargar los movimientos."
          onReintentar={() => setRetry((n) => n + 1)}
        />
      ) : loading ? (
        <p className="muted">Cargando movimientos...</p>
      ) : items.length === 0 ? (
        <div className="stack" style={{ gap: 'var(--space-xs)', textAlign: 'center', padding: 'var(--space-md) 0' }}>
          <p className="muted">No hay movimientos en esta zona o con el equipo seleccionado.</p>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => navigate('ejercicio/catalogo')}
          >
            Volver a Zonas
          </button>
        </div>
      ) : (
        <>
          <ul className="results" aria-label={`Movimientos de ${body}`}>
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="result"
                  onClick={() =>
                    navigate(
                      `ejercicio/catalogo/${encodeURIComponent(body)}/${encodeURIComponent(m.id)}${busqueda}`,
                    )
                  }
                >
                  <NombreMovimiento name={m.name} nameEs={m.name_es} />
                  <span className="muted result__kcal">
                    {m.equipment} · {m.target}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="exercise__row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn--quiet"
                disabled={page === 0}
                onClick={() => cambiarPagina(page - 1)}
              >
                Anterior
              </button>
              <span className="muted num">
                Página {page + 1} de {totalPages}
              </span>
              <button
                type="button"
                className="btn btn--quiet"
                disabled={page + 1 >= totalPages}
                onClick={() => cambiarPagina(page + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Pantalla 3: PantallaDetalle
 * Muestra GIF del movimiento, instrucciones, gráfico de progreso y tabla de historial.
 */
function PantallaDetalle({
  body,
  id,
  busqueda,
  navigate,
  onRegistrar,
}: {
  body: string;
  id: string;
  busqueda: string;
  navigate: (path: string) => void;
  onRegistrar: (m: Movement) => void;
}) {
  const [movimiento, setMovimiento] = useState<Movement | null>(null);
  const [historia, setHistoria] = useState<StrengthHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let vigente = true;
    setLoading(true);
    setNotFound(false);
    setError(false);
    setHistoria(null);

    api
      .get<{ data: Movement[] }>(`/exercise/movements?id=${encodeURIComponent(id)}&limit=1`)
      .then((r) => {
        if (!vigente) return;
        const mov = r.data[0];
        if (!mov) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setMovimiento(mov);
        setLoading(false);

        // Cargar historial del movimiento por su nombre
        api
          .get<{ data: StrengthHistory }>(`/logs/strength/history?name=${encodeURIComponent(mov.name)}`)
          .then((histRes) => {
            if (vigente) setHistoria(histRes.data);
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!vigente) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      vigente = false;
    };
  }, [id, retry]);

  if (loading) {
    return (
      <div className="card catalogo-ej">
        <p className="muted">Cargando detalle del movimiento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card catalogo-ej">
        <ErrorConReintento
          mensaje="No se pudo cargar la información del movimiento."
          onReintentar={() => setRetry((n) => n + 1)}
        />
      </div>
    );
  }

  if (notFound || !movimiento) {
    return (
      <div className="card catalogo-ej stack" style={{ gap: 'var(--space-md)', textAlign: 'center' }}>
        <p className="muted">Este movimiento ya no existe o el enlace es inválido.</p>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => navigate(`ejercicio/catalogo/${encodeURIComponent(body)}${busqueda}`)}
        >
          Volver a {body}
        </button>
      </div>
    );
  }

  return (
    <div className="card catalogo-ej stack" style={{ gap: 'var(--space-md)' }}>
      <div className="exercise__head">
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => navigate(`ejercicio/catalogo/${encodeURIComponent(body)}${busqueda}`)}
          style={{ padding: '0.2rem 0.5rem' }}
        >
          ← Volver
        </button>
        <span className="muted num" style={{ textTransform: 'capitalize' }}>
          {movimiento.body} · {movimiento.equipment}
        </span>
      </div>

      <div className="stack" style={{ gap: 'var(--space-xs)' }}>
        <NombreMovimiento name={movimiento.name} nameEs={movimiento.name_es} className="entry__label" />
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Músculo objetivo: <strong style={{ color: 'var(--text-main)' }}>{movimiento.target}</strong>
        </p>
      </div>

      {movimiento.howTo && (
        <div className="stack" style={{ gap: 'var(--space-2xs)' }}>
          <p className="eyebrow">Cómo ejecutarlo</p>
          <p className="muted">{movimiento.howTo}</p>
        </div>
      )}

      <MediaMovimiento name={movimiento.name} media={movimiento.media} />

      <button
        type="button"
        className="btn"
        onClick={() => {
          onRegistrar(movimiento);
          navigate('ejercicio');
        }}
        style={{ width: '100%', minHeight: '44px', fontWeight: 'bold' }}
      >
        Registrar esta serie
      </button>

      {historia && historia.series.length > 0 ? (
        <div className="stack" style={{ gap: 'var(--space-sm)', borderTop: 'var(--rule)', paddingTop: 'var(--space-sm)' }}>
          <p className="eyebrow">Tu Historial</p>
          <HistorialChart series={historia.series} />
          <table className="catalogo-ej__historial">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Series</th>
                <th>Peso</th>
                <th>RPE</th>
              </tr>
            </thead>
            <tbody>
              {historia.series.map((s, i) => (
                <tr key={`${s.log_date}-${i}`}>
                  <td>{s.log_date}</td>
                  <td>
                    {s.sets} × {s.reps}
                  </td>
                  <td>{s.weight_kg !== null ? `${s.weight_kg} kg` : '—'}</td>
                  <td>{s.rpe ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ borderTop: 'var(--rule)', paddingTop: 'var(--space-sm)' }}>
          Todavía no registraste este movimiento.
        </p>
      )}
    </div>
  );
}

/**
 * Peso a lo largo del tiempo para un movimiento. Solo grafica series con
 * peso: dominadas o flexiones no tienen kilos que trazar.
 */
function HistorialChart({ series }: { series: { log_date: string; weight_kg: number | null }[] }) {
  const puntos = [...series].reverse().filter((s) => s.weight_kg !== null) as { log_date: string; weight_kg: number }[];
  if (puntos.length < 2) return null;

  const width = 600;
  const height = 140;
  const padding = 24;

  const maxVal = Math.max(...puntos.map((p) => p.weight_kg));
  const minVal = Math.min(0, ...puntos.map((p) => p.weight_kg));
  const rango = maxVal - minVal || 1;

  const x = (i: number) => padding + (i / (puntos.length - 1)) * (width - 2 * padding);
  const y = (v: number) => height - padding - ((v - minVal) / rango) * (height - 2 * padding);

  const linea = puntos.map((p, i) => `${x(i)},${y(p.weight_kg)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      <polyline points={linea} fill="none" stroke="var(--color-primary)" strokeWidth="2" />
      {puntos.map((p, i) => (
        <circle key={`${p.log_date}-${i}`} cx={x(i)} cy={y(p.weight_kg)} r="2.5" fill="var(--color-primary)" />
      ))}
      <text x={padding} y={height - 4} fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
        {puntos[0].log_date}
      </text>
      <text
        x={width - padding}
        y={height - 4}
        fill="var(--text-muted)"
        fontSize="9"
        fontFamily="var(--font-mono)"
        textAnchor="end"
      >
        {puntos[puntos.length - 1].log_date}
      </text>
    </svg>
  );
}

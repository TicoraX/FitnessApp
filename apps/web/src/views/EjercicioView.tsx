import { useEffect, useState } from 'react';
import { api, getCacheado, type DaySummary, type ExerciseReport, type Movement } from '../api';
import { Exercise } from '../Exercise';
import { Strength } from '../Strength';
import { Routines } from '../Routines';
import { ErrorConReintento } from '../components/ErrorConReintento';
import Counter from '../components/Counter';
import { CatalogoEjercicios } from './CatalogoEjercicios';
import type { ParsedRoute } from '../hooks/useHashRoute';

/**
 * Entrenamiento: cardio, fuerza y rutinas, con su propia navegación por fecha.
 *
 * Vive fuera del diario porque no es comida: el diario resume las calorías
 * quemadas y linkea acá. Cargar el día es cosa de esta vista, no del shell,
 * para poder mirar entrenos viejos sin mover la fecha del diario.
 */
export function EjercicioView({
  fechaInicial,
  route,
  navigate,
  onDescanso,
}: {
  fechaInicial: string;
  route: ParsedRoute;
  navigate: (path: string) => void;
  /** Arranca el cronometro de descanso, que vive arriba del router. */
  onDescanso: () => void;
}) {
  const [date, setDate] = useState(fechaInicial);
  const [day, setDay] = useState<DaySummary | null>(null);
  const [reporte, setReporte] = useState<ExerciseReport | null>(null);
  /** Los mismos siete días, corridos una semana atrás. Solo para el delta. */
  const [previo, setPrevio] = useState<ExerciseReport | null>(null);
  const [error, setError] = useState('');
  const [falloResumen, setFalloResumen] = useState(false);
  /** Contador de recarga: cualquier cambio en el día vuelve a pedir día y resumen. */
  const [recarga, setRecarga] = useState(0);
  /** El movimiento que Catálogo pasó para registrar: Strength lo consume una vez y lo suelta. */
  const [movimientoParaRegistrar, setMovimientoParaRegistrar] = useState<Movement | null>(null);

  const isCatalogo = route.rest[0] === 'catalogo';

  useEffect(() => {
    let vigente = true;
    setError('');
    api
      .get<{ data: DaySummary }>(`/logs/${date}`)
      .then((r) => vigente && setDay(r.data))
      .catch((e) => vigente && setError(e instanceof Error ? e.message : 'No se pudo cargar el día'));
    return () => {
      vigente = false;
    };
  }, [date, recarga]);

  // El resumen mira los últimos 7 días terminando en la fecha vista, así que
  // moverse en el tiempo también mueve la ventana.
  useEffect(() => {
    const hasta = date;
    const desde = new Date(`${date}T00:00:00`);
    desde.setDate(desde.getDate() - 6);
    const from = desde.toISOString().slice(0, 10);

    // El volumen de esta semana solo no dice nada; contra el de la anterior, sí.
    // Son dos llamadas al mismo endpoint con dos rangos y una resta en el
    // cliente: el API no necesita saber nada de esto.
    const finPrevio = new Date(`${date}T00:00:00`);
    finPrevio.setDate(finPrevio.getDate() - 7);
    const inicioPrevio = new Date(finPrevio);
    inicioPrevio.setDate(inicioPrevio.getDate() - 6);

    let vigente = true;
    setFalloResumen(false);
    api
      .get<{ data: ExerciseReport }>(`/reports/exercise?from=${from}&to=${hasta}`)
      .then((r) => vigente && setReporte(r.data))
      .catch(() => vigente && setFalloResumen(true));
    // La semana pasada ya pasó: se pide una vez por sesión y la invalida
    // cualquier cambio, como el resto de lo que no se mueve. Sin esto, entrar y
    // salir de la vista duplicaba el tráfico de reportes, que tiene su propio
    // techo de 60 por minuto.
    getCacheado<{ data: ExerciseReport }>(
      `/reports/exercise?from=${inicioPrevio.toISOString().slice(0, 10)}&to=${finPrevio.toISOString().slice(0, 10)}`,
    )
      .then((r) => vigente && setPrevio(r.data))
      // El delta es un extra: sin la semana anterior el resumen se muestra igual.
      .catch(() => vigente && setPrevio(null));
    return () => {
      vigente = false;
    };
  }, [date, recarga]);

  const recargar = () => setRecarga((n) => n + 1);

  return (
    <div className="view-ejercicio stack" style={{ gap: 'var(--space-md)' }}>
      <div className="ejercicio__head">
        <div>
          <h2 id="entrenamiento">Entrenamiento</h2>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Cardio, fuerza y tus rutinas.
          </p>
        </div>
        <div className="field">
          <label htmlFor="ej-fecha">Día</label>
          <input
            id="ej-fecha"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="chips" role="group" aria-label="Sección de entrenamiento">
        <button
          type="button"
          className="chip"
          aria-current={!isCatalogo ? 'page' : undefined}
          onClick={() => navigate('ejercicio')}
        >
          Registrar
        </button>
        <button
          type="button"
          className="chip"
          aria-current={isCatalogo ? 'page' : undefined}
          onClick={() => navigate('ejercicio/catalogo')}
        >
          Catálogo
        </button>
      </div>

      {isCatalogo ? (
        <CatalogoEjercicios
          route={route}
          navigate={navigate}
          onRegistrar={(m) => {
            setMovimientoParaRegistrar(m);
          }}
        />
      ) : (
        <>
          {reporte ? (
            <ResumenSemanal reporte={reporte} previo={previo} />
          ) : falloResumen ? (
            <ErrorConReintento mensaje="No se pudo cargar el resumen de la semana." onReintentar={recargar} />
          ) : null}

          <Routines date={date} onLoaded={recargar} />

          {day ? (
            <>
              <Strength
                date={date}
                day={day}
                onChanged={recargar}
                onDescanso={onDescanso}
                movimientoInicial={movimientoParaRegistrar}
                onMovimientoConsumido={() => setMovimientoParaRegistrar(null)}
              />
              <Exercise date={date} day={day} onChanged={recargar} />
            </>
          ) : (
            !error && <p className="muted">Cargando el día.</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Cuánto cambió contra la misma ventana de la semana pasada.
 *
 * Sin semana anterior no muestra nada: un "+100%" contra cero no informa, y
 * arrancar a entrenar no es una mejora del cien por ciento.
 */
function Delta({ ahora, antes }: { ahora: number; antes: number | undefined }) {
  if (antes === undefined || antes === 0 || ahora === antes) return null;
  const pct = Math.round(((ahora - antes) / antes) * 100);
  if (pct === 0) return null;
  return (
    <span className="delta muted" title={`La semana pasada: ${antes.toLocaleString('es')}`}>
      {pct > 0 ? '+' : '−'}
      {Math.abs(pct)}% vs. semana pasada
    </span>
  );
}

/**
 * Los colores de los macros, reusados. Ya pasan contrast:check en los dos temas
 * y en el tema claro están escalonados en lightness a propósito, para no
 * apoyarse solo en el matiz, que es lo que colapsa en deuteranopía.
 */
const COLORES_ZONA = [
  'var(--color-protein)',
  'var(--color-carbs)',
  'var(--color-fats)',
  'var(--color-water)',
  'var(--color-calories)',
];

/**
 * Series por zona a lo largo del rango, apiladas por día.
 *
 * El agregado del rango dice cómo repartiste el cuerpo; esto dice si una zona
 * viene plana, que es lo que hace cambiar algo. SVG a mano, como el resto del
 * proyecto: una librería de charts entra cuando un gráfico necesite interacción
 * real, no antes.
 */
function ZonasEnElTiempo({
  dias,
  zonas,
}: {
  dias: ExerciseReport['days'];
  zonas: string[];
}) {
  const conSeries = dias.filter((d) => d.by_body.length > 0);
  if (conSeries.length === 0) return null;

  const pico = Math.max(1, ...conSeries.map((d) => d.sets));
  const ancho = 100 / conSeries.length;

  return (
    <div className="zonas-tiempo">
      <p className="eyebrow muted">Series por zona</p>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Series por zona y por día: ${conSeries
          .map((d) => `${d.log_date.slice(5)}, ${d.by_body.map((b) => `${b.body} ${b.sets}`).join(' y ')}`)
          .join('; ')}`}
      >
        {conSeries.map((d, i) => {
          let base = 40;
          return d.by_body.map((b) => {
            const alto = (b.sets / pico) * 38;
            base -= alto;
            return (
              <rect
                key={`${d.log_date}-${b.body}`}
                x={i * ancho + ancho * 0.15}
                y={base}
                width={ancho * 0.7}
                height={alto}
                fill={COLORES_ZONA[zonas.indexOf(b.body) % COLORES_ZONA.length]}
              />
            );
          });
        })}
      </svg>
      <ul className="zonas-tiempo__leyenda">
        {zonas.map((z, i) => (
          <li key={z}>
            <span
              className="zonas-tiempo__punto"
              style={{ background: COLORES_ZONA[i % COLORES_ZONA.length] }}
            />
            {z}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Los últimos siete días. El volumen es series x reps x kilos, la métrica
 * estándar de carga; las series por zona son lo que muestra si el reparto del
 * cuerpo quedó torcido, y contra la semana pasada, si vas para algún lado.
 */
function ResumenSemanal({ reporte, previo }: { reporte: ExerciseReport; previo: ExerciseReport | null }) {
  const { totals, by_body, days } = reporte;
  const pico = Math.max(1, ...days.map((d) => d.volume_kg));

  return (
    <div className="card resumen-ej">
      <div className="exercise__head">
        <p className="eyebrow">Últimos 7 días</p>
        <span className="muted num">
          {totals.days_trained === 1 ? '1 día entrenado' : `${totals.days_trained} días entrenados`}
        </span>
      </div>

      <div className="resumen-ej__cifras num">
        {/* `Counter` ya existía con su spring y estaba subutilizado: estos dos
            números son los que cambian al confirmar una serie, así que son los
            que ganan algo con que el dígito se deslice en vez de saltar. */}
        <div>
          <span className="muted">Volumen</span>
          <strong>
            <Counter value={totals.volume_kg} fontSize={18} fontWeight={700} /> kg
          </strong>
          <Delta ahora={totals.volume_kg} antes={previo?.totals.volume_kg} />
        </div>
        <div>
          <span className="muted">Series</span>
          <strong>
            <Counter value={totals.sets} fontSize={18} fontWeight={700} />
          </strong>
          <Delta ahora={totals.sets} antes={previo?.totals.sets} />
        </div>
        <div>
          <span className="muted">Cardio</span>
          <strong>{totals.cardio_minutes} min</strong>
        </div>
        <div>
          <span className="muted">Quemadas</span>
          <strong>{totals.calories_burned} kcal</strong>
        </div>
      </div>

      {days.length > 0 && (
        <ul className="resumen-ej__barras" aria-label="Volumen por día">
          {days.map((d) => (
            <li key={d.log_date}>
              <span className="muted">{d.log_date.slice(5)}</span>
              <span
                className="resumen-ej__barra"
                style={{ width: `${Math.round((d.volume_kg / pico) * 100)}%` }}
              />
              <span className="num">{d.volume_kg.toLocaleString('es')} kg</span>
            </li>
          ))}
        </ul>
      )}

      {by_body.length > 0 && <ZonasEnElTiempo dias={days} zonas={by_body.map((b) => b.body)} />}

      {days.length === 0 && (
        <p className="muted">Sin entrenamientos en la semana. Lo que registres acá aparece mañana.</p>
      )}
    </div>
  );
}

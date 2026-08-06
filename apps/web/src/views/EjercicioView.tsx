import { useEffect, useState } from 'react';
import { api, type DaySummary, type ExerciseReport, type Movement } from '../api';
import { Exercise } from '../Exercise';
import { Strength } from '../Strength';
import { Routines } from '../Routines';
import { ErrorConReintento } from '../components/ErrorConReintento';
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
}: {
  fechaInicial: string;
  route: ParsedRoute;
  navigate: (path: string) => void;
}) {
  const [date, setDate] = useState(fechaInicial);
  const [day, setDay] = useState<DaySummary | null>(null);
  const [reporte, setReporte] = useState<ExerciseReport | null>(null);
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

    let vigente = true;
    setFalloResumen(false);
    api
      .get<{ data: ExerciseReport }>(`/reports/exercise?from=${from}&to=${hasta}`)
      .then((r) => vigente && setReporte(r.data))
      .catch(() => vigente && setFalloResumen(true));
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

      <div className="chips" role="tablist" aria-label="Sección de entrenamiento">
        <button
          type="button"
          role="tab"
          className="chip"
          aria-selected={!isCatalogo}
          aria-pressed={!isCatalogo}
          onClick={() => navigate('ejercicio')}
        >
          Registrar
        </button>
        <button
          type="button"
          role="tab"
          className="chip"
          aria-selected={isCatalogo}
          aria-pressed={isCatalogo}
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
            <ResumenSemanal reporte={reporte} />
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
 * Los últimos siete días. El volumen es series x reps x kilos, la métrica
 * estándar de carga; las series por zona son lo que muestra si el reparto del
 * cuerpo quedó torcido.
 */
function ResumenSemanal({ reporte }: { reporte: ExerciseReport }) {
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
        <div>
          <span className="muted">Volumen</span>
          <strong>{totals.volume_kg.toLocaleString('es')} kg</strong>
        </div>
        <div>
          <span className="muted">Series</span>
          <strong>{totals.sets}</strong>
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

      {by_body.length > 0 && (
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Series por zona: {by_body.map((b) => `${b.body} ${b.sets}`).join(' · ')}
        </p>
      )}

      {days.length === 0 && (
        <p className="muted">Sin entrenamientos en la semana. Lo que registres acá aparece mañana.</p>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api, type DaySummary, type ExerciseReport } from '../api';
import { Exercise } from '../Exercise';
import { Strength } from '../Strength';
import { Routines } from '../Routines';

/**
 * Entrenamiento: cardio, fuerza y rutinas, con su propia navegación por fecha.
 *
 * Vive fuera del diario porque no es comida: el diario resume las calorías
 * quemadas y linkea acá. Cargar el día es cosa de esta vista, no del shell,
 * para poder mirar entrenos viejos sin mover la fecha del diario.
 */
export function EjercicioView({ fechaInicial }: { fechaInicial: string }) {
  const [date, setDate] = useState(fechaInicial);
  const [day, setDay] = useState<DaySummary | null>(null);
  const [reporte, setReporte] = useState<ExerciseReport | null>(null);
  const [error, setError] = useState('');
  /** Contador de recarga: cualquier cambio en el día vuelve a pedir día y resumen. */
  const [recarga, setRecarga] = useState(0);

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
    api
      .get<{ data: ExerciseReport }>(`/reports/exercise?from=${from}&to=${hasta}`)
      .then((r) => vigente && setReporte(r.data))
      .catch(() => {
        // El resumen es contexto: sin él la vista sigue sirviendo para registrar.
      });
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

      {reporte && <ResumenSemanal reporte={reporte} />}

      <Routines date={date} onLoaded={recargar} />

      {day ? (
        <>
          <Strength date={date} day={day} onChanged={recargar} />
          <Exercise date={date} day={day} onChanged={recargar} />
        </>
      ) : (
        !error && <p className="muted">Cargando el día.</p>
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

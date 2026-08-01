import type { RefObject } from 'react';
import type { DaySummary } from '../api';
import { Weight } from '../Weight';
import { AddFood, CyberDayStrip, Dial, Macros, Meals, Water } from '../DiaryComponents';

export function DiarioView({
  date,
  setDate,
  day,
  loadDate,
  searchInputRef,
}: {
  date: string;
  setDate: (d: string) => void;
  day: DaySummary | null;
  loadDate: (d: string) => void;
  searchInputRef?: RefObject<HTMLInputElement>;
}) {
  return (
    <div className="view-diario stack" style={{ gap: 'var(--space-md)' }}>
      <CyberDayStrip date={date} setDate={setDate} />

      <div className="columns">
        <section aria-labelledby="resumen">
          <h2 id="resumen">Resumen</h2>
          {day ? (
            <>
              <div className="card card--raised" style={{ marginTop: 'var(--space-md)' }}>
                <Dial day={day} />
                <Macros day={day} />
                <Water date={date} day={day} onChanged={() => loadDate(date)} />
              </div>
              <Meals day={day} date={date} onChanged={() => loadDate(date)} />
            </>
          ) : (
            <p className="muted">Cargando el día.</p>
          )}
        </section>

        {/* Todo esto espera al día por una razón de red, no de contenido: el
            panel y el peso solo piden sus datos cuando asoman en pantalla, y
            montarlos contra un diario todavía vacío los deja arriba del pliegue
            por un instante, lo suficiente para que el observer los dé por
            vistos y dispare los pedidos igual. */}
        <section aria-labelledby="agregar">
          <h2 id="agregar">Agregar comida</h2>
          {day && (
            <>
              <div className="card" style={{ marginTop: 'var(--space-md)' }}>
                <AddFood date={date} onAdded={() => loadDate(date)} searchInputRef={searchInputRef} />
              </div>
              <ResumenEjercicio day={day} date={date} />
              <Weight onGoalChanged={() => loadDate(date)} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * El entrenamiento vive en su propia vista. Acá queda el saldo del día y el
 * camino hasta allá: el diario es sobre lo que se come.
 */
function ResumenEjercicio({ day, date }: { day: DaySummary; date: string }) {
  const seriesHechas = day.strength.filter((s) => s.done).length;
  const pendientes = day.strength.filter((s) => !s.done).length;
  const nada = day.exercise.total_burned === 0 && day.strength.length === 0;

  return (
    <div className="card exercise resumen-entreno">
      <div className="exercise__head">
        <p className="eyebrow">Entrenamiento</p>
        <a className="btn btn--quiet" href={`#/ejercicio/${date}`}>
          {nada ? 'Registrar' : 'Ver'}
        </a>
      </div>
      <p className="muted num">
        {nada
          ? 'Sin ejercicio registrado hoy.'
          : [
              day.exercise.total_burned > 0 && `${day.exercise.total_burned} kcal quemadas`,
              seriesHechas > 0 && `${seriesHechas} series hechas`,
              pendientes > 0 && `${pendientes} sin hacer`,
            ]
              .filter(Boolean)
              .join(' · ')}
      </p>
    </div>
  );
}

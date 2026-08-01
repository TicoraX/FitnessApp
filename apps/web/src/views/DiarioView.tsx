import type { RefObject } from 'react';
import type { DaySummary } from '../api';
import { Weight } from '../Weight';
import { Exercise } from '../Exercise';
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

        <section aria-labelledby="agregar">
          <h2 id="agregar">Agregar comida</h2>
          <div className="card" style={{ marginTop: 'var(--space-md)' }}>
            <AddFood date={date} onAdded={() => loadDate(date)} searchInputRef={searchInputRef} />
          </div>
          {day && <Exercise date={date} day={day} onChanged={() => loadDate(date)} />}
          <Weight onGoalChanged={() => loadDate(date)} />
        </section>
      </div>
    </div>
  );
}

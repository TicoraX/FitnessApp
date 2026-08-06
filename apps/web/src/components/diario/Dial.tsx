import { type CSSProperties } from 'react';
import { type DaySummary } from '../../api';
import Counter from '../Counter';

export function Dial({ day }: { day: DaySummary }) {
  const { totals, remaining } = day;
  const goal = remaining ? totals.calories + remaining.calories : 0;
  const pct = goal > 0 ? Math.min((totals.calories / goal) * 100, 100) : 0;
  const over = remaining ? remaining.calories < 0 : false;

  return (
    <div className="dial">
      <div
        className="ring"
        role="meter"
        aria-label="Calorías del día"
        aria-valuenow={totals.calories}
        aria-valuemin={0}
        aria-valuemax={goal || undefined}
        style={
          { '--pct': pct, '--ring-color': over ? 'var(--color-danger)' : undefined } as CSSProperties
        }
      />
      <div className="dial__figures">
        <span className="calories__value num">
          <Counter value={totals.calories} fontSize={38} fontWeight={700} />
        </span>
        <span className="dial__unit">kcal consumidas{goal > 0 && ` de ${goal}`}</span>
        {remaining ? (
          <span className="dial__left num" data-over={over}>
            {over ? `${Math.abs(remaining.calories)} de más` : `${remaining.calories} restantes`}
          </span>
        ) : (
          <span className="dial__left muted">Sin objetivo activo</span>
        )}
        {/* Sin esta línea el objetivo aparece más alto que el del perfil y no
            se entiende por qué: lo que se quema se suma al margen del día. */}
        {day.exercise.total_burned > 0 && (
          <span className="muted num" style={{ fontSize: 'var(--text-sm)' }}>
            incluye {day.exercise.total_burned} kcal de ejercicio
          </span>
        )}
      </div>
    </div>
  );
}


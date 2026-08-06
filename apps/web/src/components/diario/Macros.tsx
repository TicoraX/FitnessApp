import { type CSSProperties } from 'react';
import { type DaySummary } from '../../api';

export function Macros({ day }: { day: DaySummary }) {
  const { totals, remaining } = day;
  const macros = [
    { key: 'protein', label: 'Proteína', eaten: totals.protein_g, left: remaining?.protein_g },
    { key: 'carbs', label: 'Carbohidratos', eaten: totals.carbs_g, left: remaining?.carbs_g },
    { key: 'fat', label: 'Grasa', eaten: totals.fat_g, left: remaining?.fat_g },
  ];

  return (
    <div className="macros">
      {macros.map((m) => {
        const goal = m.left === undefined ? 0 : m.eaten + m.left;
        const pct = goal > 0 ? Math.min((m.eaten / goal) * 100, 100) : 0;
        const style = { '--macro-color': `var(--color-${m.key})` } as CSSProperties;
        return (
          <div className="macro" key={m.key} style={style}>
            <div className="macro__head">
              <span className="macro__name">
                <span className="macro__chip" />
                {m.label}
              </span>
              <span className="macro__value num">
                {Math.round(m.eaten)} g{goal > 0 && ` / ${Math.round(goal)} g`}
              </span>
            </div>
            <div
              className="macro__track"
              role="meter"
              aria-label={m.label}
              aria-valuenow={m.eaten}
              aria-valuemin={0}
              aria-valuemax={goal || undefined}
            >
              <div className="macro__fill" data-over={goal > 0 && m.eaten > goal} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}


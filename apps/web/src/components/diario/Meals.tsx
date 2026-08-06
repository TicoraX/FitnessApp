import { useState } from 'react';
import { api, MEALS, notificarCambio, shiftDate, type DaySummary } from '../../api';
import { Entry } from './Entry';

export function Meals({ day, date, onChanged }: { day: DaySummary; date: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copyingMeal, setCopyingMeal] = useState<string | null>(null);
  const [avisoCopia, setAvisoCopia] = useState<{ meal: string; texto: string } | null>(null);

  async function handleCopyYesterday(mealType: string) {
    setCopyingMeal(mealType);
    setAvisoCopia(null);
    try {
      const yesterday = shiftDate(date, -1);
      const antes = day.entries.filter((e) => e.meal_type === mealType).length;
      const res = await api.post<{ data: DaySummary }>('/logs/copy', {
        from_date: yesterday,
        to_date: date,
        meal_type: mealType,
      });
      // Copiar un día vacío no es un error: inserta cero filas y devuelve el
      // día igual que estaba. Sin este chequeo el botón gira y no pasa nada,
      // que desde afuera se ve idéntico a que la app se haya colgado.
      const despues = res.data.entries.filter((e) => e.meal_type === mealType).length;
      if (despues === antes) {
        setAvisoCopia({ meal: mealType, texto: 'Ayer no registraste nada en este tiempo.' });
      }
      notificarCambio('diario-cambiado');
      onChanged();
    } catch (e) {
      setAvisoCopia({
        meal: mealType,
        texto: e instanceof Error ? e.message : 'No se pudo copiar de ayer.',
      });
    } finally {
      setCopyingMeal(null);
    }
  }

  return (
    <div className="meals">
      {MEALS.map(([key, label]) => {
        const entries = day.entries.filter((e) => e.meal_type === key);
        const subtotal = Math.round(entries.reduce((sum, e) => sum + e.calories, 0));
        return (
          <div key={key} className="meal__card">
            <div className="meal__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <p className="eyebrow">{label}</p>
                <button
                  type="button"
                  className="btn btn--quiet"
                  style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', height: 'auto' }}
                  disabled={copyingMeal === key}
                  onClick={() => handleCopyYesterday(key)}
                  title="Copiar comidas de ayer"
                >
                  {copyingMeal === key ? 'Copiando...' : 'Copiar de ayer'}
                </button>
              </div>
              <span className="muted num">{subtotal > 0 ? `${subtotal} kcal` : '—'}</span>
            </div>
            {avisoCopia?.meal === key && (
              <p className="alert" role="status" style={{ marginBottom: 'var(--space-xs)' }}>
                {avisoCopia.texto}
              </p>
            )}
            {entries.length > 0 ? (
              <ul className="entries">
                {entries.map((e) => (
                  <Entry key={e.id} entry={e} busy={busy === e.id} onChanged={onChanged} setBusy={setBusy} />
                ))}
              </ul>
            ) : (
              <p className="meal__empty">Sin registros en este tiempo.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}


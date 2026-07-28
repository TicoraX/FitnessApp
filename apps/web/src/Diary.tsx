import { useCallback, useEffect, useState } from 'react';
import { api, today, type DaySummary, type Food } from './api';

const MEALS = [
  ['breakfast', 'Desayuno'],
  ['lunch', 'Almuerzo'],
  ['dinner', 'Cena'],
  ['snack', 'Snack'],
] as const;

export function Diary({ onLogout }: { onLogout: () => void }) {
  const [date, setDate] = useState(today());
  const [day, setDay] = useState<DaySummary | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (d: string) => {
    try {
      setError('');
      setDay((await api.get<{ data: DaySummary }>(`/logs/${d}`)).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el día');
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="topbar__mark">FitTrack</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label className="muted" htmlFor="date">
            Día
          </label>
          <input
            id="date"
            type="date"
            className="num"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="btn btn--quiet" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="columns">
        <section aria-labelledby="resumen">
          <h2 id="resumen">Resumen</h2>
          {day ? <Summary day={day} /> : <p className="muted">Cargando el día.</p>}
          {day && <Entries day={day} />}
        </section>

        <section aria-labelledby="agregar">
          <h2 id="agregar">Agregar comida</h2>
          <AddFood date={date} onAdded={() => load(date)} />
        </section>
      </div>
    </div>
  );
}

function Summary({ day }: { day: DaySummary }) {
  const { totals, remaining } = day;
  const macros = [
    { key: 'protein', label: 'Proteína', eaten: totals.protein_g, left: remaining?.protein_g },
    { key: 'carbs', label: 'Carbohidratos', eaten: totals.carbs_g, left: remaining?.carbs_g },
    { key: 'fat', label: 'Grasa', eaten: totals.fat_g, left: remaining?.fat_g },
  ];

  return (
    <>
      <div className="calories">
        <span className="calories__value num">{totals.calories}</span>
        <span className="muted">
          kcal consumidas
          {remaining && (
            <>
              {' · '}
              <span className="num">{Math.abs(remaining.calories)}</span>
              {remaining.calories >= 0 ? ' restantes' : ' de más'}
            </>
          )}
        </span>
      </div>

      {!remaining && (
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Sin objetivo activo: se muestran los totales sin comparación.
        </p>
      )}

      <div className="macros">
        {macros.map((m) => {
          const goal = m.left === undefined ? 0 : m.eaten + m.left;
          const pct = goal > 0 ? Math.min((m.eaten / goal) * 100, 100) : 0;
          return (
            <div key={m.key}>
              <div className="macro__head">
                <span>{m.label}</span>
                <span className="num muted">
                  {m.eaten} g{goal > 0 && ` / ${Math.round(goal)} g`}
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
                <div
                  className="macro__fill"
                  data-over={goal > 0 && m.eaten > goal}
                  style={
                    {
                      width: `${pct}%`,
                      '--macro-color': `var(--color-${m.key})`,
                    } as React.CSSProperties
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Entries({ day }: { day: DaySummary }) {
  if (day.entries.length === 0) {
    return (
      <p className="muted" style={{ marginTop: '2rem' }}>
        Todavía no registraste nada este día.
      </p>
    );
  }

  return (
    <div style={{ marginTop: '2.5rem' }}>
      {MEALS.map(([key, label]) => {
        const entries = day.entries.filter((e) => e.meal_type === key);
        if (entries.length === 0) return null;
        return (
          <div key={key} style={{ marginBottom: '1.5rem' }}>
            <p className="eyebrow">{label}</p>
            <ul className="entries">
              {entries.map((e) => (
                <li className="entry" key={e.id}>
                  <span>
                    <span className="entry__name">{e.food.name}</span>
                    {e.food.brand && <span className="muted"> · {e.food.brand}</span>}
                  </span>
                  <span className="muted num">
                    {e.servings_consumed} × {e.food.serving_size_amount}
                    {e.food.serving_size_unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AddFood({ date, onAdded }: { date: string; onAdded: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [servings, setServings] = useState('1');
  const [meal, setMeal] = useState<string>('breakfast');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Una búsqueda por pausa de tecleo, no una por tecla.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await api.get<{ data: Food[] }>(
          `/foods/search?q=${encodeURIComponent(query)}`,
        );
        setResults(res.data);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  async function add() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post('/logs/meal', {
        log_date: date,
        meal_type: meal,
        food_item_id: selected.id,
        servings_consumed: Number(servings),
      });
      setMessage({ text: `${selected.name} registrado.`, ok: true });
      setSelected(null);
      setQuery('');
      setResults([]);
      onAdded();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'No se pudo registrar', ok: false });
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="searchbar">
        <input
          type="search"
          placeholder="Buscar alimento"
          aria-label="Buscar alimento"
          value={query}
          onChange={(e) => {
            // Solo al tipear: add() también limpia el query, y ahí la
            // confirmación tiene que quedar visible.
            setQuery(e.target.value);
            setMessage(null);
          }}
        />
      </div>

      {query.trim().length >= 2 && results.length === 0 && (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Sin resultados para “{query}”.
        </p>
      )}

      <ul className="results">
        {results.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              className="result"
              aria-selected={selected?.id === f.id}
              onClick={() => setSelected(f)}
            >
              <span>
                {f.name}
                {f.brand && <span className="muted"> · {f.brand}</span>}
              </span>
              <span className="muted num">
                {f.calories} kcal / {f.serving_size_amount}
                {f.serving_size_unit}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="addbar">
          <select value={meal} onChange={(e) => setMeal(e.target.value)} aria-label="Comida">
            {MEALS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="num"
            step="0.25"
            min="0.01"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            aria-label="Porciones"
          />
          <button
            className="btn"
            onClick={add}
            disabled={busy || Number(servings) <= 0}
            data-state={busy ? 'loading' : undefined}
          >
            {busy ? 'Guardando' : 'Agregar'}
          </button>
        </div>
      )}

      {message && (
        <p className={message.ok ? 'alert alert--ok' : 'alert'} role="status" style={{ marginTop: '1rem' }}>
          {message.text}
        </p>
      )}
    </div>
  );
}

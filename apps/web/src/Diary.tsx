import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { api, today, type DaySummary, type Food } from './api';
import { Weight } from './Weight';

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
        <div className="topbar__tools">
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
          {day ? (
            <>
              <div className="card card--raised" style={{ marginTop: 'var(--space-md)' }}>
                <Dial day={day} />
                <Macros day={day} />
                <Water date={date} day={day} onChanged={() => load(date)} />
              </div>
              <Meals day={day} onChanged={() => load(date)} />
            </>
          ) : (
            <p className="muted">Cargando el día.</p>
          )}
        </section>

        <section aria-labelledby="agregar">
          <h2 id="agregar">Agregar comida</h2>
          <div className="card" style={{ marginTop: 'var(--space-md)' }}>
            <AddFood date={date} onAdded={() => load(date)} />
          </div>
          <Weight onGoalChanged={() => load(date)} />
        </section>
      </div>
    </div>
  );
}

function Dial({ day }: { day: DaySummary }) {
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
        <span className="calories__value num">{totals.calories}</span>
        <span className="dial__unit">kcal consumidas{goal > 0 && ` de ${goal}`}</span>
        {remaining ? (
          <span className="dial__left num" data-over={over}>
            {over ? `${Math.abs(remaining.calories)} de más` : `${remaining.calories} restantes`}
          </span>
        ) : (
          <span className="dial__left muted">Sin objetivo activo</span>
        )}
      </div>
    </div>
  );
}

function Macros({ day }: { day: DaySummary }) {
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
              <div className="macro__fill" data-over={goal > 0 && m.eaten > goal} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Vasos de 250 ml: en el teléfono se suma tocando, no tipeando un número. */
const GLASS_ML = 250;

function Water({
  date,
  day,
  onChanged,
}: {
  date: string;
  day: DaySummary;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function set(ml: number) {
    setBusy(true);
    try {
      await api.patch(`/logs/${date}/water`, { water_ml: Math.max(0, ml) });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="water">
      <span className="water__label muted">Agua</span>
      <span className="num water__value">
        {(day.water_ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L
      </span>
      <span className="water__buttons">
        <button
          className="btn btn--quiet btn--icon"
          onClick={() => set(day.water_ml - GLASS_ML)}
          disabled={busy || day.water_ml === 0}
          aria-label="Quitar un vaso de agua"
        >
          −
        </button>
        <button
          className="btn btn--quiet btn--icon"
          onClick={() => set(day.water_ml + GLASS_ML)}
          disabled={busy}
          aria-label="Agregar un vaso de agua"
        >
          +
        </button>
      </span>
    </div>
  );
}

function Meals({ day, onChanged }: { day: DaySummary; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="meals">
      {MEALS.map(([key, label]) => {
        const entries = day.entries.filter((e) => e.meal_type === key);
        // Sumar primero y redondear al final, igual que el total del día.
        const subtotal = Math.round(entries.reduce((sum, e) => sum + e.calories, 0));
        return (
          <div key={key}>
            <div className="meal__head">
              <p className="eyebrow">{label}</p>
              <span className="muted num">{subtotal > 0 ? `${subtotal} kcal` : '—'}</span>
            </div>
            {entries.length > 0 && (
              <ul className="entries">
                {entries.map((e) => (
                  <Entry key={e.id} entry={e} busy={busy === e.id} onChanged={onChanged} setBusy={setBusy} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Fila de entrada. Las porciones se editan en el lugar y se confirman al salir
 * del campo o con Enter, no por tecla: una request por dígito es cara y el
 * teclado móvil dispara muchos eventos intermedios.
 */
function Entry({
  entry,
  busy,
  onChanged,
  setBusy,
}: {
  entry: DaySummary['entries'][number];
  busy: boolean;
  onChanged: () => void;
  setBusy: (id: string | null) => void;
}) {
  const [servings, setServings] = useState(String(entry.servings_consumed));

  // Si el día se recarga por otro motivo, el input sigue al servidor.
  useEffect(() => setServings(String(entry.servings_consumed)), [entry.servings_consumed]);

  async function commit() {
    const value = Number(servings);
    if (!Number.isFinite(value) || value <= 0 || value === entry.servings_consumed) {
      setServings(String(entry.servings_consumed));
      return;
    }
    setBusy(entry.id);
    try {
      await api.patch(`/logs/meal/${entry.id}`, { servings_consumed: value });
      onChanged();
    } catch {
      setServings(String(entry.servings_consumed));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy(entry.id);
    try {
      await api.del(`/logs/meal/${entry.id}`);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="entry">
      <span className="entry__label">
        <span className="entry__name">{entry.food.name}</span>
        {entry.food.brand && <span className="muted"> · {entry.food.brand}</span>}
      </span>
      <span className="entry__right">
        <input
          type="number"
          className="num entry__servings"
          inputMode="decimal"
          step="0.25"
          min="0.01"
          value={servings}
          disabled={busy}
          aria-label={`Porciones de ${entry.food.name}`}
          onChange={(e) => setServings(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className="muted num entry__meta">
          × {entry.food.serving_size_amount}
          {entry.food.serving_size_unit} · {Math.round(entry.calories)} kcal
        </span>
        <button
          type="button"
          className="entry__delete"
          aria-label={`Quitar ${entry.food.name}`}
          disabled={busy}
          onClick={remove}
        >
          Quitar
        </button>
      </span>
    </li>
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
  const [recent, setRecent] = useState<Food[]>([]);

  const loadRecent = useCallback(async () => {
    try {
      setRecent((await api.get<{ data: Food[] }>('/foods/recent')).data);
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // Una búsqueda por pausa de tecleo, no una por tecla.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await api.get<{ data: Food[] }>(`/foods/search?q=${encodeURIComponent(query)}`);
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
      void loadRecent();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'No se pudo registrar', ok: false });
    }
    setBusy(false);
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Buscar alimento"
        aria-label="Buscar alimento"
        style={{ width: '100%' }}
        value={query}
        onChange={(e) => {
          // Solo al tipear: add() también limpia el query, y ahí la
          // confirmación tiene que quedar visible.
          setQuery(e.target.value);
          setMessage(null);
        }}
      />

      {query.trim().length < 2 && (
        <p className="hint">
          {recent.length > 0
            ? 'Lo que registraste antes, o buscá con al menos dos letras.'
            : 'Escribí al menos dos letras. La búsqueda tolera errores de tipeo y no distingue acentos.'}
        </p>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <p className="hint">Sin resultados para “{query}”.</p>
      )}

      <ul className="results">
        {(query.trim().length < 2 ? recent : results).map((f) => (
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
              <span className="muted num result__kcal">
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
        <p
          className={message.ok ? 'alert alert--ok' : 'alert'}
          role="status"
          style={{ marginTop: 'var(--space-md)' }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

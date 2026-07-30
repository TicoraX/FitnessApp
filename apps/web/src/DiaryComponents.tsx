import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { api, formatDateLabel, getWeekDays, MEALS, notificarCambio, shiftDate, today, type DaySummary, type Food } from './api';
import Counter from './components/Counter';
import { BarcodeScanner } from './components/BarcodeScanner';
import InfiniteMenu from './components/InfiniteMenu';
import { NewFood } from './NewFood';

export function CyberDayStrip({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const days = getWeekDays(date);

  return (
    <div
      className="cyber-day-strip"
      aria-label="Barra de calendario"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.4rem 0.6rem',
        marginBottom: '1.25rem',
        boxShadow: 'var(--shadow-card)',
        gap: '0.25rem',
      }}
    >
      <input
        type="date"
        id="date"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        className="visually-hidden"
        aria-label="Fecha"
      />
      <button
        type="button"
        className="btn btn--quiet"
        aria-label="Semana anterior"
        title="Semana anterior"
        style={{ padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}
        onClick={() => setDate(shiftDate(date, -7))}
      >
        ‹‹
      </button>

      <div style={{ display: 'flex', gap: '0.25rem', flex: 1, justifyContent: 'center', overflowX: 'auto' }}>
        {days.map((d) => {
          const isSelected = d.iso === date;
          return (
            <button
              key={d.iso}
              type="button"
              disabled={d.isFuture}
              onClick={() => setDate(d.iso)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem 0.5rem',
                minWidth: '42px',
                borderRadius: 'var(--radius-md)',
                background: isSelected ? 'oklch(0.82 0.22 145 / 0.15)' : 'transparent',
                color: isSelected ? 'var(--color-primary)' : d.isFuture ? 'var(--text-faint)' : 'var(--text-muted)',
                border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                fontWeight: isSelected ? 700 : 500,
                cursor: d.isFuture ? 'not-allowed' : 'pointer',
                opacity: d.isFuture ? 0.35 : 1,
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', opacity: isSelected ? 1 : 0.7 }}>
                {d.dayName}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                {d.dayNum}
              </span>
              {d.isToday && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    width: '12px',
                    height: '2px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary)',
                    boxShadow: '0 0 6px var(--color-primary)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn--quiet"
        aria-label="Semana siguiente"
        title="Semana siguiente"
        disabled={shiftDate(date, 7) > today()}
        style={{
          padding: '0.3rem 0.5rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          opacity: shiftDate(date, 7) > today() ? 0.3 : 1,
        }}
        onClick={() => setDate(shiftDate(date, 7))}
      >
        ››
      </button>
    </div>
  );
}

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
      </div>
    </div>
  );
}

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

const GLASS_ML = 250;

export function Water({
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
      notificarCambio('diario-cambiado');
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
          type="button"
          className="btn btn--quiet btn--icon"
          onClick={() => set(day.water_ml - GLASS_ML)}
          disabled={busy || day.water_ml === 0}
          aria-label="Quitar un vaso de agua"
        >
          −
        </button>
        <button
          type="button"
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

export function Meals({ day, date, onChanged }: { day: DaySummary; date: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copyingMeal, setCopyingMeal] = useState<string | null>(null);

  async function handleCopyYesterday(mealType: string) {
    setCopyingMeal(mealType);
    try {
      const yesterday = shiftDate(date, -1);
      await api.post('/logs/copy', {
        from_date: yesterday,
        to_date: date,
        meal_type: mealType,
      });
      notificarCambio('diario-cambiado');
      onChanged();
    } catch {
      // Ignorar si no había comidas ayer
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

const formatEntryVal = (v: number) => Number(Math.round(v * 100) / 100).toString();

export function Entry({
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
  const [servings, setServings] = useState(() => formatEntryVal(entry.servings_consumed));
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setServings(formatEntryVal(entry.servings_consumed)), [entry.servings_consumed]);

  const isRecipe = entry.kind === 'recipe';

  async function commit() {
    const value = Math.round(Number(servings) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0 || value === entry.servings_consumed) {
      setServings(formatEntryVal(entry.servings_consumed));
      return;
    }
    setBusy(entry.id);
    try {
      if (isRecipe) {
        await api.patch(`/logs/recipe/${entry.id}`, { servings: value });
      } else {
        await api.patch(`/logs/meal/${entry.id}`, { servings_consumed: value });
      }
      notificarCambio('diario-cambiado');
      onChanged();
    } catch {
      setServings(formatEntryVal(entry.servings_consumed));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy(entry.id);
    try {
      if (isRecipe) {
        await api.del(`/logs/recipe/${entry.id}`);
      } else {
        await api.del(`/logs/meal/${entry.id}`);
      }
      notificarCambio('diario-cambiado');
      onChanged();
    } catch {
      setServings(formatEntryVal(entry.servings_consumed));
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="entry" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span
          className="entry__label"
          style={{ cursor: isRecipe ? 'pointer' : 'default' }}
          role={isRecipe ? 'button' : undefined}
          tabIndex={isRecipe ? 0 : undefined}
          onClick={() => isRecipe && setExpanded(!expanded)}
          onKeyDown={(e) => {
            if (isRecipe && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setExpanded(!expanded);
            }
          }}
        >
          <span className="entry__name">
            {isRecipe && (expanded ? '▼ ' : '▶ ')}
            {entry.food.name}
          </span>
          {entry.food.brand && <span className="muted"> · {entry.food.brand}</span>}
          {isRecipe && <span className="badge" style={{ marginLeft: '6px', fontSize: '0.65rem' }}>Receta</span>}
          {entry.kind === 'quick' && <span className="badge" style={{ marginLeft: '6px', fontSize: '0.65rem' }}>Rápido</span>}
        </span>
        <span className="entry__right">
          <input
            type="number"
            className="num entry__servings"
            inputMode="decimal"
            step="0.25"
            min="0"
            value={servings}
            disabled={busy}
            aria-label={`Porciones de ${entry.food.name}`}
            onChange={(e) => setServings(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span className="muted num entry__meta">
            {isRecipe
              ? `× porción · ${Math.round(entry.calories)} kcal`
              : entry.kind === 'quick'
              ? `× registro · ${Math.round(entry.calories)} kcal`
              : `× ${entry.food.serving_size_amount}${entry.food.serving_size_unit} · ${Math.round(entry.calories)} kcal`}
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
      </div>

      {isRecipe && expanded && entry.components && entry.components.length > 0 && (
        <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border-subtle)', fontSize: '0.8rem' }} className="muted num">
          {entry.components.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>• {c.food.name}</span>
              <span>{Math.round(c.calories)} kcal</span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export function AddFood({
  date,
  onAdded,
  searchInputRef,
}: {
  date: string;
  onAdded: () => void;
  searchInputRef?: RefObject<HTMLInputElement>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [servings, setServings] = useState('1');
  const [unitMode, setUnitMode] = useState<string>('serving');
  const [qty, setQty] = useState('1');
  const [meal, setMeal] = useState<string>('breakfast');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [recent, setRecent] = useState<Food[]>([]);
  const [activo, setActivo] = useState(-1);
  const [showScanner, setShowScanner] = useState(false);
  const [showNewFood, setShowNewFood] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickCalories, setQuickCalories] = useState('');
  const [quickProtein, setQuickProtein] = useState('');
  const [quickCarbs, setQuickCarbs] = useState('');
  const [quickFat, setQuickFat] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      
      if ((e.key === '/' && !isInputActive) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        if (searchInputRef?.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchInputRef]);

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cals = Number(quickCalories);
    if (!cals || cals <= 0) {
      setMessage({ text: 'Ingresá una cantidad de calorías válida.', ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        log_date: date,
        meal_type: meal,
        name: quickName.trim() || 'Registro rápido',
        calories: cals,
      };
      if (quickProtein) payload.protein = Number(quickProtein);
      if (quickCarbs) payload.carbohydrates = Number(quickCarbs);
      if (quickFat) payload.fat = Number(quickFat);

      await api.post('/logs/quick', payload);
      setMessage({ text: 'Registro rápido agregado con éxito.', ok: true });
      setShowQuickAdd(false);
      setQuickName('');
      setQuickCalories('');
      setQuickProtein('');
      setQuickCarbs('');
      setQuickFat('');
      notificarCambio('diario-cambiado');
      onAdded();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'No se pudo agregar', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const visibles = query.trim().length < 2 ? recent : results;

  useEffect(() => setActivo(-1), [query, results, recent]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await api.get<{ data: Food[] }>('/foods/recent');
      if (res.data && res.data.length > 0) {
        setRecent(res.data);
      } else {
        const cat = await api.get<{ data: Food[] }>('/foods/search?q=a');
        setRecent(cat.data ? cat.data.slice(0, 8) : []);
      }
    } catch {
      try {
        const cat = await api.get<{ data: Food[] }>('/foods/search?q=a');
        setRecent(cat.data ? cat.data.slice(0, 8) : []);
      } catch {
        setRecent([]);
      }
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    setShowScanner(false);
    setMessage(null);
    try {
      const res = await api.get<{ data: Food }>(`/foods/barcode/${encodeURIComponent(barcode)}`);
      handleSelectFood(res.data);
      setMessage({ text: `Alimento encontrado por código de barras: ${res.data.name}`, ok: true });
    } catch {
      setQuery(barcode);
      setMessage({ text: `Código ${barcode} no encontrado. Podés darlo de alta.`, ok: false });
    }
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    // Si la búsqueda es un código de barras numérico (8-14 dígitos)
    if (/^\d{8,14}$/.test(query.trim())) {
      const id = setTimeout(() => void handleBarcodeDetected(query.trim()), 300);
      return () => clearTimeout(id);
    }

    const id = setTimeout(async () => {
      try {
        const res = await api.get<{ data: Food[] }>(`/foods/search?q=${encodeURIComponent(query)}`);
        setResults((prev) => {
          if (prev.length === 0 && res.data.length === 0) return prev;
          return res.data;
        });
      } catch {
        setResults((prev) => (prev.length === 0 ? prev : []));
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query, handleBarcodeDetected]);

  const handleSelectFood = (food: Food) => {
    setSelected(food);
    setUnitMode('serving');
    setQty('1');
    setServings('1');
  };

  async function add() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    const finalServings = Math.round(Number(servings) * 1000) / 1000;
    try {
      await api.post('/logs/meal', {
        log_date: date,
        meal_type: meal,
        food_item_id: selected.id,
        servings_consumed: finalServings,
      });
      setMessage({ text: `${selected.name} registrado.`, ok: true });
      setSelected(null);
      setQuery('');
      setServings('1');
      setQty('1');
      setUnitMode('serving');
      setResults([]);
      notificarCambio('diario-cambiado');
      onAdded();
      void loadRecent();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'No se pudo registrar', ok: false });
    }
    setBusy(false);
  }

  return (
    <div>
      {/* Selector accesible para Playwright y lectores de pantalla */}
      <select
        id="meal-select"
        aria-label="Comida"
        value={meal}
        onChange={(e) => setMeal(e.target.value)}
        className="visually-hidden"
      >
        {MEALS.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      <div
        className="meal-selector-strip"
        style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '3px',
          gap: '3px',
          marginBottom: 'var(--space-md)',
        }}
      >
        {MEALS.map(([key, label]) => {
          const isSelected = meal === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMeal(key)}
              style={{
                flex: 1,
                padding: '0.45rem 0.2rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: isSelected ? 700 : 500,
                borderRadius: 'var(--radius-sm)',
                background: isSelected ? 'var(--color-primary)' : 'transparent',
                color: isSelected ? 'oklch(0.12 0 0)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-sm)' }}>
        <button
          type="button"
          className="btn btn--quiet"
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          onClick={() => setShowQuickAdd(!showQuickAdd)}
        >
          {showQuickAdd ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Cancelar registro rápido
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Registro rápido (Calorías directas)
            </span>
          )}
        </button>
      </div>

      {showQuickAdd && (
        <form onSubmit={handleQuickSubmit} className="card" style={{ marginBottom: 'var(--space-md)', background: 'var(--bg-elevated)', padding: '1rem' }}>
          <p className="eyebrow" style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }}>Registro Rápido de Calorías</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              placeholder="Descripción (ej: Almuerzo afuera)"
              aria-label="Descripción del registro rápido"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              style={{ gridColumn: '1 / -1' }}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Calorías *"
              aria-label="Calorías del registro rápido"
              required
              min="1"
              value={quickCalories}
              onChange={(e) => setQuickCalories(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Proteína (g) - Opcional"
              aria-label="Proteína opcional"
              min="0"
              value={quickProtein}
              onChange={(e) => setQuickProtein(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Carbos (g) - Opcional"
              aria-label="Carbohidratos opcionales"
              min="0"
              value={quickCarbs}
              onChange={(e) => setQuickCarbs(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Grasas (g) - Opcional"
              aria-label="Grasas opcionales"
              min="0"
              value={quickFat}
              onChange={(e) => setQuickFat(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <button type="submit" className="btn btn--block" disabled={busy}>
            {busy ? 'Guardando...' : 'Agregar Registro Rápido'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: 'var(--space-xs)' }}>
        <input
          ref={searchInputRef}
          type="search"
          placeholder="Buscar alimento o código (⌘K o /)..."
          aria-label="Buscar alimento"
          role="combobox"
          aria-expanded={visibles.length > 0}
          aria-controls="resultados-busqueda"
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `alimento-${visibles[activo].id}` : undefined}
          style={{ flex: 1 }}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMessage(null);
          }}
          onKeyDown={(e) => {
            if (visibles.length === 0) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const paso = e.key === 'ArrowDown' ? 1 : -1;
              setActivo((i) => (i + paso + visibles.length) % visibles.length);
            } else if (e.key === 'Enter' && activo >= 0) {
              e.preventDefault();
              handleSelectFood(visibles[activo]);
            } else if (e.key === 'Escape') {
              setActivo(-1);
              setSelected(null);
            }
          }}
        />
        <button
          type="button"
          className="btn btn--quiet"
          aria-label="Escanear código de barras"
          title="Escanear código de barras (Cámara / EAN-13)"
          onClick={() => setShowScanner(true)}
          style={{ padding: '0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="4" y2="18" strokeWidth="2.5" />
            <line x1="8" y1="6" x2="8" y2="18" strokeWidth="1.5" />
            <line x1="11" y1="6" x2="11" y2="18" strokeWidth="2.5" />
            <line x1="15" y1="6" x2="15" y2="18" strokeWidth="1.5" />
            <line x1="19" y1="6" x2="19" y2="18" strokeWidth="2.5" />
            <line x1="2" y1="12" x2="22" y2="12" stroke="var(--color-primary)" strokeWidth="2" />
          </svg>
        </button>
      </div>

      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      <p className="visually-hidden" role="status">
        {query.trim().length >= 2 &&
          (results.length > 0 ? `${results.length} resultados` : 'Sin resultados')}
      </p>

      {message && (
        <p className={message.ok ? 'alert alert--ok' : 'alert'} role="status">
          {message.text}
        </p>
      )}

      {query.trim().length < 2 && recent.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <p className="hint muted" style={{ marginTop: 'var(--space-xs)', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
            Comidas que registraste antes:
          </p>
          <InfiniteMenu
            items={recent.map((f) => ({
              title: f.name,
              description: `${f.calories} kcal / ${f.serving_size_amount}${f.serving_size_unit}`,
              onClick: () => handleSelectFood(f),
            }))}
          />
        </div>
      )}

      {query.trim().length >= 2 && results.length > 0 && (
        <ul id="resultados-busqueda" className="results" role="listbox" aria-label="Resultados de búsqueda">
          {results.map((f, i) => (
            <li
              key={f.id}
              id={`alimento-${f.id}`}
              role="option"
              className="result"
              aria-selected={selected?.id === f.id}
              data-activo={i === activo}
              onClick={() => handleSelectFood(f)}
            >
              <span>
                {f.name}
                {f.brand && <span className="muted"> · {f.brand}</span>}
              </span>
              <span className="muted num result__kcal">
                {f.calories} kcal / {f.serving_size_amount}
                {f.serving_size_unit}
              </span>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <p className="muted" style={{ marginBottom: 'var(--space-xs)' }}>
            No encontramos &ldquo;{query}&rdquo;. Podés darlo de alta para usarlo hoy y que le quede a la comunidad.
          </p>
          <NewFood name={query} onCreated={(food) => handleSelectFood(food)} />
        </div>
      )}

      {selected && (
        <div className="food-preview" style={{ marginTop: 'var(--space-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-xs)' }}>
            <div>
              <strong style={{ fontSize: 'var(--text-base)', display: 'block', color: 'var(--text-main)' }}>{selected.name}</strong>
              {selected.brand && <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{selected.brand}</span>}
            </div>
            <span className="num" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(selected.calories * (Number(servings) || 1))} kcal
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: '2px' }} className="muted" htmlFor="unit-mode-select">
                Unidad de medida
              </label>
              <select
                id="unit-mode-select"
                value={unitMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  setUnitMode(mode);
                  if (mode === 'serving') {
                    setQty('1');
                    setServings('1');
                  } else if (mode === '100g') {
                    setQty('100');
                    setServings((100 / selected.serving_size_amount).toFixed(3));
                  } else if (mode === 'unit') {
                    setQty(String(selected.serving_size_amount));
                    setServings('1');
                  }
                }}
                aria-label="Unidad de medida"
                style={{ fontSize: 'var(--text-sm)', width: '100%', fontFamily: 'var(--font-mono)' }}
              >
                <option value="serving">1 porción ({selected.serving_size_amount} {selected.serving_size_unit})</option>
                {selected.serving_size_unit === 'g' || selected.serving_size_unit === 'ml' ? (
                  <>
                    <option value="100g">100 {selected.serving_size_unit}</option>
                    <option value="unit">1 {selected.serving_size_unit} (balanza)</option>
                  </>
                ) : null}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: '2px' }} className="muted" htmlFor="quantity-input">
                Cantidad ({unitMode === 'serving' ? 'porciones' : selected.serving_size_unit})
              </label>
              <input
                id="quantity-input"
                type="number"
                className="num"
                step={unitMode === 'serving' ? '0.25' : '1'}
                min="0"
                value={qty}
                onChange={(e) => {
                  const val = e.target.value;
                  setQty(val);
                  const numVal = Number(val);
                  if (unitMode === 'serving') {
                    setServings(val);
                  } else if (unitMode === '100g') {
                    setServings((numVal / selected.serving_size_amount).toFixed(3));
                  } else if (unitMode === 'unit') {
                    setServings((numVal / selected.serving_size_amount).toFixed(3));
                  }
                }}
                aria-label="Porciones"
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              />
            </div>
          </div>

          <div className="nutrition-preview" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-2xs)', textAlign: 'center', padding: '0.4rem 0', marginBottom: 'var(--space-sm)' }}>
            <div>
              <span className="muted" style={{ fontSize: '0.65rem', display: 'block', fontFamily: 'var(--font-mono)' }}>PRO</span>
              <strong className="num" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-protein)' }}>
                {(selected.protein * (Number(servings) || 1)).toFixed(1)}g
              </strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.65rem', display: 'block', fontFamily: 'var(--font-mono)' }}>CHO</span>
              <strong className="num" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-carbs)' }}>
                {(selected.carbohydrates * (Number(servings) || 1)).toFixed(1)}g
              </strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.65rem', display: 'block', fontFamily: 'var(--font-mono)' }}>FAT</span>
              <strong className="num" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fats)' }}>
                {(selected.fat * (Number(servings) || 1)).toFixed(1)}g
              </strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.65rem', display: 'block', fontFamily: 'var(--font-mono)' }}>FIB</span>
              <strong className="num" style={{ fontSize: 'var(--text-sm)' }}>
                {((selected.fiber || 0) * (Number(servings) || 1)).toFixed(1)}g
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'flex-end' }}>
            <button className="btn btn--quiet" type="button" onClick={() => setSelected(null)}>
              Cancelar
            </button>
            <button className="btn" type="button" disabled={busy} onClick={add}>
              {busy ? 'Guardando' : 'Agregar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

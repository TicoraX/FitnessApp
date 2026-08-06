import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api, getCacheado, invalidarCache, MEALS, notificarCambio, type Food } from '../../api';
import { useVisible } from '../../hooks/useVisible';
import { BarcodeScanner } from '../BarcodeScanner';
import InfiniteMenu from '../InfiniteMenu';
import { NewFood } from '../../NewFood';
import { ErrorConReintento } from '../ErrorConReintento';
import { teclaModificadora } from '../../hooks/useTeclaModificadora';

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
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [tab, setTab] = useState<'recent' | 'favorites'>('recent');
  /**
   * Sin esto, un fallo de red se lee como un catálogo vacío: la lista de
   * sugerencias dice "todavía no registraste nada" y la búsqueda ofrece dar de
   * alta un alimento que ya existe. Lo segundo no solo desinforma, ensucia el
   * catálogo con duplicados.
   */
  const [falloSugeridos, setFalloSugeridos] = useState(false);
  const [falloBusqueda, setFalloBusqueda] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [showScanner, setShowScanner] = useState(false);
  const [showNewFood, setShowNewFood] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickCalories, setQuickCalories] = useState('');
  const [quickProtein, setQuickProtein] = useState('');
  const [quickCarbs, setQuickCarbs] = useState('');
  const [quickFat, setQuickFat] = useState('');
  /**
   * El panel entero, con sus recientes y favoritos, no se pide hasta que asoma.
   * En el teléfono arranca abajo del pliegue: entrar al diario disparaba tres
   * pedidos de algo que el usuario todavía no estaba mirando.
   */
  const [refPanel, panelVisible] = useVisible<HTMLDivElement>();

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

  const sugeridos = tab === 'favorites' ? favorites : recent;
  const visibles = query.trim().length < 2 ? sugeridos : results;
  const itemActivo = activo >= 0 && activo < visibles.length ? visibles[activo] : undefined;

  useEffect(() => setActivo(-1), [query, results, sugeridos]);

  const loadFavorites = useCallback(async () => {
    try {
      setFavorites((await getCacheado<{ data: Food[] }>('/foods/favorites')).data ?? []);
      setFalloSugeridos(false);
    } catch {
      setFalloSugeridos(true);
    }
  }, []);

  useEffect(() => {
    if (panelVisible) void loadFavorites();
  }, [loadFavorites, panelVisible]);

  const esFavorito = (id: string) => favorites.some((f) => f.id === id);

  async function toggleFavorito(food: Food) {
    // Optimista: marcar es un gesto de un toque y esperar el round-trip para
    // pintar la estrella se siente roto.
    const marcado = esFavorito(food.id);
    setFavorites((prev) => (marcado ? prev.filter((f) => f.id !== food.id) : [food, ...prev]));
    try {
      if (marcado) await api.del(`/foods/${food.id}/favorite`);
      else await api.put(`/foods/${food.id}/favorite`, {});
      invalidarCache('/foods/favorites');
    } catch {
      void loadFavorites();
    }
  }

  const loadRecent = useCallback(async () => {
    try {
      const res = await getCacheado<{ data: Food[] }>('/foods/recent');
      if (res.data && res.data.length > 0) {
        setRecent(res.data);
      } else {
        const cat = await api.get<{ data: Food[] }>('/foods/search?q=a');
        setRecent(cat.data ? cat.data.slice(0, 8) : []);
      }
      setFalloSugeridos(false);
    } catch {
      try {
        const cat = await api.get<{ data: Food[] }>('/foods/search?q=a');
        setRecent(cat.data ? cat.data.slice(0, 8) : []);
        setFalloSugeridos(false);
      } catch {
        setFalloSugeridos(true);
      }
    }
  }, []);

  useEffect(() => {
    if (panelVisible) void loadRecent();
  }, [loadRecent, panelVisible]);

  const latestQueryRef = useRef(query);
  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  /**
   * Aparte del efecto que la dispara, para que el botón de reintentar pueda
   * volver a llamarla sin tocar el texto buscado.
   */
  const buscar = useCallback(async () => {
    const activeQuery = query;
    try {
      const res = await api.get<{ data: Food[] }>(`/foods/search?q=${encodeURIComponent(query)}`);
      if (activeQuery !== latestQueryRef.current) return;
      setResults((prev) => {
        if (prev.length === 0 && res.data.length === 0) return prev;
        return res.data;
      });
      setFalloBusqueda(false);
    } catch {
      if (activeQuery !== latestQueryRef.current) return;
      // Los resultados viejos quedan: son de otra búsqueda, pero borrarlos
      // dejaría la pantalla afirmando que este alimento no existe.
      setFalloBusqueda(true);
    }
  }, [query]);

  const handleSelectFood = useCallback((food: Food) => {
    setSelected(food);
    setUnitMode('serving');
    setQty('1');
    setServings('1');
  }, []);

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
  }, [handleSelectFood]);

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

    const id = setTimeout(() => void buscar(), 250);
    return () => clearTimeout(id);
  }, [query, handleBarcodeDetected, buscar]);

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
      // Lo que se acaba de registrar entra en recientes: sin tirar el cacheado,
      // la lista quedaría con la foto anterior hasta cerrar la pestaña.
      invalidarCache('/foods/recent');
      void loadRecent();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'No se pudo registrar', ok: false });
    }
    setBusy(false);
  }

  return (
    <div ref={refPanel}>
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
                transition: 'all var(--dur-state) var(--ease-out)',
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
              placeholder={`Buscar alimento o código (${teclaModificadora()}K o /)...`}
              aria-label="Buscar alimento"
              role="combobox"
              aria-expanded={visibles.length > 0}
              aria-controls="resultados-busqueda"
              aria-autocomplete="list"
              aria-activedescendant={itemActivo?.id ? `alimento-${itemActivo.id}` : undefined}
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
                } else if (e.key === 'Enter' && itemActivo) {
                  e.preventDefault();
                  handleSelectFood(itemActivo);
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

      {query.trim().length < 2 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div className="food-tabs" role="tablist" aria-label="Sugerencias">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'recent'}
              className="btn btn--quiet"
              onClick={() => setTab('recent')}
            >
              Recientes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'favorites'}
              className="btn btn--quiet"
              onClick={() => setTab('favorites')}
            >
              Favoritos{favorites.length > 0 && ` (${favorites.length})`}
            </button>
          </div>

          {sugeridos.length > 0 ? (
            <InfiniteMenu
              items={sugeridos.map((f) => ({
                title: f.name,
                description: `${f.calories} kcal / ${f.serving_size_amount}${f.serving_size_unit}`,
                onClick: () => handleSelectFood(f),
              }))}
            />
          ) : falloSugeridos ? (
            <ErrorConReintento
              mensaje="No se pudieron cargar las sugerencias."
              onReintentar={() => (tab === 'favorites' ? loadFavorites() : loadRecent())}
            />
          ) : (
            <p className="hint muted" style={{ fontSize: '0.75rem' }}>
              {tab === 'favorites'
                ? 'Marcá un alimento con la estrella para tenerlo acá.'
                : 'Todavía no registraste nada.'}
            </p>
          )}
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
      {query.trim().length >= 2 && falloBusqueda && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <ErrorConReintento mensaje="No se pudo buscar." onReintentar={buscar} />
        </div>
      )}
      {query.trim().length >= 2 && !falloBusqueda && results.length === 0 && (
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
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <span className="num" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                {Math.round(selected.calories * (Number(servings) || 1))} kcal
              </span>
              <button
                type="button"
                className="btn btn--quiet btn--icon food-fav"
                aria-pressed={esFavorito(selected.id)}
                aria-label={esFavorito(selected.id) ? 'Quitar de favoritos' : 'Marcar como favorito'}
                onClick={() => toggleFavorito(selected)}
              >
                {/* Estrella SVG, no un emoji: el proyecto no usa emojis en la UI. */}
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z"
                    fill={esFavorito(selected.id) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
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

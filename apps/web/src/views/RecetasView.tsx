import { useCallback, useEffect, useState } from 'react';
import { api, notificarCambio, today, type Food, type Recipe } from '../api';
import InfiniteMenu from '../components/InfiniteMenu';

interface SelectedIngredient {
  food: Food;
  quantity: number;
}

const RECIPE_IDEAS: Recipe[] = [
  {
    id: 'idea-1',
    name: 'Wok de Pollo Fit con Vegetales',
    total_servings: 2,
    per_serving: { calories: 380, protein_g: 42, carbs_g: 28, fat_g: 10 },
    components: [
      { food_item_id: '1', quantity: 200, food: { id: 'f1', name: 'Pechuga de Pollo', brand: null, serving_size_amount: 100, serving_size_unit: 'g' } },
      { food_item_id: '2', quantity: 150, food: { id: 'f2', name: 'Vegetales Mixtos', brand: null, serving_size_amount: 100, serving_size_unit: 'g' } }
    ]
  },
  {
    id: 'idea-2',
    name: 'Bowl Proteico de Avena y Plátano',
    total_servings: 1,
    per_serving: { calories: 420, protein_g: 30, carbs_g: 58, fat_g: 8 },
    components: [
      { food_item_id: '3', quantity: 60, food: { id: 'f3', name: 'Avena en Hojuelas', brand: null, serving_size_amount: 100, serving_size_unit: 'g' } },
      { food_item_id: '4', quantity: 30, food: { id: 'f4', name: 'Proteína Whey', brand: null, serving_size_amount: 30, serving_size_unit: 'g' } }
    ]
  },
  {
    id: 'idea-3',
    name: 'Omelette Fit de Claras y Espinaca',
    total_servings: 1,
    per_serving: { calories: 240, protein_g: 32, carbs_g: 6, fat_g: 9 },
    components: [
      { food_item_id: '5', quantity: 200, food: { id: 'f5', name: 'Claras de Huevo', brand: null, serving_size_amount: 100, serving_size_unit: 'g' } },
      { food_item_id: '6', quantity: 50, food: { id: 'f6', name: 'Queso Magro', brand: null, serving_size_amount: 50, serving_size_unit: 'g' } }
    ]
  }
];

export function RecetasView() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Modal / Form state para crear receta
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [totalServings, setTotalServings] = useState('2');
  const [ingredients, setIngredients] = useState<SelectedIngredient[]>([]);
  const [foodQuery, setFoodQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [busy, setBusy] = useState(false);
  /** Id de la receta cuya tarjeta está pidiendo confirmación para borrarse. */
  const [confirmandoBorrar, setConfirmandoBorrar] = useState<string | null>(null);

  // Modal para registrar receta en el diario
  const [loggingRecipe, setLoggingRecipe] = useState<Recipe | null>(null);
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [recipeServings, setRecipeServings] = useState('1');

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get<{ data: Recipe[] }>('/recipes');
      setRecipes(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las recetas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  // Búsqueda de ingredientes para crear receta
  useEffect(() => {
    if (foodQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await api.get<{ data: Food[] }>(`/foods/search?q=${encodeURIComponent(foodQuery)}`);
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [foodQuery]);

  const handleAddIngredient = (food: Food) => {
    if (ingredients.some((i) => i.food.id === food.id)) return;
    setIngredients((prev) => [...prev, { food, quantity: 1 }]);
    setFoodQuery('');
    setSearchResults([]);
  };

  const handleRemoveIngredient = (foodId: string) => {
    setIngredients((prev) => prev.filter((i) => i.food.id !== foodId));
  };

  const handleUpdateQuantity = (foodId: string, qty: number) => {
    setIngredients((prev) =>
      prev.map((i) => (i.food.id === foodId ? { ...i, quantity: Math.max(0.1, qty) } : i)),
    );
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName.trim()) {
      setError('El nombre de la receta es obligatorio.');
      return;
    }
    if (ingredients.length === 0) {
      setError('Agregá al menos un ingrediente a la receta.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api.post('/recipes', {
        name: recipeName.trim(),
        total_servings: Number(totalServings) || 1,
        components: ingredients.map((i) => ({
          food_item_id: i.food.id,
          quantity: i.quantity,
        })),
      });

      setMessage({ text: `Receta "${recipeName}" creada con éxito.`, ok: true });
      setShowCreateModal(false);
      setRecipeName('');
      setTotalServings('2');
      setIngredients([]);
      void loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la receta');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Confirmación en dos pasos sobre la propia tarjeta, en vez del confirm() del
   * navegador: aquel bloquea el hilo, no se puede estilar, y en móvil aparece
   * como un cartel del sistema que no se parece en nada al resto de la app. Es
   * el único lugar que lo usaba.
   */
  const handleDeleteRecipe = async (id: string, name: string) => {
    setConfirmandoBorrar(null);
    try {
      await api.del(`/recipes/${id}`);
      setMessage({ text: `Receta "${name}" eliminada.`, ok: true });
      void loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  const handleLogRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingRecipe) return;
    setBusy(true);
    try {
      await api.post('/logs/recipe', {
        log_date: today(),
        meal_type: selectedMeal,
        recipe_id: loggingRecipe.id,
        servings: Number(recipeServings) || 1,
      });
      notificarCambio('diario-cambiado');
      setMessage({ text: `Registrado en el diario: ${loggingRecipe.name}`, ok: true });
      setLoggingRecipe(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar receta');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view-recetas stack" style={{ gap: 'var(--space-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="card__title">Catálogo de Recetas</h2>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Platos preparados y preparaciones multitaza calculados por porción.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setShowCreateModal(true)}>
          + Crear Receta
        </button>
      </div>

      {message && (
        <p className={message.ok ? 'alert alert--ok' : 'alert'} role="status">
          {message.text}
        </p>
      )}

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">Cargando recetas...</p>
      ) : recipes.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '0.4rem' }}>
              Ideas & Inspiración de Recetas
            </span>
            <InfiniteMenu
              items={RECIPE_IDEAS.map((r) => {
                const ingNames = r.components?.map(c => c.food?.name).filter(Boolean).join(', ');
                return {
                  title: r.name,
                  description: ingNames ? `${Math.round(r.per_serving.calories)} kcal · ${ingNames}` : `${Math.round(r.per_serving.calories)} kcal / porción`,
                  onClick: () => setShowCreateModal(true),
                };
              })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
            {RECIPE_IDEAS.map((r) => (
              <div key={r.id} className="card card--raised" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)' }}>{r.name}</h3>
                    <span className="badge">{r.total_servings} porciones</span>
                  </div>
                  <div className="num" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                    {Math.round(r.per_serving.calories)} kcal <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ porción</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }} className="num">
                    <span>P: {Math.round(r.per_serving.protein_g)}g</span>
                    <span>C: {Math.round(r.per_serving.carbs_g)}g</span>
                    <span>G: {Math.round(r.per_serving.fat_g)}g</span>
                  </div>

                  {r.components && r.components.length > 0 && (
                    <div style={{ marginTop: '0.5rem', marginBottom: '0.75rem', fontSize: '0.8rem', background: 'var(--bg-surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span className="eyebrow" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '0.3rem', display: 'block' }}>
                        Ingredientes ({r.components.length})
                      </span>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {r.components.map((c, idx) => (
                          <li key={c.food_item_id || idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontSize: '0.75rem' }}>
                            <span>• {c.food?.name || 'Ingrediente'}</span>
                            <span className="num muted">{c.quantity} × {c.food?.serving_size_amount || 100}{c.food?.serving_size_unit || 'g'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: '1rem', width: '100%' }}
                  onClick={() => setShowCreateModal(true)}
                >
                  + Crear Mi Propia Receta
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <span className="eyebrow" style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '0.4rem' }}>
              Destacadas & Selección Rápida
            </span>
            <InfiniteMenu
              items={recipes.map((r) => {
                const ingNames = r.components?.map(c => c.food?.name).filter(Boolean).join(', ');
                return {
                  title: r.name,
                  description: ingNames ? `${Math.round(r.per_serving.calories)} kcal · ${ingNames}` : `${Math.round(r.per_serving.calories)} kcal / porción`,
                  onClick: () => setLoggingRecipe(r),
                };
              })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
          {recipes.map((r) => (
            <div key={r.id} className="card card--raised" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)' }}>{r.name}</h3>
                  <span className="badge">{r.total_servings} porciones</span>
                </div>
                <div className="num" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                  {Math.round(r.per_serving.calories)} kcal <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ porción</span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }} className="num">
                  <span>P: {Math.round(r.per_serving.protein_g)}g</span>
                  <span>C: {Math.round(r.per_serving.carbs_g)}g</span>
                  <span>G: {Math.round(r.per_serving.fat_g)}g</span>
                </div>

                {r.components && r.components.length > 0 && (
                  <div style={{ marginTop: '0.5rem', marginBottom: '0.75rem', fontSize: '0.8rem', background: 'var(--bg-surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <span className="eyebrow" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '0.3rem', display: 'block' }}>
                      Ingredientes ({r.components.length})
                    </span>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {r.components.map((c, idx) => (
                        <li key={c.id || idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontSize: '0.75rem' }}>
                          <span>• {c.food?.name || 'Ingrediente'}</span>
                          <span className="num muted">{c.quantity} × {c.food?.serving_size_amount || 1}{c.food?.serving_size_unit || 'g'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => setLoggingRecipe(r)}
                >
                  + Al Diario
                </button>
                {confirmandoBorrar === r.id ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'var(--color-danger)' }}
                      onClick={() => handleDeleteRecipe(r.id, r.name)}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet"
                      onClick={() => setConfirmandoBorrar(null)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn--quiet"
                    aria-label={`Borrar la receta ${r.name}`}
                    onClick={() => setConfirmandoBorrar(r.id)}
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Modal para Crear Receta */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onSubmit={handleCreateRecipe} className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="card__title">Nueva Receta</h3>
              <button type="button" className="btn btn--quiet" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.2rem' }}>Nombre de la receta</label>
                <input
                  type="text"
                  placeholder="Ej: Guiso de lentejas"
                  required
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.2rem' }}>Rinde porciones totales</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={totalServings}
                  onChange={(e) => setTotalServings(e.target.value)}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <hr style={{ borderColor: 'var(--border-subtle)', margin: '0.5rem 0' }} />

              <p className="eyebrow" style={{ color: 'var(--color-primary)' }}>Ingredientes de la receta</p>

              <div style={{ position: 'relative' }}>
                <input
                  type="search"
                  placeholder="Buscar ingrediente para agregar..."
                  value={foodQuery}
                  onChange={(e) => setFoodQuery(e.target.value)}
                  style={{ width: '100%' }}
                />

                {searchResults.length > 0 && (
                  <ul className="results" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', maxHeight: '180px', overflowY: 'auto' }}>
                    {searchResults.map((f) => (
                      <li key={f.id} className="result" onClick={() => handleAddIngredient(f)}>
                        <span>{f.name}</span>
                        <span className="num muted">{f.calories} kcal / {f.serving_size_amount}{f.serving_size_unit}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {ingredients.length > 0 ? (
                <ul className="entries" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {ingredients.map((ing) => (
                    <li key={ing.food.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <strong>{ing.food.name}</strong>
                        <div className="num muted" style={{ fontSize: '0.75rem' }}>
                          {Math.round(ing.food.calories * ing.quantity)} kcal
                        </div>
                      </div>
                      {/* step="any": con step="0.25" y min="0.1" los únicos
                          valores válidos eran 0.1, 0.35, 0.6, 0.85... y la
                          cantidad por defecto es 1, que no está entre ellos. El
                          navegador rechazaba el envío y no se podía crear
                          ninguna receta. */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          style={{ width: '60px', padding: '0.2rem', fontFamily: 'var(--font-mono)' }}
                          value={ing.quantity}
                          onChange={(e) => handleUpdateQuantity(ing.food.id, Number(e.target.value))}
                        />
                        <button type="button" className="entry__delete" onClick={() => handleRemoveIngredient(ing.food.id)}>Quitar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ fontSize: '0.8rem' }}>Buscá e ingresá los alimentos que componen la receta.</p>
              )}
            </div>

            <button type="submit" className="btn btn--block" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar Receta'}
            </button>
          </form>
        </div>
      )}

      {/* Modal para Registrar Receta en el Diario */}
      {loggingRecipe && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onSubmit={handleLogRecipe} className="card" style={{ width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="card__title">Registrar Receta</h3>
              <button type="button" className="btn btn--quiet" onClick={() => setLoggingRecipe(null)}>✕</button>
            </div>

            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{loggingRecipe.name}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.2rem' }}>Comida</label>
                <select value={selectedMeal} onChange={(e) => setSelectedMeal(e.target.value)} style={{ width: '100%' }}>
                  <option value="breakfast">Desayuno</option>
                  <option value="lunch">Almuerzo</option>
                  <option value="dinner">Cena</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.2rem' }}>Porciones consumidas</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={recipeServings}
                  onChange={(e) => setRecipeServings(e.target.value)}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div className="num" style={{ fontSize: '1rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                Total: {Math.round(loggingRecipe.per_serving.calories * (Number(recipeServings) || 1))} kcal
              </div>
            </div>

            <button type="submit" className="btn btn--block" disabled={busy}>
              {busy ? 'Registrando...' : 'Confirmar en el Diario'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

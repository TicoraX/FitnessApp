import { useCallback, useEffect, useState } from 'react';
import { api, notificarCambio, today, type Food, type Recipe } from '../api';
import InfiniteMenu from '../components/InfiniteMenu';
import { FlowingMenu } from '../components/FlowingMenu';

interface SelectedIngredient {
  food: Food;
  quantity: number;
}

const RECIPE_IDEAS: Recipe[] = [
  {
    id: 'idea-1',
    name: 'Wok de Pollo Fit con Vegetales',
    kind: 'recipe' as const,
    total_servings: 2,
    per_serving: { calories: 380, protein_g: 42, carbs_g: 28, fat_g: 10 },
    components: [
      { food_item_id: '1', quantity: 2, food: { id: 'f1', name: 'Pechuga de Pollo', brand: null, serving_size_amount: 100, serving_size_unit: 'g', calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, verified: true } },
      { food_item_id: '2', quantity: 1.5, food: { id: 'f2', name: 'Vegetales Mixtos', brand: null, serving_size_amount: 100, serving_size_unit: 'g', calories: 35, protein: 2.4, carbohydrates: 7.2, fat: 0.4, verified: true } }
    ]
  },
  {
    id: 'idea-2',
    name: 'Bowl Proteico de Avena y Plátano',
    kind: 'recipe' as const,
    total_servings: 1,
    per_serving: { calories: 420, protein_g: 30, carbs_g: 58, fat_g: 8 },
    components: [
      { food_item_id: '3', quantity: 1, food: { id: 'f3', name: 'Avena en Hojuelas', brand: null, serving_size_amount: 60, serving_size_unit: 'g', calories: 228, protein: 8, carbohydrates: 40, fat: 4, verified: true } },
      { food_item_id: '4', quantity: 1, food: { id: 'f4', name: 'Proteína Whey', brand: null, serving_size_amount: 30, serving_size_unit: 'g', calories: 120, protein: 24, carbohydrates: 3, fat: 1.5, verified: true } }
    ]
  },
  {
    id: 'idea-3',
    name: 'Omelette Fit de Claras y Espinaca',
    kind: 'recipe' as const,
    total_servings: 1,
    per_serving: { calories: 240, protein_g: 32, carbs_g: 6, fat_g: 9 },
    components: [
      { food_item_id: '5', quantity: 2, food: { id: 'f5', name: 'Claras de Huevo', brand: null, serving_size_amount: 100, serving_size_unit: 'g', calories: 102, protein: 21.6, carbohydrates: 1.2, fat: 0.6, verified: true } },
      { food_item_id: '6', quantity: 1, food: { id: 'f6', name: 'Queso Magro', brand: null, serving_size_amount: 50, serving_size_unit: 'g', calories: 100, protein: 11, carbohydrates: 1, fat: 6, verified: true } }
    ]
  }
];

export function RecetasView() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Modal / Form state para crear/editar receta
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [totalServings, setTotalServings] = useState('2');
  const [kind, setKind] = useState<'recipe' | 'meal'>('recipe');
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

  // Abrir modal en modo edicion
  const handleEditRecipe = (r: Recipe) => {
    setEditingRecipe(r);
    setRecipeName(r.name);
    setKind(r.kind ?? 'recipe');
    setTotalServings(String(r.total_servings || 1));
    setIngredients(
      r.components?.map((c) => ({
        food: c.food || { id: c.food_item_id, name: 'Ingrediente', brand: null, serving_size_amount: 100, serving_size_unit: 'g', calories: 100, protein: 10, carbohydrates: 10, fat: 2, verified: true },
        quantity: c.quantity,
      })) || []
    );
    setDetailRecipe(null);
    setShowCreateModal(true);
  };

  // Clonar / Personalizar idea de receta recomendada
  const handleCloneIdea = (idea: Recipe) => {
    setEditingRecipe(null);
    setRecipeName(idea.name);
    setTotalServings(String(idea.total_servings || 1));
    setIngredients(
      idea.components?.map((c) => ({
        food: c.food || { id: c.food_item_id, name: 'Ingrediente', brand: null, serving_size_amount: 100, serving_size_unit: 'g', calories: 100, protein: 10, carbohydrates: 10, fat: 2, verified: true },
        quantity: c.quantity,
      })) || []
    );
    setDetailRecipe(null);
    setShowCreateModal(true);
  };

  const handleOpenCreateNew = () => {
    setEditingRecipe(null);
    setRecipeName('');
    setKind('recipe');
    setTotalServings('2');
    setIngredients([]);
    setShowCreateModal(true);
  };

  // Búsqueda de ingredientes para crear/editar receta
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
      prev.map((i) => (i.food.id === foodId ? { ...i, quantity: Math.max(0.01, qty) } : i)),
    );
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
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
      const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const resolvedComponents = [];
      for (const i of ingredients) {
        let foodId = i.food.id;
        if (!isUuid(foodId)) {
          const searchRes = await api.get<{ data: Food[] }>(`/foods/search?q=${encodeURIComponent(i.food.name)}`);
          if (searchRes.data && searchRes.data.length > 0) {
            foodId = searchRes.data[0].id;
          } else {
            const created = await api.post<{ data: Food }>('/foods', {
              name: i.food.name,
              serving_size_amount: i.food.serving_size_amount || 100,
              serving_size_unit: i.food.serving_size_unit || 'g',
              calories: i.food.calories || 100,
              protein: i.food.protein || 10,
              carbohydrates: i.food.carbohydrates || 10,
              fat: i.food.fat || 2,
            });
            foodId = created.data.id;
          }
        }
        resolvedComponents.push({
          food_item_id: foodId,
          quantity: i.quantity,
        });
      }

      // Una comida guardada se registra entera: el API le fija las porciones en 1.
      const payload = {
        name: recipeName.trim(),
        kind,
        ...(kind === 'recipe' && { total_servings: Number(totalServings) || 1 }),
        components: resolvedComponents,
      };

      if (editingRecipe) {
        await api.patch(`/recipes/${editingRecipe.id}`, payload);
        setMessage({ text: `Receta "${recipeName}" actualizada con éxito.`, ok: true });
      } else {
        await api.post('/recipes', payload);
        setMessage({ text: `Receta "${recipeName}" creada con éxito.`, ok: true });
      }

      setShowCreateModal(false);
      setEditingRecipe(null);
      setRecipeName('');
      setTotalServings('2');
      setIngredients([]);
      void loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la receta');
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
        <button type="button" className="btn" onClick={handleOpenCreateNew}>
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
          <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', marginBottom: '1rem' }}>
            <span className="eyebrow" style={{ color: 'var(--color-primary)', display: 'block', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              Ideas & Inspiración (Deslizá para Explorar Recetas)
            </span>
            <div style={{ height: '210px', position: 'relative' }}>
              <FlowingMenu
                items={RECIPE_IDEAS.map((r) => ({
                  text: r.name,
                  badge: `${Math.round(r.per_serving.calories)} KCAL • ${Math.round(r.per_serving.protein_g)}G PRO`,
                  subtext: `${r.total_servings} porciones`,
                  onClick: () => handleCloneIdea(r),
                }))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
            {RECIPE_IDEAS.map((r) => (
              <div key={r.id} className="card card--raised" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3
                      tabIndex={0}
                      role="button"
                      style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)', cursor: 'pointer' }}
                      onClick={() => setDetailRecipe(r)}
                      onKeyDown={(e) => e.key === 'Enter' && setDetailRecipe(r)}
                    >
                      {r.name}
                    </h3>
                    <span className="badge">{r.kind === 'meal' ? 'comida' : `${r.total_servings} porciones`}</span>
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

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1 }}
                    onClick={() => handleCloneIdea(r)}
                  >
                    + Clonar Receta
                  </button>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => setDetailRecipe(r)}
                  >
                    Detalle
                  </button>
                </div>
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
                const ingNames = r.components?.flatMap((c) => (c.food?.name ? [c.food.name] : [])).join(', ');
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
                  <h3
                    tabIndex={0}
                    role="button"
                    style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)', cursor: 'pointer' }}
                    onClick={() => setDetailRecipe(r)}
                    onKeyDown={(e) => e.key === 'Enter' && setDetailRecipe(r)}
                  >
                    {r.name}
                  </h3>
                  <span className="badge">{r.kind === 'meal' ? 'comida' : `${r.total_servings} porciones`}</span>
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

              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: '1 1 auto' }}
                  onClick={() => setLoggingRecipe(r)}
                >
                  + Al Diario
                </button>
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => handleEditRecipe(r)}
                  title="Editar receta e ingredientes"
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => setDetailRecipe(r)}
                  title="Ver detalle completo"
                >
                  Detalle
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

      {/* Modal para Crear/Editar Receta */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onSubmit={handleSaveRecipe} className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="card__title">{editingRecipe ? `Editar Receta "${editingRecipe.name}"` : 'Nueva Receta'}</h3>
              <button type="button" className="btn btn--quiet" onClick={() => { setShowCreateModal(false); setEditingRecipe(null); }}>✕</button>
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
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.2rem' }}>Tipo</label>
                <div className="food-tabs" role="tablist" aria-label="Tipo">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={kind === 'recipe'}
                    className="btn btn--quiet"
                    onClick={() => setKind('recipe')}
                  >
                    Receta
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={kind === 'meal'}
                    className="btn btn--quiet"
                    onClick={() => setKind('meal')}
                  >
                    Comida guardada
                  </button>
                </div>
              </div>

              {/* Una comida guardada se registra entera, así que preguntar en
                  cuántas porciones rinde no tiene sentido. */}
              {kind === 'recipe' && (
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
              )}

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
                <ul className="entries" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {ingredients.map((ing) => {
                    const totalGrams = Math.round(ing.quantity * (ing.food.serving_size_amount || 100));
                    const totalKcal = Math.round((ing.food.calories || 0) * ing.quantity);
                    const totalProt = Math.round((ing.food.protein || 0) * ing.quantity);

                    return (
                      <li key={ing.food.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-elevated)', padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{ing.food.name}</strong>
                            <span className="muted" style={{ fontSize: '0.72rem', display: 'block' }}>
                              Porción base: {ing.food.serving_size_amount}{ing.food.serving_size_unit} ({ing.food.calories} kcal)
                            </span>
                          </div>
                          <button type="button" className="entry__delete" onClick={() => handleRemoveIngredient(ing.food.id)} style={{ color: 'var(--color-danger)' }}>
                            Quitar
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-xs)' }}>
                          {/* Selector por porciones */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <label htmlFor={`porc-${ing.food.id}`} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Porciones:</label>
                            <input
                              id={`porc-${ing.food.id}`}
                              type="number"
                              step="any"
                              min="0.01"
                              style={{ width: '70px', padding: '0.2rem 0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                              value={Math.round(ing.quantity * 100) / 100}
                              onChange={(e) => {
                                const val = e.target.value;
                                const num = val ? Number(val) : 0;
                                if (!isNaN(num) && num > 0) handleUpdateQuantity(ing.food.id, num);
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>× {ing.food.serving_size_amount}{ing.food.serving_size_unit}</span>
                          </div>

                          {/* Entrada directa por gramos o mililitros */}
                          {(ing.food.serving_size_unit === 'g' || ing.food.serving_size_unit === 'ml') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <label htmlFor={`gram-${ing.food.id}`} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>o Total:</label>
                              <input
                                id={`gram-${ing.food.id}`}
                                type="number"
                                step="any"
                                min="1"
                                style={{ width: '75px', padding: '0.2rem 0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                                value={totalGrams}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const g = val ? Number(val) : 0;
                                  const base = ing.food.serving_size_amount || 100;
                                  if (!isNaN(g) && g > 0 && base > 0) {
                                    handleUpdateQuantity(ing.food.id, g / base);
                                  }
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ing.food.serving_size_unit}</span>
                            </div>
                          )}
                        </div>

                        {/* Métrica calculada en tiempo real */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-primary)' }} className="num">
                          <span>
                            Cantidad total: <strong>{totalGrams} {ing.food.serving_size_unit}</strong>
                          </span>
                          <span>
                            Aporte: <strong>{totalKcal} kcal</strong> (P: {totalProt}g)
                          </span>
                        </div>
                      </li>
                    );
                  })}
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

      {/* Modal para Ver Detalle Completo de Receta */}
      {detailRecipe && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="eyebrow" style={{ color: 'var(--color-primary)' }}>Detalle de Receta</span>
                <h3 className="card__title" style={{ margin: 0 }}>{detailRecipe.name}</h3>
              </div>
              <button type="button" className="btn btn--quiet" onClick={() => setDetailRecipe(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem', background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }} className="num">
              <div>
                <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Rendimiento Total</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{detailRecipe.total_servings} porciones</strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Calorías / Porción</span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round(detailRecipe.per_serving.calories)} kcal</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', marginBottom: '1rem' }} className="num">
              <div style={{ background: 'var(--bg-elevated)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-protein)', display: 'block' }}>Proteína</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{Math.round(detailRecipe.per_serving.protein_g)} g</strong>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-carbs)', display: 'block' }}>Carbohidratos</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{Math.round(detailRecipe.per_serving.carbs_g)} g</strong>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-fats)', display: 'block' }}>Grasas</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{Math.round(detailRecipe.per_serving.fat_g)} g</strong>
              </div>
            </div>

            {detailRecipe.components && detailRecipe.components.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  Ingredientes ({detailRecipe.components.length})
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {detailRecipe.components.map((c, idx) => (
                    <li key={c.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem', display: 'block' }}>{c.food?.name || 'Ingrediente'}</strong>
                        <span className="num muted" style={{ fontSize: '0.75rem' }}>
                          {c.food?.calories ? `${Math.round(c.food.calories * c.quantity)} kcal` : ''}
                        </span>
                      </div>
                      <span className="num" style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.85rem' }}>
                        {c.quantity} × {c.food?.serving_size_amount || 100}{c.food?.serving_size_unit || 'g'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn"
                style={{ flex: 1 }}
                onClick={() => {
                  const r = detailRecipe;
                  setDetailRecipe(null);
                  if (recipes.some(x => x.id === r.id)) {
                    setLoggingRecipe(r);
                  } else {
                    handleCloneIdea(r);
                  }
                }}
              >
                {recipes.some(x => x.id === detailRecipe.id) ? '+ Registrar en Diario' : '+ Personalizar & Guardar'}
              </button>
              {recipes.some(x => x.id === detailRecipe.id) && (
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => handleEditRecipe(detailRecipe)}
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

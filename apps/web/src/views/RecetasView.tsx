/**
 * Placeholder hasta que exista el API de recetas (Fase 2).
 *
 * No lleva recetas de ejemplo a propósito: en una app de conteo de calorías,
 * un plato con "450 kcal · 42g proteína" que nadie calculó se lee como un dato
 * del catálogo, y el usuario no tiene forma de saber que es de mentira.
 * Mientras no haya números reales, no va ninguno.
 */
export function RecetasView() {
  return (
    <div className="view-recetas stack">
      <section className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        <span className="eyebrow" style={{ color: 'var(--color-primary)', display: 'block', marginBottom: 'var(--space-xs)' }}>
          En construcción
        </span>
        <h2 className="card__title" style={{ marginBottom: 'var(--space-xs)' }}>
          Todavía no hay recetas
        </h2>
        <p className="muted" style={{ maxWidth: '44ch', margin: '0 auto' }}>
          Vas a poder agrupar los alimentos que comés seguido, ver cuánto rinde
          cada porción y registrar el plato entero de una, en vez de cargar seis
          ingredientes cada vez.
        </p>
      </section>
    </div>
  );
}

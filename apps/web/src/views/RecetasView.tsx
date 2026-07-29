import InfiniteMenu from '../components/InfiniteMenu';

const SAMPLE_RECIPES = [
  {
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    link: '#/recetas',
    title: 'Bowl Proteico de Pollo y Quinoa',
    description: '450 kcal · 42g Proteína · 38g Carbos',
  },
  {
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
    link: '#/recetas',
    title: 'Ensalada Mediterranean Cyber',
    description: '320 kcal · 18g Proteína · 24g Carbos',
  },
  {
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
    link: '#/recetas',
    title: 'Omelette Fit de Espinaca y Queso',
    description: '280 kcal · 26g Proteína · 4g Carbos',
  },
  {
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&q=80',
    link: '#/recetas',
    title: 'Smoothie Proteico de Frutos Rojos',
    description: '240 kcal · 30g Proteína · 22g Carbos',
  },
];

export function RecetasView() {
  return (
    <div className="view-recetas stack" style={{ gap: 'var(--space-lg)' }}>
      <section className="card">
        <h2 className="card__title">Recetas y Preparaciones</h2>
        <p className="muted" style={{ marginBottom: 'var(--space-md)' }}>
          Explorá las recetas destacadas del catálogo o prepará tus propios platillos combinados.
        </p>

        <div style={{ height: '360px', position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <InfiniteMenu items={SAMPLE_RECIPES} />
        </div>
      </section>

      <section className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        <span className="eyebrow" style={{ color: 'var(--color-primary)', display: 'block', marginBottom: 'var(--space-xs)' }}>
          Próximamente · Fase 2
        </span>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-xs)' }}>Creador de Recetas Personalizadas</h3>
        <p className="muted" style={{ maxWidth: '480px', margin: '0 auto' }}>
          Podrás agrupar alimentos frecuentes, calcular nutrientes por porción automáticamente y registrar platillos enteros con un solo toque.
        </p>
      </section>
    </div>
  );
}

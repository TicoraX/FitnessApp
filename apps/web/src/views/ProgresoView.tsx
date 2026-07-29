import { Weight } from '../Weight';

export function ProgresoView({ onGoalChanged }: { onGoalChanged: () => void }) {
  return (
    <div className="view-progreso stack" style={{ gap: 'var(--space-lg)' }}>
      <section className="card">
        <h2 className="card__title">Evolución de Peso y Meta</h2>
        <p className="muted" style={{ marginBottom: 'var(--space-md)' }}>
          Seguimiento continuo de tu peso corporal y proyección de tu tendencia.
        </p>
        <Weight onGoalChanged={onGoalChanged} />
      </section>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api, today, type StreakReport, type SummaryReport, type WeightReport } from '../api';
import { Weight } from '../Weight';
import { Nutrientes } from './Nutrientes';

type PeriodRange = '7' | '30' | '90';

export function ProgresoView({ onGoalChanged }: { onGoalChanged: () => void }) {
  const [period, setPeriod] = useState<PeriodRange>('30');
  const [seccion, setSeccion] = useState<'tendencias' | 'nutrientes'>('tendencias');
  const [streak, setStreak] = useState<StreakReport | null>(null);
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [weightReport, setWeightReport] = useState<WeightReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async (daysCount: number) => {
    try {
      setLoading(true);
      setError('');
      const todayStr = today();
      const [y, m, d] = todayStr.split('-').map(Number);
      const fromDateObj = new Date(y, m - 1, d);
      fromDateObj.setDate(fromDateObj.getDate() - daysCount + 1);
      const fromStr = `${fromDateObj.getFullYear()}-${String(fromDateObj.getMonth() + 1).padStart(2, '0')}-${String(fromDateObj.getDate()).padStart(2, '0')}`;

      const [streakRes, summaryRes, weightRes] = await Promise.all([
        api.get<{ data: StreakReport }>(`/reports/streak?today=${todayStr}`),
        api.get<{ data: SummaryReport }>(`/reports/summary?from=${fromStr}&to=${todayStr}`),
        api.get<{ data: WeightReport }>(`/reports/weight?from=${fromStr}&to=${todayStr}`),
      ]);

      setStreak(streakRes.data);
      setSummary(summaryRes.data);
      setWeightReport(weightRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reportes de progreso');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports(Number(period));
  }, [period, loadReports]);

  const handleGoalChangedInternal = () => {
    onGoalChanged();
    void loadReports(Number(period));
  };

  return (
    <div className="view-progreso stack" style={{ gap: 'var(--space-lg)' }}>
      {/* Selector de Rango de Fechas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 className="card__title">Tablero de Progreso</h2>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Tendencias de calorías, adherencia metabólica y evolución de peso.
          </p>
        </div>

        {/* El rango no aplica a los nutrientes: son del día, no de 90 días. */}
        <div
          className="period-selector-strip"
          style={{
            display: seccion === 'tendencias' ? 'flex' : 'none',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '3px',
            gap: '3px',
          }}
        >
          {[
            ['7', '7 Días'],
            ['30', '30 Días'],
            ['90', '3 Meses'],
          ].map(([val, label]) => {
            const isSelected = period === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => setPeriod(val as PeriodRange)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  color: isSelected ? 'oklch(0.12 0 0)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background var(--dur-state) var(--ease-out), color var(--dur-state) var(--ease-out), font-weight var(--dur-state) var(--ease-out)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="food-tabs" role="tablist" aria-label="Sección de progreso">
        <button
          type="button"
          role="tab"
          aria-selected={seccion === 'tendencias'}
          className="btn btn--quiet"
          onClick={() => setSeccion('tendencias')}
        >
          Tendencias
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seccion === 'nutrientes'}
          className="btn btn--quiet"
          onClick={() => setSeccion('nutrientes')}
        >
          Nutrientes
        </button>
      </div>

      {seccion === 'nutrientes' && (
        <div className="card">
          <h3 className="card__title">Micronutrientes de hoy</h3>
          <Nutrientes />
        </div>
      )}

      {seccion === 'tendencias' && (
      <>
      {/* Racha y Adherencia Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
        <div className="card card--raised" style={{ textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
          <span className="eyebrow" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 23c-4.97 0-9-3.58-9-8 0-4.5 4.5-9 6.5-12.5 1.5 2.5 4 4.5 4 7 0-3.5 3-6 5.5-8 1 2 2 4.5 2 7.5 0 4.42-4.03 8-9 8z" />
            </svg>
            Racha Activa
          </span>
          <div className="num" style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
            {streak ? streak.current_streak : 0} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>días</span>
          </div>
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            Récord: {streak?.longest_streak ?? 0} días consecutivos
          </span>
        </div>

        <div className="card card--raised" style={{ textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
          <span className="eyebrow" style={{ color: 'var(--color-primary)' }}>Constancia de Registro</span>
          <div className="num" style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
            {summary ? `${summary.days_logged} / ${summary.range.days_in_range}` : '—'} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>días</span>
          </div>
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            {summary ? `${Math.round((summary.days_logged / summary.range.days_in_range) * 100)}% del período` : '—'}
          </span>
        </div>

        <div className="card card--raised" style={{ textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
          <span className="eyebrow" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            Adherencia al Objetivo
          </span>
          <div className="num" style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
            {summary?.adherence ? `${Math.round(summary.adherence.pct_on_target)}%` : '—'}
          </div>
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            {summary?.adherence ? `${summary.adherence.days_on_target} días en meta (${summary.adherence.avg_delta_calories > 0 ? '+' : ''}${Math.round(summary.adherence.avg_delta_calories)} kcal)` : '—'}
          </span>
        </div>
      </div>

      {/* Gráfico de Barras SVG de Calorías por Día */}
      <section className="card card--raised">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
          <h3 className="card__title">Consumo de Calorías</h3>
          {summary?.averages && (
            <span className="num muted" style={{ fontSize: '0.85rem' }}>
              Promedio: <strong style={{ color: 'var(--text-main)' }}>{Math.round(summary.averages.calories)} kcal / día logueado</strong> ({summary.days_logged} de {summary.range.days_in_range} días)
            </span>
          )}
        </div>

        {loading ? (
          <p className="muted">Cargando gráfico de calorías...</p>
        ) : summary && summary.days.length > 0 ? (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <CalorieBarChart days={summary.days} goalCalories={summary.adherence.goal_calories} />
          </div>
        ) : (
          <p className="muted">Sin datos de comidas en este período.</p>
        )}

        {/* Desglose de Promedio de Macros */}
        {summary?.averages && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ textAlign: 'center' }}>
              <span className="eyebrow" style={{ color: 'var(--color-protein)' }}>Proteína Promedio</span>
              <div className="num" style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {Math.round(summary.averages.protein_g)} g
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span className="eyebrow" style={{ color: 'var(--color-carbs)' }}>Carbos Promedio</span>
              <div className="num" style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {Math.round(summary.averages.carbs_g)} g
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span className="eyebrow" style={{ color: 'var(--color-fat)' }}>Grasas Promedio</span>
              <div className="num" style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {Math.round(summary.averages.fat_g)} g
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Proyección de Peso y Tendencia */}
      {weightReport?.trend && (
        <section className="card card--raised">
          <h3 className="card__title" style={{ marginBottom: '0.75rem' }}>Tendencia de Peso Corporal</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Cambio neto</span>
              <span className="num" style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {weightReport.trend.change_kg > 0 ? `+${weightReport.trend.change_kg}` : weightReport.trend.change_kg} kg
              </span>
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Ritmo semanal</span>
              <span className="num" style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {weightReport.trend.weekly_rate_kg > 0 ? `+${weightReport.trend.weekly_rate_kg}` : weightReport.trend.weekly_rate_kg} kg/sem
              </span>
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Proyección a la Meta</span>
              <span className="num" style={{ fontSize: '0.95rem', fontWeight: 700, color: weightReport.trend.projected_target_date ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                {weightReport.trend.projected_target_date
                  ? `Llegada aprox: ${weightReport.trend.projected_target_date}`
                  : 'A este ritmo no se alcanza la meta'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Componente <Weight> para registrar pesajes y meta */}
      <section className="card">
        <h3 className="card__title" style={{ marginBottom: 'var(--space-xs)' }}>Registrar Pesaje</h3>
        <p className="muted" style={{ marginBottom: 'var(--space-md)', fontSize: '0.85rem' }}>
          Cargá tu pesaje diario para ajustar el filtro de media móvil exponencial (EMA).
        </p>
        <Weight onGoalChanged={handleGoalChangedInternal} />
      </section>
      </>
      )}
    </div>
  );
}

/**
 * Gráfico de barras de calorías en SVG puro hecho a mano (sin librerías).
 */
function CalorieBarChart({
  days,
  goalCalories,
}: {
  days: { log_date: string; calories: number }[];
  goalCalories: number;
}) {
  const width = 600;
  const height = 180;
  const padding = 24;

  const maxVal = Math.max(goalCalories * 1.25, ...days.map((d) => d.calories), 2000);
  const goalY = height - padding - (goalCalories / maxVal) * (height - 2 * padding);

  const barGap = 4;
  const barWidth = Math.max(6, (width - 2 * padding - barGap * (days.length - 1)) / days.length);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '400px' }}>
      {/* Línea horizontal de meta / objetivo */}
      {goalCalories > 0 && (
        <g>
          <line
            x1={padding}
            y1={goalY}
            x2={width - padding}
            y2={goalY}
            stroke="var(--color-primary)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            opacity="0.85"
          />
          <text
            x={width - padding - 4}
            y={goalY - 4}
            fill="var(--color-primary)"
            fontSize="10"
            fontFamily="var(--font-mono)"
            textAnchor="end"
          >
            Meta: {goalCalories} kcal
          </text>
        </g>
      )}

      {/* Barras de cada día */}
      {days.map((d, i) => {
        const h = (d.calories / maxVal) * (height - 2 * padding);
        const x = padding + i * (barWidth + barGap);
        const y = height - padding - h;
        const isOverGoal = goalCalories > 0 && d.calories > goalCalories;

        const dateLabel = d.log_date.split('-').slice(1).join('/');

        return (
          <g key={d.log_date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(2, h)}
              rx="3"
              fill={isOverGoal ? 'oklch(0.7 0.2 25)' : 'var(--color-primary)'}
              opacity={d.calories === 0 ? 0.2 : 0.85}
            />
            {days.length <= 14 && (
              <text
                x={x + barWidth / 2}
                y={height - 6}
                fill="var(--text-muted)"
                fontSize="9"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                {dateLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

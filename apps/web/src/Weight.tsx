import { useCallback, useEffect, useState } from 'react';
import { api, getCacheado, invalidarCache, today } from './api';
import { useVisible } from './hooks/useVisible';
import { ErrorConReintento } from './components/ErrorConReintento';

export interface WeightPoint {
  logged_on: string;
  weight_kg: number;
  ema_kg: number;
}

export function Weight({ onGoalChanged }: { onGoalChanged: () => void }) {
  const [series, setSeries] = useState<WeightPoint[]>([]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [falloCarga, setFalloCarga] = useState(false);
  const [ref, visible] = useVisible<HTMLElement>();

  const load = useCallback(async () => {
    try {
      setSeries((await getCacheado<{ data: WeightPoint[] }>('/weight?days=90')).data);
      setFalloCarga(false);
    } catch {
      // Vaciar la serie sin más mostraría "Registrá tu peso para ver la
      // tendencia" a quien tiene noventa pesadas: el error de red se leería
      // como que no hay nada cargado.
      setFalloCarga(true);
    }
  }, []);

  // La serie de 90 días solo se pide cuando la tarjeta asoma: en el teléfono
  // está abajo del todo y entrar al diario no la muestra.
  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  async function submit() {
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight <= 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ data: WeightPoint[] }>('/weight', {
        logged_on: today(),
        weight_kg: weight,
      });
      setSeries(res.data);
      setValue('');
      // La respuesta ya trae la serie nueva; esto es para el próximo montaje.
      invalidarCache('/weight');
      // El objetivo se recalcula en el servidor: hay que releer el día.
      onGoalChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar');
    }
    setBusy(false);
  }

  const last = series.at(-1);
  const first = series[0];
  const delta = last && first ? last.ema_kg - first.ema_kg : 0;

  return (
    <section ref={ref} className="card" aria-labelledby="peso" style={{ marginTop: 'var(--space-lg)' }}>
      <h2 id="peso" className="card__title">
        Peso
      </h2>

      {last ? (
        <>
          <p className="weight__figures">
            <span className="num weight__ema">{last.ema_kg.toFixed(1)} kg</span>
            <span className="muted">
              tendencia · última pesada <span className="num">{last.weight_kg} kg</span>
            </span>
          </p>
          {series.length > 1 && (
            <p className="muted num weight__delta" data-down={delta < 0}>
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} kg en {series.length} pesadas
            </p>
          )}
          {/* La leyenda solo tiene sentido si hay gráfico que leer. */}
          {series.length > 1 && (
            <>
              <Sparkline series={series} />
              <p className="weight__legend">
                <span className="weight__key">
                  <span className="weight__swatch weight__swatch--ema" />
                  Tendencia
                </span>
                <span className="weight__key">
                  <span className="weight__swatch weight__swatch--raw" />
                  Pesada diaria
                </span>
              </p>
            </>
          )}
        </>
      ) : falloCarga ? (
        <ErrorConReintento mensaje="No se pudo cargar la tendencia." onReintentar={load} />
      ) : (
        <p className="hint">
          Registrá tu peso para ver la tendencia. El objetivo se recalcula con cada cambio.
        </p>
      )}

      <div className="addbar">
        <input
          type="number"
          className="num"
          inputMode="decimal"
          step="0.1"
          min="25"
          max="500"
          placeholder="kg de hoy"
          aria-label="Peso de hoy en kilos"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button
          type="button"
          className="btn"
          onClick={submit}
          disabled={busy || !value}
          data-state={busy ? 'loading' : undefined}
        >
          {busy ? 'Guardando' : 'Registrar'}
        </button>
      </div>

      {error && (
        <p className="alert" role="alert" style={{ marginTop: 'var(--space-sm)' }}>
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * Sparkline en SVG, sin librería. La escala vertical se ajusta al rango de la
 * serie con un margen, porque las variaciones de peso relevantes son de pocos
 * kilos y un eje anclado en cero las aplana.
 */
function Sparkline({ series }: { series: WeightPoint[] }) {
  if (series.length < 2) return null;

  const W = 300;
  const H = 64;
  const values = series.flatMap((p) => [p.weight_kg, p.ema_kg]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || 1) * 0.15;
  const lo = min - pad;
  const hi = max + pad;

  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const linePath = (get: (p: WeightPoint) => number) =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(get(p)).toFixed(1)}`).join(' ');

  const emaPath = linePath((p) => p.ema_kg);
  const areaPath = `${emaPath} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Tendencia de peso: de ${series[0].ema_kg.toFixed(1)} a ${series.at(-1)!.ema_kg.toFixed(1)} kilos`}
    >
      <defs>
        <linearGradient id="emaAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#emaAreaGrad)" />
      <path className="sparkline__raw" d={linePath((p) => p.weight_kg)} vectorEffect="non-scaling-stroke" />
      <path className="sparkline__ema" d={emaPath} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

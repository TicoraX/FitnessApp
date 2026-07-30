import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from './api';

const ACTIVITY = [
  [1.2, 'Sedentario'],
  [1.375, 'Ligeramente activo'],
  [1.55, 'Moderadamente activo'],
  [1.725, 'Muy activo'],
  [1.9, 'Atleta'],
] as const;

interface ProfileData {
  first_name: string;
  email: string;
  height_cm: number;
  activity_level: number;
  target_weight_kg: number | null;
  weekly_goal_kg: number | null;
  daily_calories: number | null;
  body_fat_pct?: number | null;
  unit_preference?: 'metric' | 'imperial';
}

/**
 * Lo que se puede cambiar después del registro. Cualquiera de los cuatro
 * campos altera el cálculo, así que el servidor recalcula el objetivo y
 * devuelve el valor nuevo.
 */
export function Profile({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setData((await api.get<{ data: ProfileData }>('/profile')).data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const raw = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const unitPref = (raw.unit_preference as 'metric' | 'imperial') || 'metric';
      let heightCm = Number(raw.height_cm);
      let targetWeightKg = Number(raw.target_weight_kg);

      // Si el input estaba en imperial, convertir a metrico para el API
      if (unitPref === 'imperial') {
        heightCm = heightCm * 2.54;
        targetWeightKg = targetWeightKg / 2.20462;
      }

      const payload: Record<string, unknown> = {
        height_cm: Math.round(heightCm * 10) / 10,
        activity_level: Number(raw.activity_level),
        target_weight_kg: Math.round(targetWeightKg * 10) / 10,
        weekly_goal_kg: Number(raw.weekly_goal_kg),
        unit_preference: unitPref,
      };
      if (raw.body_fat_pct !== '' && raw.body_fat_pct !== undefined) {
        payload.body_fat_pct = Number(raw.body_fat_pct);
      } else {
        payload.body_fat_pct = null;
      }

      const res = await api.patch<{ data: ProfileData }>('/profile', payload);
      setData(res.data);
      setMessage({ text: `Objetivo actualizado: ${res.data.daily_calories} kcal.`, ok: true });
      onSaved();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'No se pudo guardar', ok: false });
    }
    setBusy(false);
  }

  const [unitPref, setUnitPref] = useState<'metric' | 'imperial'>(data?.unit_preference || 'metric');

  useEffect(() => {
    if (data?.unit_preference) setUnitPref(data.unit_preference);
  }, [data?.unit_preference]);

  if (!data) return <p className="muted">Cargando el perfil.</p>;

  const isImperial = unitPref === 'imperial';
  const displayHeight = isImperial ? Math.round((data.height_cm / 2.54) * 10) / 10 : data.height_cm;
  const displayTargetWeight = data.target_weight_kg
    ? isImperial
      ? Math.round(data.target_weight_kg * 2.20462 * 10) / 10
      : data.target_weight_kg
    : '';

  return (
    <form className="stack" onSubmit={submit}>
      <p className="muted">
        {data.first_name} · {data.email}
      </p>

      <div className="field">
        <label>Sistema de unidades</label>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button
            type="button"
            className={!isImperial ? 'btn' : 'btn btn--quiet'}
            onClick={() => setUnitPref('metric')}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
          >
            Métrico (kg / cm)
          </button>
          <button
            type="button"
            className={isImperial ? 'btn' : 'btn btn--quiet'}
            onClick={() => setUnitPref('imperial')}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
          >
            Imperial (lb / in)
          </button>
        </div>
        <input type="hidden" name="unit_preference" value={unitPref} />
      </div>

      <div className="field">
        <label htmlFor="pf-height">Altura ({isImperial ? 'pulgadas / in' : 'cm'})</label>
        <input
          id="pf-height"
          name="height_cm"
          type="number"
          inputMode="decimal"
          step="0.5"
          min={isImperial ? 30 : 80}
          max={isImperial ? 100 : 260}
          required
          key={`height-${unitPref}`}
          defaultValue={displayHeight}
        />
      </div>

      <div className="field">
        <label htmlFor="pf-activity">Nivel de actividad</label>
        <select id="pf-activity" name="activity_level" defaultValue={String(data.activity_level)}>
          {ACTIVITY.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="pf-target">Peso objetivo ({isImperial ? 'libras / lb' : 'kg'})</label>
        <input
          id="pf-target"
          name="target_weight_kg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={isImperial ? 50 : 25}
          max={isImperial ? 1100 : 500}
          required
          key={`weight-${unitPref}`}
          defaultValue={displayTargetWeight}
        />
      </div>

      <div className="field">
        <label htmlFor="pf-weekly">Cambio semanal (kg)</label>
        <input
          id="pf-weekly"
          name="weekly_goal_kg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={-1}
          max={1}
          required
          defaultValue={data.weekly_goal_kg ?? ''}
        />
        <span className="muted">Negativo para bajar, positivo para subir.</span>
      </div>

      <div className="field">
        <label htmlFor="pf-fat-pct">% Grasa corporal (opcional)</label>
        <input
          id="pf-fat-pct"
          name="body_fat_pct"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={3}
          max={70}
          defaultValue={data.body_fat_pct ?? ''}
        />
        <span className="muted">Cambia la fórmula del cálculo metabólico a Katch-McArdle (masa magra). Dejar en blanco vuelve a Mifflin-St Jeor.</span>
      </div>

      {message && (
        <p className={message.ok ? 'alert alert--ok' : 'alert'} role="status">
          {message.text}
        </p>
      )}

      <div className="newfood__actions">
        <button className="btn" type="submit" disabled={busy} data-state={busy ? 'loading' : undefined}>
          {busy ? 'Guardando' : 'Guardar'}
        </button>
        <button className="btn btn--quiet" type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </form>
  );
}

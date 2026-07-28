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
      const res = await api.patch<{ data: ProfileData }>('/profile', {
        height_cm: Number(raw.height_cm),
        activity_level: Number(raw.activity_level),
        target_weight_kg: Number(raw.target_weight_kg),
        weekly_goal_kg: Number(raw.weekly_goal_kg),
      });
      setData(res.data);
      setMessage({ text: `Objetivo actualizado: ${res.data.daily_calories} kcal.`, ok: true });
      onSaved();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'No se pudo guardar', ok: false });
    }
    setBusy(false);
  }

  if (!data) return <p className="muted">Cargando el perfil.</p>;

  return (
    <form className="stack" onSubmit={submit}>
      <p className="muted">
        {data.first_name} · {data.email}
      </p>

      <div className="field">
        <label htmlFor="pf-height">Altura (cm)</label>
        <input
          id="pf-height"
          name="height_cm"
          type="number"
          inputMode="decimal"
          step="0.5"
          min={80}
          max={260}
          required
          defaultValue={data.height_cm}
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
        <label htmlFor="pf-target">Peso objetivo (kg)</label>
        <input
          id="pf-target"
          name="target_weight_kg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={25}
          max={500}
          required
          defaultValue={data.target_weight_kg ?? ''}
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

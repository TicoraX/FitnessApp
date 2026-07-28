import { useState, type FormEvent } from 'react';
import { api, type Food } from './api';

const UNITS = ['g', 'ml', 'porción', 'taza', 'unidad'] as const;

/**
 * Alta de un alimento que el catálogo no tiene. Al crearlo queda seleccionado,
 * así el usuario sigue con el flujo que lo trajo acá en vez de volver a
 * buscarlo.
 */
export function NewFood({ name, onCreated }: { name: string; onCreated: (food: Food) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const raw = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const payload: Record<string, unknown> = {
        name: raw.name,
        serving_size_amount: Number(raw.serving_size_amount),
        serving_size_unit: raw.serving_size_unit,
        calories: Number(raw.calories),
        protein: Number(raw.protein),
        carbohydrates: Number(raw.carbohydrates),
        fat: Number(raw.fat),
      };
      // Los opcionales van solo si tienen algo: el DTO rechaza campos vacíos.
      for (const key of ['brand', 'barcode'] as const) {
        if (raw[key]) payload[key] = raw[key];
      }
      for (const key of ['fiber', 'sugar', 'sodium_mg'] as const) {
        if (raw[key] !== '') payload[key] = Number(raw[key]);
      }

      const res = await api.post<{ data: Food }>('/foods', payload);
      setOpen(false);
      onCreated(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--quiet btn--block" onClick={() => setOpen(true)}>
        Crear alimento
      </button>
    );
  }

  return (
    <form className="newfood" onSubmit={submit}>
      <div className="field">
        <label htmlFor="nf-name">Nombre</label>
        <input id="nf-name" name="name" required minLength={2} maxLength={255} defaultValue={name} />
      </div>

      <div className="field">
        <label htmlFor="nf-brand">Marca</label>
        <input id="nf-brand" name="brand" maxLength={255} placeholder="Opcional" />
      </div>

      <p className="eyebrow">Por porción</p>
      <div className="newfood__grid">
        <div className="field">
          <label htmlFor="nf-amount">Cantidad</label>
          <input
            id="nf-amount"
            name="serving_size_amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            defaultValue={100}
          />
        </div>
        <div className="field">
          <label htmlFor="nf-unit">Unidad</label>
          <select id="nf-unit" name="serving_size_unit" defaultValue="g">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nf-cal">Calorías</label>
          <input id="nf-cal" name="calories" type="number" inputMode="numeric" min="0" max="10000" required />
        </div>
        <div className="field">
          <label htmlFor="nf-prot">Proteína (g)</label>
          <input id="nf-prot" name="protein" type="number" inputMode="decimal" step="0.01" min="0" required />
        </div>
        <div className="field">
          <label htmlFor="nf-carb">Carbos (g)</label>
          <input id="nf-carb" name="carbohydrates" type="number" inputMode="decimal" step="0.01" min="0" required />
        </div>
        <div className="field">
          <label htmlFor="nf-fat">Grasa (g)</label>
          <input id="nf-fat" name="fat" type="number" inputMode="decimal" step="0.01" min="0" required />
        </div>
      </div>

      {/* details nativo: no hace falta un acordeón propio para esconder lo que
          casi nadie completa. */}
      <details className="newfood__more">
        <summary>Más datos</summary>
        <div className="newfood__grid">
          <div className="field">
            <label htmlFor="nf-fiber">Fibra (g)</label>
            <input id="nf-fiber" name="fiber" type="number" inputMode="decimal" step="0.01" min="0" />
          </div>
          <div className="field">
            <label htmlFor="nf-sugar">Azúcar (g)</label>
            <input id="nf-sugar" name="sugar" type="number" inputMode="decimal" step="0.01" min="0" />
          </div>
          <div className="field">
            <label htmlFor="nf-sodium">Sodio (mg)</label>
            <input id="nf-sodium" name="sodium_mg" type="number" inputMode="decimal" step="0.01" min="0" />
          </div>
          <div className="field">
            <label htmlFor="nf-barcode">Código de barras</label>
            <input id="nf-barcode" name="barcode" inputMode="numeric" pattern="\d{8,14}" />
          </div>
        </div>
      </details>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="newfood__actions">
        <button className="btn" type="submit" disabled={busy} data-state={busy ? 'loading' : undefined}>
          {busy ? 'Creando' : 'Crear y usar'}
        </button>
        <button className="btn btn--quiet" type="button" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

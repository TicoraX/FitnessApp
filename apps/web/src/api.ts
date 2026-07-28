const TOKEN_KEY = 'fittrack.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.message;
    throw new ApiError(
      Array.isArray(detail) ? detail.join('. ') : (detail ?? `Error ${res.status}`),
    );
  }
  return body as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};

/* ---------- Tipos del contrato REST ---------- */

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  verified: boolean;
  serving_size_amount: number;
  serving_size_unit: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

export interface DaySummary {
  log_date: string;
  water_ml: number;
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  entries: {
    id: string;
    meal_type: string;
    servings_consumed: number;
    logged_at: string;
    calories: number;
    food: { id: string; name: string; brand: string | null; serving_size_amount: number; serving_size_unit: string };
  }[];
}

/**
 * Día local, no UTC. Con toISOString(), un usuario en UTC-3 ve el diario del
 * día siguiente desde las 21:00.
 */
export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

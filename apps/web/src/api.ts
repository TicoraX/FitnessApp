const TOKEN_KEY = 'fittrack.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {}

/**
 * Un 401 en cualquier request significa que el token murió: caducó, se revocó
 * o la cuenta ya no existe. Sin esto la app se quedaba en el diario mostrando
 * "Unauthorized" en rojo, con un token invalido en localStorage y sin forma de
 * volver al login salvo recargar.
 */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

/** Avisa a las otras pestañas del mismo origen que la sesión terminó. */
const canal = 'BroadcastChannel' in globalThis ? new BroadcastChannel('fittrack') : null;
export const notificarCambio = (tipo: string) => canal?.postMessage({ tipo });
export function escucharCambios(fn: (tipo: string) => void) {
  const handler = (e: MessageEvent) => fn(e.data?.tipo);
  canal?.addEventListener('message', handler);
  return () => canal?.removeEventListener('message', handler);
}

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

  // El login y el registro también devuelven 401/409; ahí el 401 es
  // "credenciales incorrectas", no una sesión vencida.
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    setToken(null);
    notificarCambio('sesion-cerrada');
    onUnauthorized?.();
    throw new ApiError('La sesión venció. Entrá de nuevo.');
  }

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
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path: string) => request<null>(path, { method: 'DELETE' }),
};

/* ---------- Tipos del contrato REST ---------- */

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  verified: boolean;
  source?: 'user' | 'openfoodfacts' | 'curated';
  barcode?: string | null;
  serving_size_amount: number;
  serving_size_unit: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium_mg?: number;
}

export interface RecipeComponent {
  id?: string;
  food_item_id: string;
  quantity: number;
  calories?: number;
  food?: {
    id: string;
    name: string;
    brand: string | null;
    serving_size_amount: number;
    serving_size_unit: string;
  };
}

export interface Recipe {
  id: string;
  name: string;
  total_servings: number;
  component_count?: number;
  per_serving: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  total?: { calories: number };
  components?: RecipeComponent[];
}

export interface MealEntry {
  id: string;
  kind?: 'food' | 'quick' | 'recipe';
  recipe_id?: string | null;
  meal_type: string;
  servings_consumed: number;
  logged_at: string;
  calories: number;
  food: {
    id: string | null;
    name: string;
    brand: string | null;
    serving_size_amount: number;
    serving_size_unit: string;
  };
  components?: {
    id: string;
    calories: number;
    food: { id: string; name: string; brand: string | null; serving_size_amount: number; serving_size_unit: string };
  }[];
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
  entries: MealEntry[];
}

export interface StreakReport {
  current_streak: number;
  longest_streak: number;
  last_logged_on: string | null;
}

export interface SummaryReport {
  range: { from: string; to: string; days_in_range: number };
  days_logged: number;
  averages: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  adherence: {
    goal_calories: number;
    days_with_goal: number;
    days_on_target: number;
    pct_on_target: number;
    avg_delta_calories: number;
  };
  days: { log_date: string; calories: number; protein_g: number; carbs_g?: number; fat_g?: number }[];
}

export interface WeightReport {
  series: { logged_on: string; weight_kg: number; ema_kg: number }[];
  trend: {
    points: number;
    start_ema_kg: number;
    end_ema_kg: number;
    change_kg: number;
    weekly_rate_kg: number;
    goal_weekly_kg: number;
    target_weight_kg: number | null;
    projected_target_date: string | null;
  };
}

/**
 * Día local, no UTC. Con toISOString() directo, un usuario en UTC-3 ve el
 * diario del día siguiente desde las 21:00.
 *
 * Se leen los componentes locales en vez de restar getTimezoneOffset(): la
 * aritmética con el offset también da bien, pero hay que razonarla; esto se
 * lee de una.
 */
export const today = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

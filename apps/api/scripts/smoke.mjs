import assert from 'node:assert/strict';

/**
 * Recorre el flujo completo contra un API ya levantado. No usa framework:
 * si algo se rompe, tira y el exit code lo dice.
 *
 * Uso: npm run smoke   (con el API en :3100 y la DB migrada + seeded)
 */
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3100/api/v1';
let token = '';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    console.error('429: el rate limiter de auth (5/15min) se activó. Esperá y reintentá.');
    process.exit(1);
  }
  return { status: res.status, body: await res.json().catch(() => null) };
}

const check = async (label, fn) => {
  await fn();
  console.log(`  ok  ${label}`);
};

const email = `smoke-${Date.now()}@fittrack.test`;
const password = 'SmokeTest123';
const REGISTER = {
  email,
  password,
  first_name: 'Smoke',
  dob: '1992-08-14',
  gender: 'male',
  height_cm: 178.5,
  current_weight_kg: 82,
  target_weight_kg: 75,
  activity_level: 1.55,
  weekly_goal_kg: -0.5,
};

console.log('\nAuth');

let goals;
await check('registro devuelve objetivos calculados', async () => {
  const { status, body } = await call('POST', '/auth/register', REGISTER);
  assert.equal(status, 201, JSON.stringify(body));
  goals = body.data.calculated_goals;

  // BMR de Mifflin-St Jeor recalculado acá: si el backend cambia la fórmula, esto cae.
  const age = new Date().getUTCFullYear() - 1992 - (new Date() < new Date(`${new Date().getUTCFullYear()}-08-14`) ? 1 : 0);
  const expectedBmr = Math.round(10 * 82 + 6.25 * 178.5 - 5 * age + 5);
  assert.equal(goals.bmr, expectedBmr, `bmr ${goals.bmr} != ${expectedBmr}`);
  assert.equal(goals.tdee, Math.round(expectedBmr * 1.55));
  assert.equal(goals.daily_calories, goals.tdee - 550);

  const { protein_g, carbs_g, fat_g } = goals.macros;
  assert.equal(protein_g, Math.round((goals.daily_calories * 0.3) / 4));
  assert.equal(carbs_g, Math.round((goals.daily_calories * 0.4) / 4));
  assert.equal(fat_g, Math.round((goals.daily_calories * 0.3) / 9));

  token = body.data.token;
});

await check('email duplicado da 409', async () => {
  const { status } = await call('POST', '/auth/register', REGISTER);
  assert.equal(status, 409);
});

await check('password incorrecta da 401', async () => {
  const { status } = await call('POST', '/auth/login', { email, password: 'Incorrecta123' });
  assert.equal(status, 401);
});

await check('login correcto devuelve token', async () => {
  const { status, body } = await call('POST', '/auth/login', { email, password });
  assert.equal(status, 200);
  assert.ok(body.data.token);
});

await check('sin token da 401', async () => {
  const saved = token;
  token = '';
  const { status } = await call('GET', '/logs/2026-01-01');
  assert.equal(status, 401);
  token = saved;
});

console.log('\nBúsqueda');

let pollo;
await check('busca por nombre parcial', async () => {
  const { status, body } = await call('GET', '/foods/search?q=pollo');
  assert.equal(status, 200);
  pollo = body.data.find((f) => f.name.includes('pollo'));
  assert.ok(pollo, 'no encontró pollo: ¿corriste el seed?');

  // El campo entero, no solo el id: $queryRaw devuelve columnas snake_case y
  // sin alias los campos mapeados salen null.
  for (const field of ['serving_size_amount', 'serving_size_unit', 'sodium_mg', 'fiber']) {
    assert.notEqual(pollo[field], null, `${field} llegó null desde la búsqueda`);
    assert.notEqual(pollo[field], undefined, `${field} falta en la búsqueda`);
  }
  assert.equal(typeof pollo.serving_size_amount, 'number');
});

await check('tolera un error de tipeo', async () => {
  const { body } = await call('GET', '/foods/search?q=lentejs');
  assert.ok(body.data.some((f) => f.name.startsWith('Lentejas')), 'trigram no toleró el typo');
});

await check('encuentra sin acento lo que está acentuado', async () => {
  const { body } = await call('GET', '/foods/search?q=brocoli');
  assert.ok(body.data.some((f) => f.name.startsWith('Brócoli')), 'no matcheó Brócoli sin tilde');
});

await check('query de una letra devuelve vacío', async () => {
  const { body } = await call('GET', '/foods/search?q=a');
  assert.deepEqual(body.data, []);
});

console.log('\nDiario');

const day = new Date().toISOString().slice(0, 10);
const round1 = (n) => Number(n.toFixed(1));

await check('registra una comida y devuelve totales', async () => {
  const { status, body } = await call('POST', '/logs/meal', {
    log_date: day,
    meal_type: 'lunch',
    food_item_id: pollo.id,
    servings_consumed: 1.5,
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.equal(body.data.totals.calories, Math.round(pollo.calories * 1.5));
  assert.equal(body.data.totals.protein_g, round1(pollo.protein * 1.5));
  assert.equal(body.data.entries.length, 1);
});

await check('una segunda entrada acumula sobre la primera', async () => {
  const { body } = await call('POST', '/logs/meal', {
    log_date: day,
    meal_type: 'dinner',
    food_item_id: pollo.id,
    servings_consumed: 0.5,
  });
  assert.equal(body.data.totals.calories, Math.round(pollo.calories * 2));
  assert.equal(body.data.entries.length, 2);
});

await check('el restante baja contra el objetivo activo', async () => {
  const { body } = await call('GET', `/logs/${day}`);
  assert.equal(body.data.remaining.calories, goals.daily_calories - body.data.totals.calories);
});

await check('porciones en cero se rechazan', async () => {
  const { status } = await call('POST', '/logs/meal', {
    log_date: day,
    meal_type: 'snack',
    food_item_id: pollo.id,
    servings_consumed: 0,
  });
  assert.equal(status, 400);
});

await check('alimento inexistente da 404', async () => {
  const { status } = await call('POST', '/logs/meal', {
    log_date: day,
    meal_type: 'snack',
    food_item_id: '00000000-0000-4000-8000-000000000000',
    servings_consumed: 1,
  });
  assert.equal(status, 404);
});

await check('sin log_date se rechaza', async () => {
  const { status } = await call('POST', '/logs/meal', {
    meal_type: 'snack',
    food_item_id: pollo.id,
    servings_consumed: 1,
  });
  assert.equal(status, 400);
});

await check('campo desconocido se rechaza', async () => {
  const { status } = await call('POST', '/logs/meal', {
    log_date: day,
    meal_type: 'snack',
    food_item_id: pollo.id,
    servings_consumed: 1,
    is_admin: true,
  });
  assert.equal(status, 400);
});

console.log('\nRecientes y borrado');

await check('los recientes traen lo ya registrado, sin repetir', async () => {
  const { status, body } = await call('GET', '/foods/recent');
  assert.equal(status, 200);
  // Se registró pollo dos veces (almuerzo y cena): tiene que aparecer una sola.
  assert.equal(body.data.filter((f) => f.id === pollo.id).length, 1);
  assert.equal(typeof body.data[0].serving_size_amount, 'number');
});

await check('borrar una entrada baja el total', async () => {
  const antes = await call('GET', `/logs/${day}`);
  const entrada = antes.body.data.entries[0];
  const { status } = await call('DELETE', `/logs/meal/${entrada.id}`);
  assert.equal(status, 204);

  const despues = await call('GET', `/logs/${day}`);
  assert.equal(despues.body.data.entries.length, antes.body.data.entries.length - 1);
  // Se borra la de 1.5 porciones; queda la de 0.5. Se compara contra el valor
  // exacto, no contra una resta de totales ya redondeados.
  assert.equal(despues.body.data.totals.calories, Math.round(pollo.calories * 0.5));
});

await check('los subtotales por comida cierran con el total del día', async () => {
  const { body } = await call('GET', `/logs/${day}`);
  const suma = body.data.entries.reduce((s, e) => s + e.calories, 0);
  assert.equal(Math.round(suma), body.data.totals.calories);
});

await check('no se puede borrar la entrada de otro usuario', async () => {
  const propia = (await call('GET', `/logs/${day}`)).body.data.entries[0];
  const guardado = token;

  const otro = await call('POST', '/auth/register', {
    ...REGISTER,
    email: `smoke-otro-${Date.now()}@fittrack.test`,
  });
  token = otro.body.data.token;
  const { status } = await call('DELETE', `/logs/meal/${propia.id}`);
  token = guardado;

  assert.equal(status, 404, 'un usuario ajeno pudo borrar la entrada');
  // Y sigue estando.
  const sigue = (await call('GET', `/logs/${day}`)).body.data.entries;
  assert.ok(sigue.some((e) => e.id === propia.id));
});

await check('id que no es UUID da 400', async () => {
  const { status } = await call('DELETE', '/logs/meal/no-es-un-uuid');
  assert.equal(status, 400);
});

console.log('\nTodo verde.\n');

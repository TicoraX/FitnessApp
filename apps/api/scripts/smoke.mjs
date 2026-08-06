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

await check('la búsqueda dice de dónde salió cada alimento', async () => {
  assert.equal(pollo.source, 'curated', `source llegó como ${pollo.source}`);
});

/**
 * El código no existe en ningún catálogo, así que este check no depende de que
 * OpenFoodFacts esté arriba: si contesta, dice que no lo tiene; si no contesta,
 * el timeout de 2s cae al mismo 404. Lo que se verifica es que agregar el
 * fallback en vivo no haya cambiado el contrato de "no está".
 */
await check('un código de barras que no existe sigue dando 404', async () => {
  const { status } = await call('GET', '/foods/barcode/00000000000000');
  assert.equal(status, 404);
});

await check('un código de barras mal formado se rechaza sin salir a la red', async () => {
  const t0 = Date.now();
  assert.equal((await call('GET', '/foods/barcode/123')).status, 400);
  assert.equal((await call('GET', '/foods/barcode/abcdefghij')).status, 400);
  // Si validara después de consultar OFF, esto tardaría segundos.
  assert.ok(Date.now() - t0 < 1000, 'el formato se valida después de salir a la red');
});

await check('una query mal armada se rechaza en vez de reinterpretarse', async () => {
  // Express arma un array con el parámetro repetido. Antes se colaba hasta la
  // consulta convertido en "pollo,carne" y devolvía 200 con resultados que
  // nadie pidió; el mismo defecto ya había dado un 500 en strength/history.
  for (const url of [
    '/foods/search?q=pollo&q=carne',
    '/exercise/search?q=correr&q=nadar',
    '/exercise/movements?body=pecho&body=espalda',
    '/exercise/movements?equipment=barra&equipment=mancuerna',
  ]) {
    assert.equal((await call('GET', url)).status, 400, `${url} no se rechazó`);
  }

  // Un límite que no es número caía al default en silencio, que esconde bugs
  // del cliente. El techo ya existía, lo que cambia es que ahora avisa.
  for (const url of [
    '/foods/search?q=pollo&limit=abc',
    '/foods/search?q=pollo&limit=0',
    '/foods/search?q=pollo&limit=51',
    '/weight?days=abc',
    '/weight?days=0',
    '/weight?days=731',
  ]) {
    assert.equal((await call('GET', url)).status, 400, `${url} no se rechazó`);
  }

  // Los válidos siguen andando, con y sin el parámetro opcional.
  assert.equal((await call('GET', '/foods/search?q=pollo&limit=50')).status, 200);
  assert.equal((await call('GET', '/weight?days=730')).status, 200);
  assert.equal((await call('GET', '/weight')).status, 200);
  assert.equal((await call('GET', '/exercise/movements')).status, 200);

  const { body } = await call('GET', '/foods/search?q=pollo&limit=99');
  assert.ok(
    body.message.some((m) => /limit va de 1 a 50/.test(m)),
    `el mensaje no explica el rango: ${JSON.stringify(body.message)}`,
  );
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

await check('editar porciones recalcula los totales', async () => {
  const entrada = (await call('GET', `/logs/${day}`)).body.data.entries[0];
  const { status } = await call('PATCH', `/logs/meal/${entrada.id}`, { servings_consumed: 3 });
  assert.equal(status, 200);
  const { body } = await call('GET', `/logs/${day}`);
  assert.equal(body.data.totals.calories, Math.round(pollo.calories * 3));
});

await check('porciones invalidas al editar se rechazan', async () => {
  const entrada = (await call('GET', `/logs/${day}`)).body.data.entries[0];
  const { status } = await call('PATCH', `/logs/meal/${entrada.id}`, { servings_consumed: -1 });
  assert.equal(status, 400);
});

await check('el agua se guarda y vuelve en el resumen', async () => {
  const { status, body } = await call('PATCH', `/logs/${day}/water`, { water_ml: 1500 });
  assert.equal(status, 200);
  assert.equal(body.data.water_ml, 1500);
  assert.equal((await call('GET', `/logs/${day}`)).body.data.water_ml, 1500);
});

await check('el agua fuera de rango se rechaza', async () => {
  assert.equal((await call('PATCH', `/logs/${day}/water`, { water_ml: -1 })).status, 400);
  assert.equal((await call('PATCH', `/logs/${day}/water`, { water_ml: 99999 })).status, 400);
});

await check('id que no es UUID da 400', async () => {
  const { status } = await call('DELETE', '/logs/meal/no-es-un-uuid');
  assert.equal(status, 400);
});

console.log('\nPeso y ajuste dinámico');

const dayOffset = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
// El registro siembra la serie con el peso declarado, así que hay una entrada
// de hoy desde el principio: se busca por fecha, no por posición.
const el = (body, d) => body.data.find((e) => e.logged_on === d);

await check('el registro ya dejó la primera medición', async () => {
  const { status, body } = await call('GET', '/weight');
  assert.equal(status, 200);
  assert.equal(el(body, day).weight_kg, 82);
  assert.equal(el(body, day).ema_kg, 82);
});

await check('una pesada anterior siembra la EMA con su propio valor', async () => {
  const { status, body } = await call('POST', '/weight', {
    logged_on: dayOffset(-3),
    weight_kg: 82,
  });
  assert.equal(status, 201);
  assert.equal(el(body, dayOffset(-3)).ema_kg, 82);
});

await check('la EMA suaviza: se mueve menos que la pesada', async () => {
  const { body } = await call('POST', '/weight', { logged_on: dayOffset(-2), weight_kg: 84 });
  const e = el(body, dayOffset(-2));
  assert.equal(e.weight_kg, 84);
  assert.equal(e.ema_kg, 82.2); // 84*0.1 + 82*0.9
});

await check('cargar una fecha pasada recalcula la cadena hacia adelante', async () => {
  // Se mete un peso ANTES de los anteriores: todas las EMA posteriores cambian.
  const { body } = await call('POST', '/weight', { logged_on: dayOffset(-4), weight_kg: 80 });
  assert.deepEqual(
    [dayOffset(-4), dayOffset(-3), dayOffset(-2)].map((d) => el(body, d).ema_kg),
    [80, 80.2, 80.58], // 80 · 82*0.1+80*0.9 · 84*0.1+80.2*0.9
  );
});

await check('el objetivo se recalcula con el peso nuevo', async () => {
  const antes = (await call('GET', '/auth/me')).status;
  assert.equal(antes, 200);

  const { body } = await call('POST', '/weight', { logged_on: day, weight_kg: 78 });
  const ema = el(body, day).ema_kg;

  // El objetivo activo tiene que reflejar la EMA, no los 82 kg del registro.
  const dia = (await call('GET', `/logs/${day}`)).body.data;
  const objetivo = dia.totals.calories + dia.remaining.calories;
  assert.notEqual(objetivo, goals.daily_calories, 'el objetivo no se movio con el peso');

  const age = new Date().getUTCFullYear() - 1992 - (new Date() < new Date(`${new Date().getUTCFullYear()}-08-14`) ? 1 : 0);
  const bmr = Math.round(10 * ema + 6.25 * 178.5 - 5 * age + 5);
  assert.equal(objetivo, Math.round(bmr * 1.55) - 550);
});

/**
 * La grasa corporal cambia la fórmula del BMR (Katch-McArdle en vez de
 * Mifflin-St Jeor). Antes el dato se usaba en el registro y no se guardaba, así
 * que el primer recálculo volvía a Mifflin y le movía las calorías al usuario
 * sin que hubiera tocado nada. Va sobre una cuenta aparte para no ensuciar la
 * del recorrido principal.
 */
await check('la grasa corporal sobrevive al recálculo del objetivo', async () => {
  const principal = token;
  token = '';

  const katch = (kg, pct) => Math.round(370 + 21.6 * (kg * (1 - pct / 100)));

  const alta = await call('POST', '/auth/guest', {
    first_name: 'Katch',
    dob: '1992-08-14',
    gender: 'male',
    height_cm: 178.5,
    current_weight_kg: 90,
    target_weight_kg: 80,
    activity_level: 1.55,
    weekly_goal_kg: -0.5,
    body_fat_pct: 25,
  });
  assert.equal(alta.status, 201, JSON.stringify(alta.body));
  token = alta.body.data.token;
  assert.equal(alta.body.data.calculated_goals.bmr, katch(90, 25));

  assert.equal((await call('GET', '/profile')).body.data.body_fat_pct, 25);

  // Pesarse dispara GoalsService.refresh. Con una sola pesada la EMA es el
  // valor crudo, así que el objetivo tiene que salir de Katch sobre 88 kg.
  await call('POST', '/weight', { logged_on: day, weight_kg: 88 });

  const despues = (await call('GET', '/profile')).body.data.daily_calories;
  const esperado = Math.round(katch(88, 25) * 1.55) - 550;
  assert.equal(despues, esperado, `${despues} != ${esperado}: el recálculo volvió a Mifflin`);

  // Borrar el dato devuelve el cálculo a Mifflin-St Jeor.
  const sinGrasa = await call('PATCH', '/profile', { body_fat_pct: null });
  assert.equal(sinGrasa.status, 200, JSON.stringify(sinGrasa.body));
  assert.equal(sinGrasa.body.data.body_fat_pct, null);
  assert.notEqual(sinGrasa.body.data.daily_calories, esperado);

  token = principal;
});

await check('un peso fuera de rango se rechaza', async () => {
  assert.equal((await call('POST', '/weight', { logged_on: day, weight_kg: 5 })).status, 400);
  assert.equal((await call('POST', '/weight', { logged_on: 'ayer', weight_kg: 80 })).status, 400);
});

console.log('\nPerfil');

await check('el perfil devuelve lo declarado en el registro', async () => {
  const { status, body } = await call('GET', '/profile');
  assert.equal(status, 200);
  assert.equal(body.data.height_cm, 178.5);
  assert.equal(body.data.activity_level, 1.55);
  assert.equal(body.data.target_weight_kg, 75);
  assert.equal(body.data.weekly_goal_kg, -0.5);
});

await check('subir el nivel de actividad sube las calorías', async () => {
  const antes = (await call('GET', '/profile')).body.data.daily_calories;
  const { status, body } = await call('PATCH', '/profile', { activity_level: 1.9 });
  assert.equal(status, 200);
  assert.equal(body.data.activity_level, 1.9);
  assert.ok(body.data.daily_calories > antes, `${body.data.daily_calories} no supera ${antes}`);
});

await check('cambiar el ritmo semanal mueve el déficit', async () => {
  const antes = (await call('GET', '/profile')).body.data.daily_calories;
  const { body } = await call('PATCH', '/profile', { weekly_goal_kg: -1 });
  // De -0.5 a -1 kg/semana son 550 kcal/día más de déficit.
  assert.equal(body.data.daily_calories, antes - 550);
});

await check('un perfil inválido se rechaza entero', async () => {
  assert.equal((await call('PATCH', '/profile', { activity_level: 3 })).status, 400);
  assert.equal((await call('PATCH', '/profile', { height_cm: 10 })).status, 400);
  assert.equal((await call('PATCH', '/profile', { weekly_goal_kg: -5 })).status, 400);
});

console.log('\nReportes');

/**
 * Usuario aparte con días controlados: 1 y 2 de mayo seguidos, hueco el 3, y
 * el 4 otra vez. Así la racha tiene una isla de dos y otra de uno.
 */
const principalRep = token;
token = '';
{
  const alta = await call('POST', '/auth/guest', {
    first_name: 'Reportes', dob: '1992-08-14', gender: 'male', height_cm: 178.5,
    current_weight_kg: 82, target_weight_kg: 75, activity_level: 1.55,
    weekly_goal_kg: -0.5, logged_on: '2026-05-01',
  });
  assert.equal(alta.status, 201, JSON.stringify(alta.body));
  token = alta.body.data.token;

  const comida = (await call('POST', '/foods', {
    name: `Barra reportes ${Date.now()}`,
    serving_size_amount: 100, serving_size_unit: 'g',
    calories: 300, protein: 20, carbohydrates: 30, fat: 10,
  })).body.data.id;

  const DIAS = { '2026-05-01': 1, '2026-05-02': 2, '2026-05-04': 3 };
  for (const [fecha, porciones] of Object.entries(DIAS)) {
    await call('POST', '/logs/meal', {
      log_date: fecha, meal_type: 'lunch', food_item_id: comida, servings_consumed: porciones,
    });
  }
  // Día solo con agua: no cuenta como día registrado en ningún reporte.
  await call('PATCH', '/logs/2026-05-03/water', { water_ml: 500 });

  await check('el resumen por día coincide con lo que muestra el diario', async () => {
    const { status, body } = await call('GET', '/reports/summary?from=2026-05-01&to=2026-05-04');
    assert.equal(status, 200, JSON.stringify(body));

    assert.equal(body.data.range.days_in_range, 4);
    // Tres días, no cuatro: el 3 solo tiene agua.
    assert.equal(body.data.days_logged, 3, 'el día de solo agua se contó como registrado');
    assert.equal(body.data.days.length, 3);

    // El punto del check: la agregación en SQL tiene que dar exactamente lo
    // mismo que el sumEntries en JS que alimenta el diario.
    for (const dia of body.data.days) {
      const delDiario = (await call('GET', `/logs/${dia.log_date}`)).body.data.totals;
      for (const campo of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg']) {
        assert.equal(
          dia[campo], delDiario[campo],
          `${dia.log_date} ${campo}: reporte ${dia[campo]} vs diario ${delDiario[campo]}`,
        );
      }
    }
  });

  await check('los promedios son sobre días registrados, no sobre el rango', async () => {
    const { body } = await call('GET', '/reports/summary?from=2026-05-01&to=2026-05-04');
    // 300 + 600 + 900 = 1800 entre 3 días = 600. Entre 4 daría 450.
    assert.equal(body.data.averages.calories, 600, 'promedió sobre el rango y no sobre lo registrado');
    assert.equal(body.data.averages.protein_g, 40);
  });

  await check('con datos suficientes el objetivo sale del gasto medido, no de la fórmula', async () => {
    // Usuario aparte: siembra 28 días comiendo 2000 y pesándose todos los días,
    // bajando de 82 a 80 kg. El gasto real es 2000 + 2*7700/27 = 2570, mientras
    // que la fórmula con actividad 1.55 estima 2753. Con weekly_goal -0.5 el
    // objetivo tiene que salir de lo medido, no de lo estimado.
    const previo = token;
    const reg = await call('POST', '/auth/register', {
      ...REGISTER,
      email: `tdee-${Date.now()}@fittrack.test`,
    });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    token = reg.body.data.token;
    const estimado = reg.body.data.calculated_goals.daily_calories;

    const dia = (o) => new Date(Date.now() + o * 86_400_000).toISOString().slice(0, 10);
    for (let i = 27; i >= 0; i--) {
      await call('POST', '/logs/quick', {
        log_date: dia(-i), meal_type: 'lunch', name: 'Día', calories: 2000,
      });
    }
    for (let i = 27; i >= 0; i--) {
      await call('POST', '/weight', {
        logged_on: dia(-i), weight_kg: Number((82 - (2 * (27 - i)) / 27).toFixed(2)),
      });
    }

    const { body } = await call('GET', `/logs/${dia(0)}`);
    const objetivo = body.data.remaining.calories + body.data.totals.calories;
    // 2570 medido menos los 550 de déficit. Margen de 30 por el redondeo de la
    // EMA sembrada al registrarse.
    assert.ok(
      Math.abs(objetivo - 2020) <= 30,
      `el objetivo dio ${objetivo}; medido esperaba ~2020 y la fórmula habría dado ~${estimado}`,
    );
    assert.ok(
      Math.abs(objetivo - estimado) > 100,
      `el objetivo (${objetivo}) quedó pegado al de la fórmula (${estimado}): no midió`,
    );
    token = previo;
  });

  await check('la adherencia se mide contra el objetivo del día', async () => {
    const { body } = await call('GET', '/reports/summary?from=2026-05-01&to=2026-05-04');
    assert.equal(body.data.adherence.days_with_goal, 3);
    // El objetivo ronda 2200 kcal y ningún día pasa de 900: cero en la banda.
    assert.equal(body.data.adherence.days_on_target, 0);
    assert.ok(body.data.adherence.avg_delta_calories < 0, 'el déficit promedio debería ser negativo');
  });

  await check('la racha cuenta días consecutivos y respeta el hueco', async () => {
    const { status, body } = await call('GET', '/reports/streak?today=2026-05-04');
    assert.equal(status, 200);
    // Islas: [01, 02] de largo 2 y [04] de largo 1. El 3 solo tuvo agua.
    assert.equal(body.data.current_streak, 1, 'la racha actual atravesó el hueco');
    assert.equal(body.data.longest_streak, 2);
    assert.equal(body.data.last_logged_on, '2026-05-04');
  });

  await check('la racha admite que hoy todavía no se haya cargado nada', async () => {
    const { body } = await call('GET', '/reports/streak?today=2026-05-05');
    assert.equal(body.data.current_streak, 1, 'cortó la racha por no haber desayunado aún');
    // Dos días sin cargar sí la cortan.
    const pasado = await call('GET', '/reports/streak?today=2026-05-06');
    assert.equal(pasado.body.data.current_streak, 0);
  });

  await check('la tendencia de peso sale de la EMA y proyecta el objetivo', async () => {
    await call('POST', '/weight', { logged_on: '2026-05-10', weight_kg: 80 });
    const { status, body } = await call('GET', '/reports/weight?from=2026-05-01&to=2026-05-31');
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.data.series.length, 2);
    assert.equal(body.data.trend.points, 2);
    assert.ok(body.data.trend.change_kg < 0, 'bajó de peso y el cambio no es negativo');
    assert.equal(body.data.trend.target_weight_kg, 75);
    assert.equal(typeof body.data.trend.projected_target_date, 'string');
  });

  await check('un rango vacío devuelve ceros y no null', async () => {
    const { status, body } = await call('GET', '/reports/summary?from=2020-01-01&to=2020-01-31');
    assert.equal(status, 200);
    assert.equal(body.data.days_logged, 0);
    assert.equal(body.data.averages.calories, 0);
    assert.deepEqual(body.data.days, []);
    assert.equal(body.data.adherence.pct_on_target, null);
  });

  await check('un rango inválido o desmedido se rechaza', async () => {
    assert.equal((await call('GET', '/reports/summary?from=2026-05-04&to=2026-05-01')).status, 400);
    assert.equal((await call('GET', '/reports/summary?from=2024-01-01&to=2026-01-01')).status, 400);
    assert.equal((await call('GET', '/reports/summary?from=ayer&to=2026-05-01')).status, 400);
    assert.equal((await call('GET', '/reports/streak?today=2026-02-31')).status, 400);
  });
}
token = principalRep;
console.log('\nEntrenamiento');

{
  const movimientos = (await call('GET', '/exercise/movements?q=mancuerna&limit=5')).body.data;

  await check('la búsqueda de movimientos entiende español sobre nombres en inglés', async () => {
    // Los nombres vienen en inglés del dataset: llegar a ellos escribiendo
    // "mancuerna" es lo que hace usable el catálogo en esta app.
    assert.ok(movimientos.length > 0, 'sin resultados para "mancuerna"');
    assert.ok(movimientos.every((m) => m.equipment === 'mancuerna'));
    assert.ok(movimientos[0].howTo.length > 0, 'el movimiento no trae instrucciones');
  });

  await check('los movimientos curados se buscan y se muestran en los dos idiomas', async () => {
    // El dataset solo trae los nombres en ingles. Los que la gente registra de
    // verdad estan curados a mano, y buscarlos en espanol tiene que llegar.
    const { body } = await call('GET', '/exercise/movements?q=sentadilla&limit=5');
    assert.ok(body.data.length > 0, 'buscar "sentadilla" no devolvio nada');
    const sentadilla = body.data.find((m) => m.name === 'barbell full squat');
    assert.ok(sentadilla, 'la sentadilla con barra no aparecio');
    assert.equal(sentadilla.name_es, 'Sentadilla con barra');

    // El exacto primero, aunque en el catalogo aparezca despues de sus variantes.
    const { body: flex } = await call('GET', '/exercise/movements?q=flexiones&limit=3');
    assert.equal(flex.data[0].name, 'push-up');

    // Lo que no esta curado sale en ingles y con el campo en null, no inventado.
    const { body: raro } = await call('GET', '/exercise/movements?q=archer%20push%20up&limit=1');
    assert.equal(raro.data[0].name_es, null);
  });

  await check('las facetas y los filtros acotan de verdad', async () => {
    const { body } = await call('GET', '/exercise/facets');
    assert.ok(body.data.body.includes('pecho'));
    assert.ok(body.data.equipment.includes('barra'));

    const filtrado = (await call('GET', '/exercise/movements?body=pecho&equipment=barra&limit=50')).body.data;
    assert.ok(filtrado.length > 0);
    assert.ok(filtrado.every((m) => m.body === 'pecho' && m.equipment === 'barra'));
  });

  const movimiento = movimientos[0].name;

  await check('una serie se registra y no toca el margen del día', async () => {
    const antes = (await call('GET', `/logs/${day}`)).body.data.remaining.calories;
    const { status, body } = await call('POST', '/logs/strength', {
      log_date: day, name: movimiento, sets: 4, reps: 8, weight_kg: 22.5,
    });
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.data.strength.length, 1);
    assert.equal(body.data.strength[0].done, true, 'lo cargado a mano nace hecho');
    // Sin MET no hay calorías: la fuerza es historial de cargas, no gasto.
    assert.equal(body.data.remaining.calories, antes);
  });

  await check('los límites de una serie se validan', async () => {
    assert.equal((await call('POST', '/logs/strength', {
      log_date: day, name: movimiento, sets: 999, reps: 8,
    })).status, 400);
    assert.equal((await call('POST', '/logs/strength', {
      log_date: day, name: 'x', sets: 3, reps: 8,
    })).status, 400);
  });

  await check('la historia del movimiento devuelve lo último y el récord', async () => {
    const { body } = await call('GET', `/logs/strength/history?name=${encodeURIComponent(movimiento)}`);
    assert.equal(body.data.last.sets, 4);
    assert.equal(body.data.last.weight_kg, 22.5);
    assert.equal(body.data.last.log_date, day);
    assert.equal(body.data.best.weight_kg, 22.5);
  });

  await check('el trending de siempre y el de la semana son cortes distintos', async () => {
    const siempre = (await call('GET', '/logs/strength/trending?limit=5')).body.data;
    assert.ok(siempre.some((m) => m.name === movimiento), 'la serie de hoy tiene que contar');
    // El español se resuelve al leer, igual que en el resto del catálogo.
    assert.ok('name_es' in siempre[0]);

    // Un corte que empieza mañana no puede incluir lo de hoy.
    const manana = new Date(`${day}T00:00:00Z`);
    manana.setUTCDate(manana.getUTCDate() + 1);
    const futuro = (await call('GET', `/logs/strength/trending?desde=${manana.toISOString().slice(0, 10)}`)).body.data;
    assert.equal(futuro.length, 0);

    // Y una fecha mal armada se rechaza, no se reinterpreta.
    assert.equal((await call('GET', '/logs/strength/trending?desde=ayer')).status, 400);
  });

  await check('un movimiento sin historia no es un error', async () => {
    const { status, body } = await call('GET', '/logs/strength/history?name=nunca%20hice%20esto');
    assert.equal(status, 200);
    assert.equal(body.data.last, null);
    assert.equal(body.data.best, null);
  });

  let rutina;
  await check('una rutina se crea con sus objetivos', async () => {
    const { status, body } = await call('POST', '/routines', {
      name: `Empuje ${Date.now()}`,
      notes: 'Lunes y jueves',
      items: [
        { name: movimiento, sets: 4, reps: 6, weight_kg: 30 },
        { name: 'pull-up', sets: 3, reps: 8 },
      ],
    });
    assert.equal(status, 201, JSON.stringify(body));
    rutina = body.data;
    assert.equal(rutina.items.length, 2);
    // Sin peso agregado es null, no cero: una dominada no se hace con 0 kg.
    assert.equal(rutina.items[1].weight_kg, null);
  });

  await check('dos rutinas con el mismo nombre no se distinguen en una lista', async () => {
    const { status } = await call('POST', '/routines', {
      name: rutina.name, items: [{ name: 'pull-up', sets: 1, reps: 1 }],
    });
    assert.equal(status, 409);
  });

  await check('cargar la rutina deja las series pendientes, no hechas', async () => {
    const { status, body } = await call('POST', '/logs/routine', {
      log_date: day, routine_id: rutina.id,
    });
    assert.equal(status, 201, JSON.stringify(body));
    const pendientes = body.data.strength.filter((s) => !s.done);
    assert.equal(pendientes.length, 2);
    assert.deepEqual(
      pendientes.map((s) => [s.sets, s.reps]),
      [[4, 6], [3, 8]],
      'los objetivos no llegaron tal cual',
    );
  });

  await check('planear no cuenta como entrenar', async () => {
    const { body } = await call('GET', `/reports/exercise?from=${day}&to=${day}`);
    // Solo la serie cargada a mano: 4 x 8 x 22.5. Las dos pendientes no suman.
    assert.equal(body.data.totals.volume_kg, 720);
    assert.equal(body.data.totals.sets, 4);
  });

  await check('confirmar una serie la corrige y recién ahí suma volumen', async () => {
    const pendiente = (await call('GET', `/logs/${day}`)).body.data.strength.find((s) => !s.done);
    const { status, body } = await call('PATCH', `/logs/strength/${pendiente.id}`, {
      sets: 4, reps: 5, weight_kg: 32.5, done: true,
    });
    assert.equal(status, 200, JSON.stringify(body));

    const { body: rep } = await call('GET', `/reports/exercise?from=${day}&to=${day}`);
    // 720 de la primera más 4 x 5 x 32.5 de la confirmada, con lo que salió de
    // verdad y no con el objetivo que decía la rutina.
    assert.equal(rep.data.totals.volume_kg, 720 + 650);
    assert.equal(rep.data.totals.sets, 8);
    assert.ok(rep.data.by_body.some((b) => b.sets > 0), 'no se resolvió la zona del cuerpo');
  });

  await check('el récord sigue al peso, no al orden', async () => {
    const { body } = await call('GET', `/logs/strength/history?name=${encodeURIComponent(movimiento)}`);
    assert.equal(body.data.best.weight_kg, 32.5);
  });

  await check('borrar la rutina no toca lo que ya se entrenó', async () => {
    assert.equal((await call('DELETE', `/routines/${rutina.id}`)).status, 204);
    const { body } = await call('GET', `/logs/${day}`);
    assert.equal(body.data.strength.length, 3);
  });

  await check('el esfuerzo se guarda, es opcional y respeta la escala', async () => {
    const conEsfuerzo = await call('POST', '/logs/strength', {
      log_date: day, name: movimiento, sets: 3, reps: 8, weight_kg: 40, rpe: 8.5,
    });
    assert.equal(conEsfuerzo.status, 201, JSON.stringify(conEsfuerzo.body));
    const guardada = conEsfuerzo.body.data.strength.find((s) => s.rpe === 8.5);
    assert.ok(guardada, 'el esfuerzo no volvió en la respuesta del día');

    // La escala va de a medios puntos: un 7.3 no significa nada.
    for (const malo of [7.3, 12, 0]) {
      assert.equal(
        (await call('POST', '/logs/strength', {
          log_date: day, name: movimiento, sets: 3, reps: 8, rpe: malo,
        })).status,
        400,
        `un RPE de ${malo} no puede entrar`,
      );
    }

    // Y sin esfuerzo se registra igual: el que no lo usa no tiene que inventarlo.
    const sinEsfuerzo = await call('POST', '/logs/strength', {
      log_date: day, name: 'pull-up', sets: 3, reps: 6,
    });
    assert.equal(sinEsfuerzo.status, 201);
    assert.equal(sinEsfuerzo.body.data.strength.at(-1).rpe, null);
  });

  await check('una rutina lleva su objetivo de esfuerzo y la serie guarda el real', async () => {
    const { body: creada } = await call('POST', '/routines', {
      name: `Esfuerzo ${Date.now()}`,
      items: [{ name: 'barbell squat', sets: 5, reps: 5, weight_kg: 100, rpe: 8 }],
    });
    assert.equal(creada.data.items[0].rpe, 8);

    const { body: cargada } = await call('POST', '/logs/routine', {
      log_date: day, routine_id: creada.data.id,
    });
    const pendiente = cargada.data.strength.find((s) => !s.done && s.name === 'barbell squat');
    assert.equal(pendiente.rpe, 8, 'la serie pendiente no heredó el objetivo');

    // Salió más pesada de lo planeado: cinco repeticiones no salieron y costó
    // más. Eso es lo que hay que quedar registrado, no el plan.
    const { body: confirmada } = await call('PATCH', `/logs/strength/${pendiente.id}`, {
      reps: 4, rpe: 9.5, done: true,
    });
    const hecha = confirmada.data.strength.find((s) => s.id === pendiente.id);
    assert.equal(hecha.reps, 4);
    assert.equal(hecha.rpe, 9.5);
    assert.equal(hecha.done, true);

    await call('DELETE', `/routines/${creada.data.id}`);
  });

  await check('una serie guarda el nombre real y devuelve tambien el traducido', async () => {
    const { body } = await call('POST', '/logs/strength', {
      log_date: day, name: 'barbell full squat', sets: 5, reps: 5, weight_kg: 100,
    });
    const serie = body.data.strength.find((s) => s.name === 'barbell full squat');
    // Se guarda el ingles: es el identificador, y el espanol se resuelve al leer.
    // Asi curar una traduccion nueva alcanza para que el historial viejo la use.
    assert.equal(serie.name_es, 'Sentadilla con barra');
  });

  await check('las series y las rutinas de otro no se tocan', async () => {
    const antes = (await call('GET', `/logs/${day}`)).body.data.strength;
    const mia = antes[0].id;
    const propio = token;

    const otro = await call('POST', '/auth/guest', {
      first_name: 'Ajeno', dob: '1992-08-14', gender: 'male', height_cm: 178.5,
      current_weight_kg: 82, target_weight_kg: 75, activity_level: 1.55, weekly_goal_kg: -0.5,
    });
    token = otro.body.data.token;
    assert.equal((await call('DELETE', `/logs/strength/${mia}`)).status, 404);
    assert.equal((await call('PATCH', `/logs/strength/${mia}`, { done: false })).status, 404);

    token = propio;
    // Contra el conteo previo y no contra un número fijo: agregar un caso más
    // arriba no puede hacer fallar un test que es sobre propiedad.
    assert.equal((await call('GET', `/logs/${day}`)).body.data.strength.length, antes.length);
  });
}


console.log('\nTodo verde.\n');

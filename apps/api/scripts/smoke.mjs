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

console.log('\nTodo verde.\n');

/**
 * Sonda adversarial: prueba bordes, no el camino feliz. No falla el proceso;
 * imprime cada hallazgo para decidir qué es bug y qué es comportamiento.
 *
 * Uso: node scripts/probe.mjs   (con el API levantado)
 */
const BASE = process.env.PROBE_BASE ?? 'http://localhost:3100/api/v1';
let token = '';

async function call(method, path, body, override) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(override !== undefined ? override : token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const hallazgos = [];
const probe = async (label, fn) => {
  try {
    const r = await fn();
    if (r) {
      hallazgos.push(`${label}: ${r}`);
      console.log(`  !!  ${label}\n      ${r}`);
    } else {
      console.log(`  ok  ${label}`);
    }
  } catch (e) {
    hallazgos.push(`${label}: excepción ${e.message}`);
    console.log(`  !!  ${label}\n      excepción: ${e.message}`);
  }
};

const nuevoUsuario = async (over = {}) => {
  const r = await call('POST', '/auth/register', {
    email: `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@t.test`,
    password: 'ProbeTest123',
    first_name: 'Probe',
    dob: '1992-08-14',
    gender: 'male',
    height_cm: 178,
    current_weight_kg: 82,
    target_weight_kg: 75,
    activity_level: 1.55,
    weekly_goal_kg: -0.5,
    logged_on: new Date().toISOString().slice(0, 10),
    ...over,
  });
  return r;
};

const hoy = new Date().toISOString().slice(0, 10);
const reg = await nuevoUsuario();
if (reg.status !== 201) {
  console.error('no se pudo crear el usuario base:', reg.status, JSON.stringify(reg.body));
  process.exit(1);
}
token = reg.data?.token ?? reg.body.data.token;

const comida = (await call('GET', '/foods/search?q=pollo')).body.data[0];

console.log('\nAutenticación');

await probe('token manipulado se rechaza', async () => {
  const bueno = token;
  token = bueno.slice(0, -3) + 'xyz';
  const { status } = await call('GET', '/profile');
  token = bueno;
  return status === 401 ? null : `devolvió ${status} en vez de 401`;
});

await probe('token con formato basura se rechaza', async () => {
  const { status } = await call('GET', '/profile', undefined, { Authorization: 'Bearer no-es-un-jwt' });
  return status === 401 ? null : `devolvió ${status}`;
});

await probe('sin el prefijo Bearer se rechaza', async () => {
  const { status } = await call('GET', '/profile', undefined, { Authorization: token });
  return status === 401 ? null : `devolvió ${status}`;
});

await probe('el email no distingue mayúsculas al duplicar', async () => {
  const email = `dup-${Date.now()}@t.test`;
  const a = await nuevoUsuario({ email });
  const b = await nuevoUsuario({ email: email.toUpperCase() });
  if (a.status !== 201) return `el primero fallo con ${a.status}`;
  return b.status === 409 ? null : `el duplicado en mayúsculas devolvió ${b.status}, no 409`;
});

await probe('la respuesta de registro no filtra el hash', async () => {
  const r = await nuevoUsuario();
  const txt = JSON.stringify(r.body);
  return /argon2|password_hash|passwordHash/i.test(txt) ? 'la respuesta contiene el hash' : null;
});

await probe('registro de cuenta de invitado y vinculación posterior', async () => {
  const g = await call('POST', '/auth/guest', {
    dob: '1995-05-10',
    gender: 'female',
    height_cm: 165,
    current_weight_kg: 62,
    target_weight_kg: 58,
    activity_level: 1.375,
    weekly_goal_kg: -0.3,
  });
  if (g.status !== 201 && g.status !== 200) return `el alta de invitado devolvió ${g.status}`;
  const gToken = g.body.data.token;
  if (!g.body.data.is_guest) return 'el invitado no tiene is_guest=true';

  const claimEmail = `claimed-${Date.now()}@t.test`;
  const claim = await call('POST', '/auth/claim', { email: claimEmail, password: 'ClaimPassword123' }, { Authorization: `Bearer ${gToken}` });
  if (claim.status !== 201 && claim.status !== 200) return `la vinculación devolvió ${claim.status}`;
  if (claim.body.data.is_guest) return 'tras vincular la cuenta sigue figurando como invitado';
});

console.log('\nInyección y contenido hostil');

await probe('comillas en la búsqueda no rompen la query', async () => {
  const { status } = await call('GET', `/foods/search?q=${encodeURIComponent("pollo' OR 1=1--")}`);
  return status === 200 ? null : `devolvió ${status}`;
});

await probe('intento de DROP en la búsqueda no hace nada', async () => {
  await call('GET', `/foods/search?q=${encodeURIComponent("'; DROP TABLE food_items; --")}`);
  const { body } = await call('GET', '/foods/search?q=pollo');
  return body?.data?.length > 0 ? null : 'la tabla dejó de responder tras el intento';
});

await probe('un nombre con HTML se guarda literal, no interpretado', async () => {
  const name = `<img src=x onerror=alert(1)> ${Date.now()}`;
  const { status, body } = await call('POST', '/foods', {
    name,
    serving_size_amount: 100,
    serving_size_unit: 'g',
    calories: 100,
    protein: 1,
    carbohydrates: 1,
    fat: 1,
  });
  if (status !== 201) return `el alta devolvió ${status}`;
  return body.data.name === name ? null : `el nombre volvió alterado: ${body.data.name}`;
});

await probe('una búsqueda enorme no tumba el endpoint', async () => {
  const { status } = await call('GET', `/foods/search?q=${'a'.repeat(5000)}`);
  return status === 200 ? null : `devolvió ${status}`;
});

console.log('\nNúmeros y fechas');

await probe('porciones con muchos decimales se rechazan', async () => {
  const { status } = await call('POST', '/logs/meal', {
    log_date: hoy,
    meal_type: 'lunch',
    food_item_id: comida.id,
    servings_consumed: 1.123456789,
  });
  return status === 400 ? null : `aceptó 1.123456789 con ${status}`;
});

await probe('porciones no numéricas se rechazan', async () => {
  const { status } = await call('POST', '/logs/meal', {
    log_date: hoy,
    meal_type: 'lunch',
    food_item_id: comida.id,
    servings_consumed: 'muchas',
  });
  return status === 400 ? null : `aceptó texto con ${status}`;
});

await probe('Infinity y NaN se rechazan', async () => {
  const malos = [];
  for (const v of ['Infinity', 'NaN', '1e999']) {
    const { status } = await call('POST', '/logs/meal', {
      log_date: hoy,
      meal_type: 'lunch',
      food_item_id: comida.id,
      servings_consumed: v,
    });
    if (status !== 400) malos.push(`${v} -> ${status}`);
  }
  return malos.length ? malos.join(', ') : null;
});

await probe('una fecha inexistente se rechaza', async () => {
  const { status } = await call('POST', '/logs/meal', {
    log_date: '2026-02-31',
    meal_type: 'lunch',
    food_item_id: comida.id,
    servings_consumed: 1,
  });
  return status === 400 ? null : `aceptó el 31 de febrero con ${status}`;
});

await probe('una comida en el futuro lejano se rechaza', async () => {
  const { status } = await call('POST', '/logs/meal', {
    log_date: '2999-01-01',
    meal_type: 'lunch',
    food_item_id: comida.id,
    servings_consumed: 1,
  });
  return status === 400 ? null : `aceptó el año 2999 con ${status}`;
});

await probe('un peso en el futuro se rechaza', async () => {
  const { status } = await call('POST', '/weight', { logged_on: '2999-01-01', weight_kg: 80 });
  return status === 400 ? null : `aceptó una pesada en 2999 con ${status}`;
});

console.log('\nAislamiento entre usuarios');

await probe('no se lee el diario de otro por su id de entrada', async () => {
  const mia = await call('POST', '/logs/meal', {
    log_date: hoy,
    meal_type: 'dinner',
    food_item_id: comida.id,
    servings_consumed: 1,
  });
  const entryId = mia.body?.data?.entry_id;
  const guardado = token;
  const otro = await nuevoUsuario();
  token = otro.body.data.token;
  const { status } = await call('PATCH', `/logs/meal/${entryId}`, { servings_consumed: 99 });
  token = guardado;
  return status === 404 ? null : `un tercero pudo editarla: ${status}`;
});

await probe('el perfil ajeno no se puede tocar por id', async () => {
  // No hay endpoint por id, pero se verifica que PATCH /profile solo afecte al
  // dueño del token.
  const guardado = token;
  const antes = (await call('GET', '/profile')).body.data.height_cm;
  const otro = await nuevoUsuario({ height_cm: 150 });
  token = otro.body.data.token;
  await call('PATCH', '/profile', { height_cm: 199 });
  token = guardado;
  const despues = (await call('GET', '/profile')).body.data.height_cm;
  return antes === despues ? null : `la altura propia cambió de ${antes} a ${despues}`;
});

console.log('\nConcurrencia');

await probe('dos comidas simultáneas no chocan contra el UNIQUE del diario', async () => {
  const otro = await nuevoUsuario();
  const guardado = token;
  token = otro.body.data.token;
  const dia = '2026-03-15';
  const rs = await Promise.all(
    Array.from({ length: 6 }, () =>
      call('POST', '/logs/meal', {
        log_date: dia,
        meal_type: 'snack',
        food_item_id: comida.id,
        servings_consumed: 1,
      }),
    ),
  );
  const fallos = rs.filter((r) => r.status !== 201).map((r) => r.status);
  const dias = (await call('GET', `/logs/${dia}`)).body.data.entries.length;
  token = guardado;
  if (fallos.length) return `fallaron ${fallos.length} de 6: ${fallos.join(',')}`;
  return dias === 6 ? null : `quedaron ${dias} entradas de 6`;
});

console.log('\nEstados vacíos');

await probe('un día sin registros responde con ceros, no con error', async () => {
  const { status, body } = await call('GET', '/logs/2020-01-01');
  if (status !== 200) return `devolvió ${status}`;
  return body.data.totals.calories === 0 ? null : `calorías = ${body.data.totals.calories}`;
});

await probe('el peso de un usuario nuevo trae solo la pesada del registro', async () => {
  const otro = await nuevoUsuario();
  const guardado = token;
  token = otro.body.data.token;
  const { body } = await call('GET', '/weight');
  token = guardado;
  return body.data.length === 1 ? null : `trajo ${body.data.length} pesadas`;
});

if (hallazgos.length) {
  // Todos los bordes de acá están cerrados: un hallazgo nuevo es una regresión.
  console.error(`\n${hallazgos.length} hallazgo(s):\n  ${hallazgos.join('\n  ')}\n`);
  process.exit(1);
}
console.log('\nSin hallazgos: todos los bordes se comportan.\n');

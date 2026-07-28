import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

/**
 * Recorre la UI como un usuario: registro, búsqueda, alta de comida y
 * verificación de que el total del día subió. Deja screenshots en shots/.
 *
 * Uso: npm run ui:check   (con el API en :3100 y Vite en :5177)
 */
const BASE = process.env.UI_BASE ?? 'http://localhost:5177';
const SHOTS = new URL('../shots/', import.meta.url).pathname.slice(1);
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
const step = async (label, fn) => {
  await fn();
  console.log(`  ok  ${label}`);
};

try {
  await page.goto(BASE);

  await step('carga la pantalla de login', async () => {
    await page.waitForSelector('h1');
    assert.equal(await page.locator('h1').textContent(), 'Entrar');
    await shot('01-login');
  });

  await step('el formulario de registro muestra los campos del SRS', async () => {
    await page.getByRole('button', { name: 'No tengo cuenta' }).click();
    await page.waitForSelector('#dob');
    for (const id of ['#first_name', '#dob', '#gender', '#height_cm', '#current_weight_kg', '#target_weight_kg', '#activity_level', '#weekly_goal_kg']) {
      assert.equal(await page.locator(id).count(), 1, `falta ${id}`);
    }
    await shot('02-registro');
  });

  await step('registra un usuario y entra al diario', async () => {
    await page.fill('#email', `pw-${Date.now()}@fittrack.test`);
    await page.fill('#password', 'PlaywrightTest1');
    await page.fill('#first_name', 'Playwright');
    await page.fill('#dob', '1992-08-14');
    await page.selectOption('#gender', 'male');
    await page.fill('#height_cm', '178.5');
    await page.fill('#current_weight_kg', '82');
    await page.fill('#target_weight_kg', '75');
    await page.selectOption('#activity_level', '1.55');
    await page.fill('#weekly_goal_kg', '-0.5');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // El registro está limitado a 5 por 15 min; sin este aviso el fallo se lee
    // como un bug de la UI.
    const rate = page.locator('.alert', { hasText: 'ThrottlerException' });
    await Promise.race([
      page.waitForSelector('#resumen', { timeout: 20_000 }),
      rate.waitFor({ timeout: 20_000 }).then(() => {
        throw new Error('429: el limiter de registro (5/15min) se agotó. Esperá y reintentá.');
      }),
    ]);
    assert.equal(await page.locator('.calories__value').textContent(), '0');
    await shot('03-diario-vacio');
  });

  await step('la búsqueda devuelve resultados legibles', async () => {
    await page.getByLabel('Buscar alimento').fill('pollo');
    await page.waitForSelector('.result', { timeout: 10_000 });
    const texto = await page.locator('.result').first().innerText();
    assert.match(texto, /Pechuga de pollo cocida/);
    // El bug de $queryRaw se veía acá: "null undefined" en vez de "100g".
    assert.match(texto, /165 kcal \/ 100g/);
    assert.doesNotMatch(texto, /null|undefined|NaN/);
  });

  await step('agrega la comida y el total del día sube', async () => {
    await page.locator('.result').first().click();
    // exact: la sección se llama "Agregar comida" y también matchearía.
    await page.getByLabel('Comida', { exact: true }).selectOption('lunch');
    await page.getByLabel('Porciones', { exact: true }).fill('2');
    // exact: el botón de agua se llama "Agregar un vaso de agua".
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();

    await page.waitForFunction(
      () => document.querySelector('.calories__value')?.textContent !== '0',
      null,
      { timeout: 10_000 },
    );
    assert.equal(await page.locator('.calories__value').textContent(), '330'); // 165 × 2
    const entrada = await page.locator('.entry').first().innerText();
    assert.match(entrada, /Pechuga de pollo cocida/);
    assert.match(entrada, /330 kcal/); // subtotal de la entrada, ya escalado
    // El subtotal de Almuerzo; las comidas vacías muestran un guion.
    assert.match(await page.locator('.meal__head').nth(1).innerText(), /330 kcal/);
    assert.match(await page.locator('.meal__head').first().innerText(), /—/);
    await shot('04-diario-con-comida');
  });

  await step('las barras de macros reflejan lo consumido', async () => {
    const proteina = page.locator('.macro__head').first();
    assert.match(await proteina.innerText(), /Proteína\s+62 g \/ \d+ g/); // 31 × 2
  });

  await step('la confirmación sigue visible tras agregar', async () => {
    assert.match(await page.locator('.alert--ok').innerText(), /registrado/);
  });

  await step('el diario abre en el día local, no en UTC', async () => {
    const local = new Date();
    const esperado = new Date(local.getTime() - local.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
    assert.equal(await page.locator('#date').inputValue(), esperado);
  });

  await step('el panel ofrece los recientes sin escribir nada', async () => {
    await page.waitForSelector('.result', { timeout: 10_000 });
    assert.match(await page.locator('.result').first().innerText(), /Pechuga de pollo cocida/);
    // .first(): la tarjeta de peso también tiene un .hint.
    assert.match(await page.locator('.hint').first().innerText(), /registraste antes/);
  });

  await step('editar porciones en la fila recalcula el total', async () => {
    const porciones = page.getByLabel('Porciones de Pechuga de pollo cocida');
    await porciones.fill('3');
    await porciones.blur();
    await page.waitForFunction(
      () => document.querySelector('.calories__value')?.textContent === '495',
      null,
      { timeout: 10_000 },
    );
  });

  await step('el agua se suma de a un vaso', async () => {
    await page.getByLabel('Agregar un vaso de agua').click();
    await page.waitForFunction(
      () => document.querySelector('.water__value')?.textContent?.includes('0.25'),
      null,
      { timeout: 10_000 },
    );
    await shot('08-con-agua');
  });

  await step('los controles llegan al piso táctil de 44px', async () => {
    for (const label of ['Agregar un vaso de agua', 'Porciones de Pechuga de pollo cocida']) {
      const box = await page.getByLabel(label).boundingBox();
      assert.ok(box && box.height >= 44, `${label} mide ${box?.height}px de alto`);
    }
  });

  await step('quitar una entrada la borra y baja el total', async () => {
    await page.locator('.entry__delete').first().click();
    await page.waitForFunction(
      () => document.querySelector('.calories__value')?.textContent === '0',
      null,
      { timeout: 10_000 },
    );
    assert.equal(await page.locator('.entry').count(), 0);
    await shot('07-tras-quitar');
  });

  // La UI solo registra el peso de hoy; la cadena EMA entre días la cubre el
  // smoke, que sí puede cargar fechas pasadas.
  async function registrarPeso(kg, esperado) {
    await page.getByLabel('Peso de hoy en kilos').fill(kg);
    await page.getByRole('button', { name: 'Registrar' }).click();
    try {
      await page.locator('.weight__ema').filter({ hasText: esperado }).waitFor({ timeout: 15_000 });
    } catch {
      // Un timeout mudo no dice nada: se reporta lo que la tarjeta muestra.
      throw new Error(
        `tras registrar ${kg} kg se esperaba "${esperado}"; la tarjeta dice:\n` +
          (await page.locator('section[aria-labelledby="peso"]').innerText()),
      );
    }
  }

  await step('registrar el peso mueve el objetivo del día', async () => {
    const objetivoAntes = await page.locator('.dial__unit').innerText();
    // 90 y no 82: el usuario se registró con 82 kg, y el objetivo solo se
    // reescribe cuando las calorías cambian de verdad.
    await registrarPeso('90', '90.0 kg');
    await page.waitForFunction(
      (antes) => document.querySelector('.dial__unit')?.innerText !== antes,
      objetivoAntes,
      { timeout: 10_000 },
    );
    await shot('09-peso');
  });

  await step('volver a pesarse el mismo día corrige, no acumula', async () => {
    await registrarPeso('81.4', '81.4 kg');
    // Una sola medición por día: sin serie, ni gráfico ni leyenda.
    assert.equal(await page.locator('.sparkline').count(), 0);
    assert.equal(await page.locator('.weight__legend').count(), 0);
    assert.match(await page.locator('.weight__figures').innerText(), /última pesada 81.4 kg/);
  });

  await step('el estado vacío de búsqueda es explícito', async () => {
    await page.getByLabel('Buscar alimento').fill('zzzzquenoexiste');
    await page.waitForSelector('text=Sin resultados', { timeout: 10_000 });
    // Tipear invalida la confirmación anterior.
    assert.equal(await page.locator('.alert--ok').count(), 0);
  });

  await step('responde a 375px sin scroll horizontal', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    assert.equal(overflow, false, 'hay scroll horizontal en mobile');
    await shot('05-mobile-375');
  });

  await step('el tema oscuro se aplica', async () => {
    const dark = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });
    const p2 = await dark.newPage();
    await p2.goto(BASE);
    await p2.waitForSelector('h1');
    const bg = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await p2.screenshot({ path: `${SHOTS}06-oscuro.png`, fullPage: true });
    await dark.close();
    assert.notEqual(bg, 'rgba(0, 0, 0, 0)', 'el body no tomó color de fondo');
  });

  assert.deepEqual(errors, [], `errores en consola: ${errors.join(' | ')}`);
  console.log(`\nUI verde. Screenshots en apps/web/shots/\n`);
} finally {
  await browser.close();
}

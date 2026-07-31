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
  try {
    await fn();
  } catch (err) {
    // Un timeout no dice nada por sí solo: se deja la pantalla y los mensajes
    // de error visibles, que es lo que uno miraría a mano.
    await shot('fallo').catch(() => {});
    const alertas = await page
      .locator('.alert')
      .allInnerTexts()
      .catch(() => []);
    if (alertas.length) err.message += `\n  alertas en pantalla: ${alertas.join(' | ')}`;
    err.message += `\n  captura: shots/fallo.png`;
    throw err;
  }
  console.log(`  ok  ${label}`);
};

try {
  await page.goto(BASE);

  await step('el head declara viewport e iconos PNG del manifest', async () => {
    // Sin meta viewport el teléfono usa un layout de ~980px y el CSS responsive
    // nunca se activa. Playwright no lo detecta solo: fija el viewport por API.
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    assert.ok(viewport?.includes('width=device-width'), 'falta meta viewport');
    assert.ok(viewport.includes('viewport-fit=cover'), 'falta viewport-fit=cover');

    // Chrome solo ofrece instalar la PWA si hay un PNG de 192 o más.
    const manifest = await page.request.get(`${BASE}/manifest.json`).then((r) => r.json());
    const pngs = manifest.icons.filter((i) => i.type === 'image/png').map((i) => i.sizes);
    assert.ok(pngs.includes('192x192') && pngs.includes('512x512'), 'faltan iconos PNG');
  });

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
    await page.getByLabel('Buscar alimento').fill('Pechuga de pollo cocida');
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
    // Los recientes se pintan con InfiniteMenu, no con la lista .result de la búsqueda.
    await page.waitForSelector('.infinite-menu-card', { timeout: 10_000 });
    assert.match(await page.locator('.infinite-menu-card').first().innerText(), /Pechuga de pollo cocida/);
    // La pestaña activa tiene que ser Recientes al abrir, no Favoritos.
    const activa = page.locator('.food-tabs [aria-selected="true"]');
    assert.match(await activa.innerText(), /Recientes/);
  });

  /**
   * Los recientes se ensucian con cualquier cosa que se registre una vez; un
   * favorito es explícito. Se verifica que sobreviva al reload, que es lo que
   * lo diferencia de un estado de pantalla.
   */
  await step('un alimento se marca como favorito y queda en su pestaña', async () => {
    await page.locator('.infinite-menu-card').first().click();
    await page.waitForSelector('.food-fav', { timeout: 10_000 });
    assert.equal(await page.locator('.food-fav').getAttribute('aria-pressed'), 'false');

    await page.locator('.food-fav').click();
    await page.waitForFunction(
      () => document.querySelector('.food-fav')?.getAttribute('aria-pressed') === 'true',
      null,
      { timeout: 10_000 },
    );

    await page.reload();
    await page.waitForSelector('.view-diario', { timeout: 10_000 });
    await page.getByRole('tab', { name: /Favoritos/ }).click();
    await page.waitForSelector('.infinite-menu-card', { timeout: 10_000 });
    assert.match(
      await page.locator('.infinite-menu-card').first().innerText(),
      /Pechuga de pollo cocida/,
      'el favorito no sobrevivió al reload',
    );

    await page.getByRole('tab', { name: 'Recientes' }).click();
  });

  await step('el agua muestra la meta y su progreso', async () => {
    const meta = await page.locator('.water__goal').innerText();
    assert.match(meta, /de 2/, `la meta por defecto no es 2 L: ${meta}`);
    assert.equal(await page.locator('.water__bar').getAttribute('aria-valuemax'), '2000');
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
    // exact: si no, matchea también el "Registrar ejercicio" de la misma columna.
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
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

  await step('un alimento que no está se puede crear y usar', async () => {
    const nombre = `Milanesa casera ${Date.now()}`;
    await page.getByLabel('Buscar alimento').fill(nombre);
    await page.waitForSelector('text=Podés darlo de alta', { timeout: 10_000 });

    await page.getByRole('button', { name: 'Crear alimento' }).click();
    // El nombre buscado llega precargado.
    assert.equal(await page.locator('#nf-name').inputValue(), nombre);
    await page.fill('#nf-cal', '220');
    await page.fill('#nf-prot', '18');
    await page.fill('#nf-carb', '12');
    await page.fill('#nf-fat', '11');
    await page.getByRole('button', { name: 'Crear y usar' }).click();

    // Queda seleccionado: se puede registrar sin volver a buscarlo.
    await page.waitForSelector('.result[aria-selected="true"]', { timeout: 10_000 });
    // Las porciones vuelven a 1 tras cada alta: no se arrastran del anterior.
    assert.equal(await page.getByLabel('Porciones', { exact: true }).inputValue(), '1');
    await page.getByLabel('Comida', { exact: true }).selectOption('breakfast');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.calories__value')?.textContent === '220',
      null,
      { timeout: 10_000 },
    );
    await shot('10-alimento-nuevo');
  });

  await step('el perfil se puede editar y el objetivo se recalcula', async () => {
    await page.locator('.topbar').getByRole('button', { name: 'Perfil' }).click();
    await page.waitForSelector('#pf-activity', { timeout: 10_000 });
    assert.equal(await page.locator('#pf-height').inputValue(), '178.5');

    const objetivoAntes = await page.locator('.dial__unit').innerText();
    await page.selectOption('#pf-activity', '1.9');
    await page.getByRole('button', { name: 'Guardar' }).click();

    // Acotado a la sección: el panel de comida también deja un .alert--ok.
    const okPerfil = page.locator('section[aria-labelledby="perfil"] .alert--ok');
    await okPerfil.waitFor({ timeout: 10_000 });
    assert.match(await okPerfil.innerText(), /Objetivo actualizado/);
    // El resumen del día refleja el objetivo nuevo sin recargar.
    await page.waitForFunction(
      (antes) => document.querySelector('.dial__unit')?.innerText !== antes,
      objetivoAntes,
      { timeout: 10_000 },
    );
    await shot('11-perfil');
  });

  await step('navegar entre las cuatro vistas por hash router', async () => {
    await page.goto(`${BASE}/#/recetas`);
    await page.waitForSelector('.view-recetas', { timeout: 10_000 });
    assert.match(page.url(), /#\/recetas/);

    await page.goto(`${BASE}/#/progreso`);
    await page.waitForSelector('.view-progreso', { timeout: 10_000 });
    assert.match(page.url(), /#\/progreso/);

    await page.goto(`${BASE}/#/perfil`);
    await page.waitForSelector('.view-perfil', { timeout: 10_000 });
    assert.match(page.url(), /#\/perfil/);

    await page.goto(`${BASE}/#/diario`);
    await page.waitForSelector('.view-diario', { timeout: 10_000 });
  });

  await step('el hash sobrevive a un reload con la fecha correcta', async () => {
    await page.goto(`${BASE}/#/diario/2026-07-28`);
    await page.reload();
    await page.waitForSelector('.view-diario', { timeout: 10_000 });
    assert.match(page.url(), /#\/diario\/2026-07-28/);
  });

  await step('el botón de código de barras abre el escáner y la búsqueda por código responde', async () => {
    await page.goto(`${BASE}/#/diario`);
    await page.waitForSelector('.view-diario', { timeout: 10_000 });

    const btnScanner = page.getByRole('button', { name: 'Escanear código de barras' });
    assert.equal(await btnScanner.count(), 1);

    await btnScanner.click();
    await page.waitForSelector('.barcode-scanner-overlay', { timeout: 5_000 });
    await shot('12-barcode-scanner');

    await page.getByRole('button', { name: 'Cerrar' }).click();
    assert.equal(await page.locator('.barcode-scanner-overlay').count(), 0);
  });

  /**
   * Safari de iOS no tiene BarcodeDetector. Ahora el escáner cae en ZXing, así
   * que sí enciende la cámara; lo que no puede faltar nunca es la salida manual
   * más un mensaje que explique qué pasó.
   */
  await step('sin lector nativo, el escáner explica y deja la salida manual', async () => {
    // Contexto aparte para que el borrado de BarcodeDetector no contamine los
    // pasos siguientes; el token se copia a mano porque no comparten storage.
    const token = await page.evaluate(() => localStorage.getItem('fittrack.token'));
    const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sinLector = await contexto.newPage();

    await sinLector.addInitScript((t) => {
      localStorage.setItem('fittrack.token', t);
      delete window.BarcodeDetector;
    }, token);

    await sinLector.goto(`${BASE}/#/diario`);
    await sinLector.waitForSelector('.view-diario', { timeout: 10_000 });
    await sinLector.getByRole('button', { name: 'Escanear código de barras' }).click();
    await sinLector.waitForSelector('.barcode-scanner-overlay', { timeout: 5_000 });

    // El texto exacto depende de por dónde falle (sin cámara, permiso denegado,
    // sin lector); lo que se exige es que haya una explicación visible.
    const aviso = await sinLector.locator('.barcode-scanner-overlay .alert').innerText();
    assert.ok(aviso.trim().length > 0, 'el escáner falló en silencio');

    // El ingreso manual tiene que quedar disponible: es la única salida.
    assert.equal(await sinLector.getByLabel('Código de barras manual').count(), 1);

    await contexto.close();
  });

  await step('el registro rápido permite agregar calorías directamente', async () => {
    await page.goto(`${BASE}/#/diario`);
    await page.waitForSelector('.view-diario', { timeout: 10_000 });

    await page.getByRole('button', { name: /Registro rápido/i }).click();
    await page.getByPlaceholder('Descripción (ej: Almuerzo afuera)').fill('Empanada al paso');
    await page.getByPlaceholder('Calorías *').fill('350');
    await page.getByRole('button', { name: 'Agregar Registro Rápido' }).click();

    await page.waitForSelector('text=Empanada al paso', { timeout: 10_000 });
  });

  /**
   * La otra mitad de la ecuación: lo que se quema devuelve margen. Se compara
   * el objetivo antes y después porque es el número que el usuario mira, no el
   * total de la tarjeta de ejercicio.
   */
  await step('el ejercicio suma calorías al margen del día', async () => {
    await page.goto(`${BASE}/#/diario`);
    await page.waitForSelector('.view-diario', { timeout: 10_000 });

    const objetivoDe = () =>
      page.evaluate(() => {
        const t = document.querySelector('.dial__unit')?.textContent ?? '';
        return Number(t.match(/de (\d+)/)?.[1] ?? 0);
      });
    const antes = await objetivoDe();

    await page.fill('#ex-actividad', 'correr');
    await page.waitForSelector('.exercise .result', { timeout: 10_000 });
    await page.locator('.exercise .result').first().click();
    await page.fill('#ex-minutos', '30');
    await page.getByRole('button', { name: 'Registrar ejercicio' }).click();

    await page.waitForSelector('.exercise .entry', { timeout: 10_000 });
    const quemadas = await page.evaluate(
      () => Number(document.body.textContent.match(/incluye (\d+) kcal de ejercicio/)?.[1] ?? 0),
    );
    assert.ok(quemadas > 0, 'no se estimaron calorías con el MET');
    assert.equal(await objetivoDe(), antes + quemadas, 'el objetivo no absorbió el ejercicio');
    await shot('14-ejercicio');

    // Y al quitarlo el margen vuelve donde estaba.
    await page.locator('.exercise .entry button', { hasText: 'Quitar' }).first().click();
    await page.waitForFunction((n) => {
      const t = document.querySelector('.dial__unit')?.textContent ?? '';
      return Number(t.match(/de (\d+)/)?.[1] ?? 0) === n;
    }, antes, { timeout: 10_000 });
  });

  await step('la vista de recetas permite consultar y abrir la modal de creación', async () => {
    await page.goto(`${BASE}/#/recetas`);
    await page.waitForSelector('.view-recetas', { timeout: 10_000 });

    await page.getByRole('button', { name: '+ Crear Receta' }).click();
    await page.waitForSelector('.modal-overlay', { timeout: 5_000 });
    await shot('13-crear-receta-modal');
    await page.getByRole('button', { name: '✕' }).click();
  });

  /**
   * Cubre el alta completa y el borrado en dos pasos. Antes el borrado usaba el
   * confirm() del navegador, que además de quedar fuera del diseño bloquea el
   * hilo y ningún test lo podía atravesar.
   */
  await step('una receta se crea y se borra confirmando en la tarjeta', async () => {
    await page.goto(`${BASE}/#/recetas`);
    await page.waitForSelector('.view-recetas', { timeout: 10_000 });

    await page.getByRole('button', { name: '+ Crear Receta' }).click();
    await page.waitForSelector('.modal-overlay', { timeout: 5_000 });

    await page.getByPlaceholder('Ej: Guiso de lentejas').fill('Guiso de prueba');
    await page.getByPlaceholder('Buscar ingrediente para agregar...').fill('pollo');
    await page.locator('.modal-overlay .result').first().click({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Guardar Receta' }).click();

    // La tarjeta, no cualquier texto: el mensaje de confirmación también
    // contiene el nombre de la receta y quedaría matcheando siempre.
    const tarjeta = page.locator('.card--raised', { hasText: 'Guiso de prueba' });
    await tarjeta.waitFor({ timeout: 10_000 });

    // Un solo clic no borra: primero pide confirmación.
    await page.getByRole('button', { name: 'Borrar la receta Guiso de prueba' }).click();
    assert.equal(await page.getByRole('button', { name: 'Confirmar' }).count(), 1);
    assert.equal(await tarjeta.count(), 1, 'se borró sin confirmar');

    // Cancelar la deja donde estaba.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    assert.equal(await page.getByRole('button', { name: 'Confirmar' }).count(), 0);

    await page.getByRole('button', { name: 'Borrar la receta Guiso de prueba' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await tarjeta.waitFor({ state: 'detached', timeout: 10_000 });
  });

  await step('el tablero de progreso muestra rachas, adherencia y gráfico de barras', async () => {
    await page.goto(`${BASE}/#/progreso`);
    await page.waitForSelector('.view-progreso', { timeout: 10_000 });

    await page.waitForSelector('text=Tablero de Progreso', { timeout: 5_000 });
    await page.getByRole('button', { name: '7 Días' }).click();
    await shot('14-progreso-7d');

    await page.getByRole('button', { name: '3 Meses' }).click();
    await shot('15-progreso-3m');

    assert.equal(await page.locator('text=Racha Activa').count(), 1);
  });

  await step('la ruta de restablecimiento de contraseña abre el formulario de reset', async () => {
    await page.goto(`${BASE}/#/reset?token=test-token-123`);
    await page.waitForSelector('.view-reset', { timeout: 10_000 });
    assert.equal(await page.locator('#reset-pass').count(), 1);
    await shot('16-reset-password-view');
  });

  await step('el toggle de tema aplica data-theme', async () => {
    await page.goto(`${BASE}/#/perfil`);
    await page.getByRole('button', { name: 'Oscuro' }).click();
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');

    await page.getByRole('button', { name: 'Claro' }).click();
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');

    // "Sistema" tiene que resolver a un tema concreto, no dejar el atributo
    // vacío: tokens.css declara el oscuro como `:root, [data-theme="dark"]`,
    // así que sin atributo el modo automático da oscuro siempre y alguien con
    // el sistema en claro nunca vería la paleta clara.
    await page.getByRole('button', { name: 'Sistema' }).click();

    // waitForFunction y no assert directo: el atributo lo escribe un listener
    // de matchMedia, que corre después de que emulateMedia resuelve.
    const temaResuelto = (esperado) =>
      page.waitForFunction(
        (t) => document.documentElement.getAttribute('data-theme') === t,
        esperado,
        { timeout: 5_000 },
      );

    await page.emulateMedia({ colorScheme: 'light' });
    await temaResuelto('light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await temaResuelto('dark');

    await page.emulateMedia({ colorScheme: null });

    await page.goto(`${BASE}/#/diario`);
  });

  await step('la búsqueda se maneja con flechas y Enter', async () => {
    await page.getByLabel('Buscar alimento').fill('pollo');
    await page.waitForSelector('.result', { timeout: 10_000 });

    const input = page.getByLabel('Buscar alimento');
    assert.equal(await input.getAttribute('role'), 'combobox');
    assert.equal(await input.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.results').getAttribute('role'), 'listbox');

    await input.press('ArrowDown');
    // El foco sigue en el input: lo que se mueve es el descendiente activo.
    assert.equal(await page.locator('.result[data-activo="true"]').count(), 1);
    const activo = await page.locator('.result[data-activo="true"]').getAttribute('id');
    assert.equal(await input.getAttribute('aria-activedescendant'), activo);

    await input.press('Enter');
    await page.waitForSelector('.result[aria-selected="true"]', { timeout: 5_000 });
    assert.equal(await page.locator('.result[aria-selected="true"]').getAttribute('id'), activo);

    await input.press('Escape');
    assert.equal(await page.locator('.result[aria-selected="true"]').count(), 0);
  });

  await step('ningún campo dispara el zoom de iOS', async () => {
    // Por debajo de 16px, Safari en iOS hace zoom al enfocar y descoloca todo.
    const chicos = await page.evaluate(() =>
      [...document.querySelectorAll('input, select, textarea')]
        .map((el) => ({ id: el.id || el.getAttribute('aria-label') || el.type, px: parseFloat(getComputedStyle(el).fontSize) }))
        .filter((f) => f.px < 16),
    );
    assert.deepEqual(chicos, []);
  });

  await step('una sesión vencida vuelve al login, no a un error', async () => {
    await page.evaluate(() => localStorage.setItem('fittrack.token', 'token.invalido.a-proposito'));
    await page.reload();
    // Con un token roto, la primera llamada da 401 y la app tiene que volver
    // sola a la pantalla de entrada.
    await page.waitForSelector('h1', { timeout: 10_000 });
    assert.equal(await page.locator('h1').textContent(), 'Entrar');
    assert.equal(await page.evaluate(() => localStorage.getItem('fittrack.token')), null);
    await shot('12-sesion-vencida');

    // Los 401 de este paso son el objetivo del paso, no ruido: se descuentan
    // para que el chequeo final de consola siga detectando lo inesperado.
    const sin401 = errors.filter((e) => !/401|Unauthorized/.test(e));
    errors.splice(0, errors.length, ...sin401);
  });

  await step('responde a 375px sin scroll horizontal', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    assert.equal(overflow, false, 'hay scroll horizontal en mobile');

    // scrollWidth solo no alcanza: body tiene overflow-x clip, así que un
    // elemento que se pasa del ancho queda recortado y el chequeo daba verde
    // con el diario cortado por la derecha. Se miden los elementos.
    const desbordan = await page.evaluate(() =>
      [...document.querySelectorAll('.view-container *')]
        .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        // El marquee de recetas se sale a propósito y su contenedor lo recorta.
        .filter((e) => !e.closest('.marquee'))
        .map((e) => String(e.className || e.tagName).slice(0, 40))
        .slice(0, 5),
    );
    assert.deepEqual(desbordan, [], `elementos fuera de pantalla: ${desbordan.join(' | ')}`);
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

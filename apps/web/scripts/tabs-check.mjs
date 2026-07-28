import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const b = await chromium.launch();
// Mismo contexto: dos pestañas comparten origen y localStorage, como en la vida real.
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctx.newPage();

await a.goto('http://localhost:5177');
await a.getByRole('button', { name: 'No tengo cuenta' }).click();
await a.fill('#email', `tabs-${Date.now()}@t.test`);
await a.fill('#password', 'PlaywrightTest1');
await a.fill('#first_name', 'Tabs'); await a.fill('#dob', '1992-08-14');
await a.selectOption('#gender', 'male'); await a.fill('#height_cm', '178');
await a.fill('#current_weight_kg', '82'); await a.fill('#target_weight_kg', '75');
await a.selectOption('#activity_level', '1.55'); await a.fill('#weekly_goal_kg', '-0.5');
await a.getByRole('button', { name: 'Crear cuenta' }).click();
await a.waitForSelector('#resumen');

const c = await ctx.newPage();
await c.goto('http://localhost:5177');
await c.waitForSelector('#resumen');
console.log('  ok  la segunda pestaña entra con la sesión de la primera');

// La pestaña A registra una comida; la B tiene que enterarse sola.
await a.getByLabel('Buscar alimento').fill('pollo');
await a.waitForSelector('.result');
await a.locator('.result').first().click();
await a.getByRole('button', { name: 'Agregar', exact: true }).click();
await a.waitForFunction(() => document.querySelector('.calories__value')?.textContent !== '0');
const totalA = await a.locator('.calories__value').textContent();

await c.waitForFunction(
  (esperado) => document.querySelector('.calories__value')?.textContent === esperado,
  totalA,
  { timeout: 10_000 },
);
console.log(`  ok  la pestaña B se actualizó sola a ${totalA} kcal`);

// Y cerrar sesión en una tiene que echar a la otra.
await a.locator('.topbar').getByRole('button', { name: 'Salir' }).click();
await c.waitForFunction(() => document.querySelector('h1')?.textContent === 'Entrar', null, { timeout: 10_000 });
console.log('  ok  cerrar sesión en A saca a B del diario');

await b.close();
console.log('\nPestañas: todo verde.\n');

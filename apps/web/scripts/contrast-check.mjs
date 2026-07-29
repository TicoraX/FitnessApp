/**
 * Contraste WCAG de los tokens de color, en los dos temas.
 *
 * Existe porque ya pasó una vez: se rediseñó la paleta y el tema claro quedó
 * sin overrides para macros y danger, con los valores oscuros sobre papel
 * blanco (1.6:1). Ningún test lo agarró.
 *
 * getComputedStyle devuelve los tokens en oklch(), así que no se pueden parsear
 * como RGB. Se rasteriza cada color en un canvas de 1px y se lee el píxel.
 *
 * Uso: npm run contrast:check   (con Vite en :5177)
 */
import { chromium } from 'playwright';

const BASE = process.env.UI_BASE ?? 'http://localhost:5177';

// [descripción, token frente, token fondo, mínimo]
// 4.5 donde el token se pinta como texto, 3 para bordes y trazos.
const PARES = [
  ['botón primario', '--color-btn-text', '--color-primary', 4.5],
  // El botón de confirmar un borrado usa danger de fondo con el mismo color de
  // texto que el primario, así que es un par propio y hay que medirlo.
  ['botón de peligro', '--color-btn-text', '--color-danger', 4.5],
  ['texto principal', '--text-main', '--bg-surface', 4.5],
  ['texto muted', '--text-muted', '--bg-surface', 4.5],
  ['texto faint', '--text-faint', '--bg-surface', 4.5],
  ['primario sobre superficie', '--color-primary', '--bg-surface', 3],
  ['danger', '--color-danger', '--bg-surface', 4.5],
  ['calorías', '--color-calories', '--bg-surface', 4.5],
  ['proteína', '--color-protein', '--bg-surface', 4.5],
  ['carbos', '--color-carbs', '--bg-surface', 4.5],
  ['grasas', '--color-fats', '--bg-surface', 4.5],
  ['agua', '--color-water', '--bg-surface', 4.5],
];

const navegador = await chromium.launch();
const page = await navegador.newPage();
await page.goto(BASE);

const medidas = await page.evaluate((pares) => {
  const pixel = (color) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d');
    // Fondo opaco primero: los tokens con alfa se componen contra él.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const luminancia = (rgb) =>
    rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [alto, bajo] = [luminancia(pixel(a)), luminancia(pixel(b))].sort((x, y) => y - x);
    return (alto + 0.05) / (bajo + 0.05);
  };
  const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const correr = () =>
    pares.map(([desc, frente, fondo, min]) => [desc, +ratio(token(frente), token(fondo)).toFixed(2), min]);

  const root = document.documentElement;
  root.setAttribute('data-theme', 'dark');
  const dark = correr();
  root.setAttribute('data-theme', 'light');
  const light = correr();
  root.setAttribute('data-theme', 'dark');
  return { dark, light };
}, PARES);

let fallos = 0;
for (const tema of ['dark', 'light']) {
  console.log(`\n  tema ${tema}`);
  for (const [desc, valor, min] of medidas[tema]) {
    const pasa = valor >= min;
    if (!pasa) fallos++;
    console.log(`  ${pasa ? 'ok  ' : 'FALLA'} ${String(valor).padStart(6)}:1  (min ${min})  ${desc}`);
  }
}

await navegador.close();

if (fallos) {
  console.error(`\n${fallos} par(es) por debajo del mínimo WCAG AA.`);
  process.exit(1);
}
console.log('\nContraste verde en los dos temas.');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AJUSTE_MS, DESCANSO_MS, formatear, segundosRestantes } from './descanso.ts';

/**
 * El caso que justifica todo el diseño: la pestaña estuvo oculta setenta
 * segundos y al volver el número tiene que estar bien en el primer frame, no
 * setenta segundos atrasado como quedaría un contador que se decrementa.
 */
test('la pantalla apagada no atrasa el reloj', () => {
  const T = 1_700_000_000_000;
  const hasta = T + DESCANSO_MS;
  assert.equal(segundosRestantes(hasta, T), 90);
  assert.equal(segundosRestantes(hasta, T + 70_000), 20);
});

test('llegado a cero no sigue de largo', () => {
  const T = 1_700_000_000_000;
  assert.equal(segundosRestantes(T, T), 0);
  assert.equal(segundosRestantes(T, T + 5_000), 0);
});

test('el segundo en curso se muestra entero', () => {
  const T = 1_700_000_000_000;
  // A 20.4 segundos del final quedan 21, no 20: el número baja cuando el
  // segundo termina, que es como lee un reloj cualquiera.
  assert.equal(segundosRestantes(T + 20_400, T), 21);
});

test('sumar quince segundos suma quince', () => {
  const T = 1_700_000_000_000;
  assert.equal(segundosRestantes(T + DESCANSO_MS + AJUSTE_MS, T), 105);
});

test('se lee como un descanso', () => {
  assert.equal(formatear(90), '1:30');
  assert.equal(formatear(5), '0:05');
  assert.equal(formatear(0), '0:00');
  assert.equal(formatear(600), '10:00');
});

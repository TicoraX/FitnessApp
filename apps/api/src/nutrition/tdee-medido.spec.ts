import { tdeeMedido, MIN_DIAS_VENTANA, type DiaMedido } from './tdee-medido';

/** Ventana sintética: n días desde 2026-06-01, con EMA lineal entre dos pesos. */
function ventana(opciones: {
  dias: number;
  intake: number | null;
  quemado?: number;
  pesoInicio?: number;
  pesoFin?: number;
}): DiaMedido[] {
  const { dias, intake, quemado = 0, pesoInicio, pesoFin } = opciones;
  const base = Date.parse('2026-06-01T00:00:00Z');

  return Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    const pesoKg =
      pesoInicio === undefined || pesoFin === undefined
        ? null
        : Number((pesoInicio + ((pesoFin - pesoInicio) * i) / (dias - 1)).toFixed(3));
    return { fecha, intake, quemado, pesoKg };
  });
}

describe('TDEE medido', () => {
  // Las puntas se promedian por semana, así que el ritmo sale de centro a
  // centro. Sobre una tendencia lineal da la misma pendiente que extremo a
  // extremo; el +-2 absorbe el redondeo de los pesos sintéticos del fixture.
  it('bajar de peso da un TDEE mayor que lo comido', () => {
    // 28 días comiendo 2000, bajando 2 kg. Déficit = 2*7700/27 = 570 kcal/día.
    const r = tdeeMedido(ventana({ dias: 28, intake: 2000, pesoInicio: 82, pesoFin: 80 }), 2500);
    expect(r.confiable).toBe(true);
    if (r.confiable) expect(Math.abs(r.tdee - 2570)).toBeLessThanOrEqual(2);
  });

  it('subir de peso da un TDEE menor que lo comido', () => {
    const r = tdeeMedido(ventana({ dias: 28, intake: 3000, pesoInicio: 80, pesoFin: 82 }), 2500);
    expect(r.confiable).toBe(true);
    if (r.confiable) expect(Math.abs(r.tdee - (3000 - 570))).toBeLessThanOrEqual(2);
  });

  it('peso estable da un TDEE igual a lo comido', () => {
    const r = tdeeMedido(ventana({ dias: 28, intake: 2400, pesoInicio: 80, pesoFin: 80 }), 2400);
    expect(r.confiable).toBe(true);
    if (r.confiable) expect(r.tdee).toBe(2400);
  });

  /**
   * El caso que decide todo el diseño: el diario suma el ejercicio del día
   * encima del objetivo, así que lo medido tiene que devolver la línea base SIN
   * entrenos. Con 400 kcal diarias de ejercicio logueado, el número devuelto
   * baja exactamente 400 y sumarlo de vuelta en el diario cierra la cuenta.
   */
  it('descuenta el ejercicio logueado para que el diario no lo cuente dos veces', () => {
    const sin = tdeeMedido(ventana({ dias: 28, intake: 2000, pesoInicio: 82, pesoFin: 80 }), 2500);
    const con = tdeeMedido(
      ventana({ dias: 28, intake: 2000, quemado: 400, pesoInicio: 82, pesoFin: 80 }),
      2500,
    );
    expect(sin.confiable && con.confiable).toBe(true);
    if (sin.confiable && con.confiable) expect(sin.tdee - con.tdee).toBe(400);
  });

  it('una ventana corta no es una medición', () => {
    const r = tdeeMedido(ventana({ dias: 10, intake: 2000, pesoInicio: 82, pesoFin: 81 }), 2500);
    expect(r.confiable).toBe(false);
    if (!r.confiable) expect(r.motivo).toMatch(new RegExp(String(MIN_DIAS_VENTANA)));
  });

  it('registrar pocos días no alcanza, aunque la ventana sea larga', () => {
    const dias = ventana({ dias: 28, intake: null, pesoInicio: 82, pesoFin: 80 });
    // Solo 5 días con comida registrada: el promedio sería una anécdota.
    for (let i = 0; i < 5; i++) dias[i]!.intake = 2000;
    const r = tdeeMedido(dias, 2500);
    expect(r.confiable).toBe(false);
    if (!r.confiable) expect(r.motivo).toMatch(/registrada/);
  });

  it('sin dos pesadas no hay delta que medir', () => {
    const r = tdeeMedido(ventana({ dias: 28, intake: 2000 }), 2500);
    expect(r.confiable).toBe(false);
    if (!r.confiable) expect(r.motivo).toMatch(/pesadas/);
  });

  /**
   * Este lo encontró la verificación contra el stack, no el diseño. Con dos
   * pesadas a 27 días (82 y 80 kg) la EMA va de 82 a 81.8, o sea mide 0.2 kg de
   * los 2 reales, y el TDEE sale 2057 en vez de 2570. El objetivo del día quedó
   * en 1507 cuando debía dar 2020: 500 kcal por debajo, peor que la fórmula.
   */
  it('dos pesadas espaciadas no alcanzan: la EMA no llegó a moverse', () => {
    const dias = ventana({ dias: 28, intake: 2000 });
    dias[0]!.pesoKg = 82;
    // Lo que la EMA realmente marca tras una sola pesada de 80: 0.1*80 + 0.9*82.
    dias[27]!.pesoKg = 81.8;
    const r = tdeeMedido(dias, 2753);
    expect(r.confiable).toBe(false);
    if (!r.confiable) expect(r.motivo).toMatch(/pesadas en 27 días/);
  });

  it('pesándose seguido el delta de la EMA vuelve a servir', () => {
    const r = tdeeMedido(ventana({ dias: 28, intake: 2000, pesoInicio: 82, pesoFin: 80 }), 2753);
    expect(r.confiable).toBe(true);
  });

  it('un número absurdo se descarta en vez de prescribirse', () => {
    // Comer 900 y no moverse de peso mediría un TDEE de 900: dato roto.
    const r = tdeeMedido(ventana({ dias: 28, intake: 900, pesoInicio: 80, pesoFin: 80 }), 2500);
    expect(r.confiable).toBe(false);
    if (!r.confiable) expect(r.motivo).toMatch(/se aleja/);
  });

  it('el delta se divide por los días entre pesadas, no por los de la ventana', () => {
    // 28 días de ventana, pero las pesadas paran en el día 20: el peso cambió
    // en ese tramo y dividir por 27 diluiría el déficit.
    const dias = ventana({ dias: 28, intake: 2000 });
    for (let i = 0; i <= 20; i += 2) {
      dias[i]!.pesoKg = Number((82 - (1.5 * i) / 20).toFixed(3));
    }
    const r = tdeeMedido(dias, 2500);
    expect(r.confiable).toBe(true);
    // 1.5 kg en 20 días = 577.5 kcal/día, no 1.5*7700/27.
    if (r.confiable) {
      // 14 y no 20: el tramo va del centro del primer bloque semanal (día 3) al
      // del último (día 17). La pendiente es la misma, el divisor no.
      expect(r.diasDeVentana).toBe(14);
      expect(Math.abs(r.tdee - Math.round(2000 + (1.5 * 7700) / 20))).toBeLessThanOrEqual(2);
    }
  });
});

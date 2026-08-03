import { objetivoVigente } from './goal-history';

const meta = (effectiveFrom: string, dailyCalories: number, isActive = false) => ({
  effectiveFrom: new Date(`${effectiveFrom}T00:00:00Z`),
  dailyCalories,
  isActive,
});

describe('objetivo vigente en una fecha', () => {
  const historial = [meta('2026-01-01', 2200), meta('2026-08-01', 1800, true)];

  it('un día pasado usa el objetivo de entonces, no el de hoy', () => {
    expect(objetivoVigente(historial, '2026-07-15')?.dailyCalories).toBe(2200);
  });

  it('un día posterior al cambio usa el nuevo', () => {
    expect(objetivoVigente(historial, '2026-08-02')?.dailyCalories).toBe(1800);
  });

  it('el día del cambio ya cuenta como vigente', () => {
    expect(objetivoVigente(historial, '2026-08-01')?.dailyCalories).toBe(1800);
  });

  it('un día anterior al primer objetivo cae al más viejo', () => {
    expect(objetivoVigente(historial, '2025-12-31')?.dailyCalories).toBe(2200);
  });

  it('no depende del orden en que vengan las filas', () => {
    expect(objetivoVigente([...historial].reverse(), '2026-07-15')?.dailyCalories).toBe(2200);
  });

  it('sin objetivos no inventa uno', () => {
    expect(objetivoVigente([], '2026-07-15')).toBeNull();
  });

  /**
   * El caso que rompió la app: pesarse recalcula el objetivo y crea la fila
   * nueva con la fecha de hoy, la misma que la que acaba de desactivar. Sin
   * desempate se elegía la vieja y el margen del día no se movía al pesarse.
   */
  it('entre dos del mismo día gana la activa, venga en el orden que venga', () => {
    const mismoDia = [meta('2026-08-02', 2200), meta('2026-08-02', 2478, true)];
    expect(objetivoVigente(mismoDia, '2026-08-02')?.dailyCalories).toBe(2478);
    expect(objetivoVigente([...mismoDia].reverse(), '2026-08-02')?.dailyCalories).toBe(2478);
  });
});

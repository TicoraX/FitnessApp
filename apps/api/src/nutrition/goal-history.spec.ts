import { objetivoVigente } from './goal-history';

const meta = (effectiveFrom: string, dailyCalories: number) => ({
  effectiveFrom: new Date(`${effectiveFrom}T00:00:00Z`),
  dailyCalories,
});

describe('objetivo vigente en una fecha', () => {
  const historial = [meta('2026-01-01', 2200), meta('2026-08-01', 1800)];

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
});

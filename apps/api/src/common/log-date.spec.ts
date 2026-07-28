import { isLogDate } from './log-date';

const enDias = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('fechas de diario', () => {
  it('acepta un día normal', () => {
    expect(isLogDate('2026-07-27')).toBe(true);
  });

  it('rechaza días que no existen', () => {
    // El caso que llegaba a Postgres y salía como 500.
    expect(isLogDate('2026-02-31')).toBe(false);
    expect(isLogDate('2026-13-01')).toBe(false);
    expect(isLogDate('2026-00-10')).toBe(false);
    expect(isLogDate('2025-02-29')).toBe(false); // 2025 no es bisiesto
  });

  it('acepta el 29 de febrero en año bisiesto', () => {
    expect(isLogDate('2024-02-29')).toBe(true);
  });

  it('rechaza cualquier forma que no sea YYYY-MM-DD', () => {
    for (const v of ['27/07/2026', '2026-7-27', '2026-07-27T10:00:00Z', '', 'ayer', null, 20260727]) {
      expect(isLogDate(v)).toBe(false);
    }
  });

  it('permite el pasado y hasta un año hacia adelante', () => {
    expect(isLogDate('2000-01-01')).toBe(true);
    expect(isLogDate(enDias(30))).toBe(true);
    expect(isLogDate('1999-12-31')).toBe(false);
    expect(isLogDate('2999-01-01')).toBe(false);
  });
});

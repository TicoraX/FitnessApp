import { calculateAge, calculateBmr, calculateTargets, smoothWeight } from './metabolic';

describe('metabolic engine', () => {
  it('calcula la edad respetando el cumpleaños del año en curso', () => {
    expect(calculateAge(new Date('1992-08-14'), new Date('2026-07-27'))).toBe(33);
    expect(calculateAge(new Date('1992-08-14'), new Date('2026-08-14'))).toBe(34);
  });

  it('Mifflin-St Jeor para el caso del SRS §5.1', () => {
    // 10*82 + 6.25*178.5 - 5*33 + 5 = 1775.6 -> 1776
    expect(calculateBmr({ weightKg: 82, heightCm: 178.5, age: 33, gender: 'male' })).toBe(1776);
  });

  it('Katch-McArdle cuando hay % de grasa corporal', () => {
    // LBM = 82 * 0.8 = 65.6 -> 370 + 21.6*65.6 = 1786.96 -> 1787
    expect(
      calculateBmr({ weightKg: 82, heightCm: 178.5, age: 33, gender: 'male', bodyFatPct: 20 }),
    ).toBe(1787);
  });

  it('deriva TDEE, déficit y macros 30/40/30', () => {
    const t = calculateTargets({
      weightKg: 82,
      heightCm: 178.5,
      age: 33,
      gender: 'male',
      activityLevel: 1.55,
      weeklyChangeKg: -0.5,
    });
    expect(t.tdee).toBe(2753); // 1776 * 1.55
    expect(t.dailyCalories).toBe(2203); // 2753 - 550
    expect(t.macros).toEqual({ proteinG: 165, carbsG: 220, fatG: 73 });
  });

  it('nunca prescribe por debajo del piso de seguridad', () => {
    const t = calculateTargets({
      weightKg: 50,
      heightCm: 155,
      age: 60,
      gender: 'female',
      activityLevel: 1.2,
      weeklyChangeKg: -1.5,
    });
    expect(t.dailyCalories).toBe(1200);
  });

  it('suaviza el peso con EMA alpha=0.10', () => {
    expect(smoothWeight(80, 82)).toBe(81.8);
  });
});

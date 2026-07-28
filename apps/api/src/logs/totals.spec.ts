import { EntryForTotals, remaining, sumEntries } from './totals';

const food = (over: Partial<EntryForTotals['foodItem']> = {}) => ({
  calories: 165,
  protein: 31,
  carbohydrates: 0,
  fat: 3.6,
  fiber: 0,
  sugar: 0,
  sodiumMg: 74,
  ...over,
});

describe('totales diarios', () => {
  it('un día vacío da cero, no NaN', () => {
    expect(sumEntries([]).calories).toBe(0);
    expect(sumEntries([]).protein_g).toBe(0);
  });

  it('escala cada entrada por sus porciones y acumula', () => {
    const totals = sumEntries([
      { servingsConsumed: 1.5, foodItem: food() },
      { servingsConsumed: 2, foodItem: food({ calories: 100, protein: 5, carbohydrates: 20, fat: 1 }) },
    ]);
    expect(totals.calories).toBe(448); // 165*1.5 + 100*2 = 447.5 -> 448
    expect(totals.protein_g).toBe(56.5); // 31*1.5 + 5*2
    expect(totals.carbs_g).toBe(40);
    expect(totals.fat_g).toBe(7.4); // 3.6*1.5 + 1*2
  });

  it('acepta Decimal de Prisma (objetos con toString)', () => {
    const decimal = (v: string) => ({ toString: () => v });
    const totals = sumEntries([
      { servingsConsumed: decimal('0.5'), foodItem: { ...food(), protein: decimal('31') } },
    ]);
    expect(totals.calories).toBe(83);
    expect(totals.protein_g).toBe(15.5);
  });

  it('el restante es negativo cuando se pasa del objetivo', () => {
    const totals = sumEntries([{ servingsConsumed: 20, foodItem: food() }]);
    const r = remaining(
      { dailyCalories: 2200, proteinGrams: 165, carbsGrams: 220, fatGrams: 73 },
      totals,
    );
    expect(r.calories).toBe(-1100); // 165*20 = 3300
    expect(r.protein_g).toBe(-455);
  });
});

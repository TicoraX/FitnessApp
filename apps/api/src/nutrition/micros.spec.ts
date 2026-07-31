import { emptyMicros, MICROS, MICRO_KEYS, parseMicros, sumMicros } from './micros';
import { mapOffProduct } from '../foods/off-mapper';

describe('parseMicros', () => {
  it('un micros_json vacío da todos los campos en cero', () => {
    expect(parseMicros({})).toEqual(emptyMicros());
  });

  it('tolera null, strings y basura sin romper', () => {
    expect(parseMicros(null)).toEqual(emptyMicros());
    expect(parseMicros('no es un objeto')).toEqual(emptyMicros());
    expect(parseMicros({ potassium_mg: 'mucho' }).potassium_mg).toBe(0);
    expect(parseMicros({ iron_mg: -5 }).iron_mg).toBe(0);
    expect(parseMicros({ calcium_mg: Infinity }).calcium_mg).toBe(0);
  });

  it('lee los valores válidos e ignora las claves que no conoce', () => {
    const m = parseMicros({ calcium_mg: 120, magnesio_mg: 99 });
    expect(m.calcium_mg).toBe(120);
    expect(Object.keys(m).sort()).toEqual([...MICRO_KEYS].sort());
  });
});

describe('sumMicros', () => {
  it('escala cada entrada por sus porciones', () => {
    const total = sumMicros([
      { micros: parseMicros({ calcium_mg: 100, iron_mg: 2 }), servings: 2 },
      { micros: parseMicros({ calcium_mg: 50 }), servings: 1 },
    ]);
    expect(total.calcium_mg).toBe(250);
    expect(total.iron_mg).toBe(4);
  });

  it('media porción cuenta la mitad', () => {
    const total = sumMicros([{ micros: parseMicros({ potassium_mg: 300 }), servings: 0.5 }]);
    expect(total.potassium_mg).toBe(150);
  });

  it('un día sin entradas da ceros, no null', () => {
    expect(sumMicros([])).toEqual(emptyMicros());
  });
});

describe('micros desde OpenFoodFacts', () => {
  const base = {
    code: '7790001234567',
    product_name: 'Yogur de prueba',
    nutriments: {
      'energy-kcal_100g': 60,
      proteins_100g: 3,
      carbohydrates_100g: 8,
      fat_100g: 1.5,
    } as Record<string, unknown>,
  };

  const mapear = (extra: Record<string, unknown>) => {
    const r = mapOffProduct({ ...base, nutriments: { ...base.nutriments, ...extra } });
    if (!r.ok) throw new Error(`descartado por ${r.reason}`);
    return r.food.microsJson;
  };

  it('pasa los gramos de OFF a miligramos', () => {
    // OFF declara el calcio en gramos: 0.12 g son 120 mg.
    expect(mapear({ calcium_100g: 0.12 }).calcium_mg).toBe(120);
    expect(mapear({ 'vitamin-c_100g': 0.001 }).vitamin_c_mg).toBe(1);
  });

  it('la grasa saturada queda en gramos', () => {
    expect(mapear({ 'saturated-fat_100g': 0.9 }).saturated_fat_g).toBe(0.9);
  });

  it('un valor con la unidad equivocada cuenta cero y no tira el alimento', () => {
    // 500 g de hierro por 100 g de producto es imposible; los macros siguen bien.
    const r = mapOffProduct({ ...base, nutriments: { ...base.nutriments, iron_100g: 500 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.food.microsJson.iron_mg).toBe(0);
      expect(r.food.calories).toBe(60);
    }
  });

  it('sin micros declarados quedan en cero', () => {
    expect(mapear({})).toEqual(emptyMicros());
  });
});

describe('tabla de referencia', () => {
  it('todos los micros tienen etiqueta, unidad y VDR positivo', () => {
    for (const k of MICRO_KEYS) {
      expect(MICROS[k].label.length).toBeGreaterThan(0);
      expect(['g', 'mg']).toContain(MICROS[k].unit);
      expect(MICROS[k].rdi).toBeGreaterThan(0);
    }
  });
});

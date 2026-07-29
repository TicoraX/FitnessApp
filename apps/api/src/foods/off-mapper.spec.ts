import { mapOffProduct, type OffProduct } from './off-mapper';

/** Producto plausible: galletitas. Los tests parten de acá y rompen un campo. */
const BASE: OffProduct = {
  code: '7790040999992',
  product_name: 'Galletitas de agua',
  brands: 'Bagley, Grupo Arcor',
  quantity: '200 g',
  nutriments: {
    'energy-kcal_100g': 434,
    proteins_100g: 9.1,
    carbohydrates_100g: 70.2,
    fat_100g: 12.8,
    fiber_100g: 2.9,
    sugars_100g: 4.1,
    salt_100g: 1.9,
  },
};

const ok = (p: OffProduct) => {
  const r = mapOffProduct(p);
  if (!r.ok) throw new Error(`esperaba que pasara, salió por ${r.reason}`);
  return r.food;
};

const rechazo = (p: OffProduct) => {
  const r = mapOffProduct(p);
  if (r.ok) throw new Error('esperaba un rechazo');
  return r.reason;
};

describe('mapOffProduct', () => {
  it('mapea un producto plausible a 100 g', () => {
    const f = ok(BASE);
    expect(f.barcode).toBe('7790040999992');
    expect(f.name).toBe('Galletitas de agua');
    expect(f.servingSizeAmount).toBe(100);
    expect(f.servingSizeUnit).toBe('g');
    expect(f.calories).toBe(434);
    expect(f.protein).toBe(9.1);
  });

  it('se queda con la primera marca de la lista', () => {
    expect(ok(BASE).brand).toBe('Bagley');
    expect(ok({ ...BASE, brands: '' }).brand).toBeNull();
  });

  it('prefiere el nombre en español cuando existe', () => {
    expect(ok({ ...BASE, product_name_es: 'Galletas de agua' }).name).toBe('Galletas de agua');
  });

  it('convierte sal a sodio y prefiere el sodio directo si está', () => {
    expect(ok(BASE).sodiumMg).toBe(760); // 1.9 g de sal * 400
    const conSodio = { ...BASE, nutriments: { ...BASE.nutriments, sodium_100g: 0.5 } };
    expect(ok(conSodio).sodiumMg).toBe(500); // 0.5 g * 1000
  });

  it('deriva las calorías de los kJ cuando falta el campo en kcal', () => {
    const { 'energy-kcal_100g': _, ...resto } = BASE.nutriments!;
    const f = ok({ ...BASE, nutriments: { ...resto, 'energy-kj_100g': 1816 } });
    expect(f.calories).toBe(434); // 1816 / 4.184
  });

  it('detecta líquidos por el texto de cantidad', () => {
    const liquido: OffProduct = {
      ...BASE,
      quantity: '1.5 L',
      nutriments: { 'energy-kcal_100g': 42, carbohydrates_100g: 10.6, sugars_100g: 10.6 },
    };
    expect(ok(liquido).servingSizeUnit).toBe('ml');
  });

  it('marca verified solo con el flag de moderación de OFF', () => {
    expect(ok(BASE).verified).toBe(false);
    expect(ok({ ...BASE, states_tags: ['en:checked', 'en:complete'] }).verified).toBe(true);
  });

  it('toma como 0 los nutrientes ausentes en vez de descartar la fila', () => {
    const f = ok({
      ...BASE,
      nutriments: { 'energy-kcal_100g': 434, proteins_100g: 9.1, carbohydrates_100g: 70.2, fat_100g: 12.8 },
    });
    expect(f.fiber).toBe(0);
    expect(f.sugar).toBe(0);
    expect(f.sodiumMg).toBe(0);
  });

  it('acepta una bebida sin macros y sin calorías', () => {
    expect(ok({ ...BASE, nutriments: { 'energy-kcal_100g': 0 } }).calories).toBe(0);
  });

  describe('filtros de calidad', () => {
    it('rechaza códigos de barras ausentes o mal formados', () => {
      expect(rechazo({ ...BASE, code: undefined })).toBe('barcode');
      expect(rechazo({ ...BASE, code: '123' })).toBe('barcode');
      expect(rechazo({ ...BASE, code: '779004099999X' })).toBe('barcode');
    });

    it('rechaza nombres ausentes o de una letra', () => {
      expect(rechazo({ ...BASE, product_name: undefined })).toBe('nombre');
      expect(rechazo({ ...BASE, product_name: 'X' })).toBe('nombre');
    });

    it('rechaza calorías ausentes, negativas o sobre 900', () => {
      expect(rechazo({ ...BASE, nutriments: { proteins_100g: 9 } })).toBe('calorias');
      expect(rechazo({ ...BASE, nutriments: { 'energy-kcal_100g': -5 } })).toBe('calorias');
      expect(rechazo({ ...BASE, nutriments: { 'energy-kcal_100g': 1200 } })).toBe('calorias');
    });

    it('rechaza macros fuera de 0 a 100 por 100 g', () => {
      const n = { ...BASE.nutriments, proteins_100g: 140 };
      expect(rechazo({ ...BASE, nutriments: n })).toBe('macro_fuera_de_rango');
    });

    it('rechaza macros que suman más de 105', () => {
      const n = { 'energy-kcal_100g': 700, proteins_100g: 40, carbohydrates_100g: 40, fat_100g: 40 };
      expect(rechazo({ ...BASE, nutriments: n })).toBe('macros_suman_de_mas');
    });

    it('rechaza más azúcar que carbohidratos', () => {
      const n = { ...BASE.nutriments, sugars_100g: 90 };
      expect(rechazo({ ...BASE, nutriments: n })).toBe('azucar_mayor_que_carbos');
    });

    it('rechaza sodio imposible', () => {
      const n = { ...BASE.nutriments, salt_100g: 200 };
      expect(rechazo({ ...BASE, nutriments: n })).toBe('sodio');
    });

    /**
     * El caso que motiva el filtro: 1816 kJ declarados en el campo de kcal. Los
     * macros quedan plausibles y ningún chequeo de rango lo ve, pero el
     * alimento pasa a valer cuatro veces lo que vale.
     */
    it('rechaza kJ declarados como kcal', () => {
      const n = { ...BASE.nutriments, 'energy-kcal_100g': 1816 };
      // Primero cae por el techo de 900; con uno más bajo cae por Atwater.
      expect(rechazo({ ...BASE, nutriments: n })).toBe('calorias');

      const disimulado = { ...BASE.nutriments, 'energy-kcal_100g': 850 };
      expect(rechazo({ ...BASE, nutriments: disimulado })).toBe('atwater');
    });

    // Con los tres macros en cero el teórico de Atwater es cero, así que
    // cualquier caloría que supere la banda cae por ahí. No hace falta una
    // regla propia: sería inalcanzable.
    it('rechaza calorías sin ningún macro detrás', () => {
      expect(rechazo({ ...BASE, nutriments: { 'energy-kcal_100g': 250 } })).toBe('atwater');
    });

    it('tolera el redondeo del fabricante dentro de la banda de Atwater', () => {
      // 4*9.1 + 4*70.2 + 9*12.8 = 432.4 contra 434 declaradas.
      expect(ok(BASE).calories).toBe(434);
    });
  });
});

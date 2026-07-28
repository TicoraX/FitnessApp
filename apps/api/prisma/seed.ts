import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Catálogo mínimo para desarrollo. Valores de referencia aproximados por
 * porción, suficientes para probar búsqueda y totales. NO es un catálogo
 * nutricional verificado: `verified` queda en true solo para distinguirlos de
 * los alimentos que cargan los usuarios, no como garantía de exactitud.
 */
const FOODS = [
  // name, brand, serving, unit, kcal, protein, carbs, fat, fiber, sugar, sodium
  ['Pechuga de pollo cocida', null, 100, 'g', 165, 31, 0, 3.6, 0, 0, 74],
  ['Huevo entero', null, 50, 'g', 72, 6.3, 0.4, 4.8, 0, 0.2, 71],
  ['Arroz blanco cocido', null, 100, 'g', 130, 2.7, 28, 0.3, 0.4, 0.1, 1],
  ['Arroz integral cocido', null, 100, 'g', 123, 2.7, 26, 1, 1.6, 0.4, 4],
  ['Lentejas cocidas', null, 100, 'g', 116, 9, 20, 0.4, 7.9, 1.8, 2],
  ['Poroto negro cocido', null, 100, 'g', 132, 8.9, 24, 0.5, 8.7, 0.3, 2],
  ['Avena en hojuelas', null, 40, 'g', 152, 5.3, 27, 2.7, 4.1, 0.4, 2],
  ['Pan integral', null, 40, 'g', 99, 4.9, 17, 1.3, 2.7, 1.6, 187],
  ['Banana', null, 118, 'g', 105, 1.3, 27, 0.4, 3.1, 14, 1],
  ['Manzana', null, 182, 'g', 95, 0.5, 25, 0.3, 4.4, 19, 2],
  ['Palta', null, 100, 'g', 160, 2, 8.5, 15, 6.7, 0.7, 7],
  ['Brócoli cocido', null, 100, 'g', 35, 2.4, 7.2, 0.4, 3.3, 1.4, 41],
  ['Espinaca cruda', null, 100, 'g', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 79],
  ['Batata cocida', null, 100, 'g', 90, 2, 21, 0.2, 3.3, 6.5, 36],
  ['Papa hervida', null, 100, 'g', 87, 1.9, 20, 0.1, 1.8, 0.9, 4],
  ['Salmón cocido', null, 100, 'g', 208, 20, 0, 13, 0, 0, 59],
  ['Atún al natural', null, 100, 'g', 116, 26, 0, 0.8, 0, 0, 247],
  ['Carne magra de res', null, 100, 'g', 217, 26, 0, 12, 0, 0, 66],
  ['Yogur natural entero', null, 170, 'g', 104, 5.9, 7.9, 5.5, 0, 7.9, 80],
  ['Yogur griego descremado', null, 170, 'g', 100, 17, 6, 0.7, 0, 4, 61],
  ['Leche entera', null, 240, 'ml', 149, 7.7, 12, 8, 0, 12, 105],
  ['Queso port salut', null, 30, 'g', 100, 6.5, 0.6, 8, 0, 0.5, 175],
  ['Almendras', null, 28, 'g', 164, 6, 6.1, 14, 3.5, 1.2, 0],
  ['Maní tostado', null, 28, 'g', 166, 6.8, 6, 14, 2.4, 1.3, 5],
  ['Aceite de oliva', null, 14, 'ml', 119, 0, 0, 14, 0, 0, 0],
  ['Pasta cocida', null, 100, 'g', 158, 5.8, 31, 0.9, 1.8, 0.6, 1],
  ['Garbanzos cocidos', null, 100, 'g', 164, 8.9, 27, 2.6, 7.6, 4.8, 7],
  ['Tofu firme', null, 100, 'g', 144, 17, 2.8, 8.7, 2.3, 0.6, 14],
  ['Proteína de suero en polvo', null, 30, 'g', 120, 24, 3, 1.5, 0, 2, 60],
  ['Chocolate amargo 70%', null, 30, 'g', 170, 2.2, 13, 12, 3.1, 7, 6],
] as const;

async function main() {
  for (const [name, brand, amount, unit, kcal, p, c, f, fib, sug, sod] of FOODS) {
    // Idempotente por nombre para poder re-correr el seed sin duplicar.
    const existing = await prisma.foodItem.findFirst({ where: { name } });
    if (existing) continue;

    await prisma.foodItem.create({
      data: {
        name,
        brand,
        verified: true,
        servingSizeAmount: amount,
        servingSizeUnit: unit,
        calories: kcal,
        protein: p,
        carbohydrates: c,
        fat: f,
        fiber: fib,
        sugar: sug,
        sodiumMg: sod,
      },
    });
  }

  console.log(`Catálogo: ${await prisma.foodItem.count()} alimentos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import { FOODS_DATASET } from './foods-dataset';

const prisma = new PrismaClient();

async function main() {
  console.log(`Poblando base de datos con ${FOODS_DATASET.length} alimentos curados...`);

  for (const [name, brand, amount, unit, kcal, p, c, f, fib, sug, sod] of FOODS_DATASET) {
    const existing = await prisma.foodItem.findFirst({ where: { name } });
    if (existing) continue;

    await prisma.foodItem.create({
      data: {
        name,
        brand,
        verified: true,
        source: 'curated',
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

  const total = await prisma.foodItem.count();
  console.log(`Catálogo completado: ${total} alimentos activos en la base de datos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

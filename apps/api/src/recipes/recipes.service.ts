import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { scaleTotals, sumEntries } from '../logs/totals';
import { CreateRecipeDto, RecipeComponentDto, UpdateRecipeDto } from './dto/recipe.dto';

const CON_COMPONENTES = {
  components: { include: { foodItem: true }, orderBy: { position: 'asc' } },
} as const;

type RecetaConComponentes = Prisma.RecipeGetPayload<{
  include: { components: { include: { foodItem: true } } };
}>;

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const recetas = await this.prisma.recipe.findMany({
      where: { userId, isArchived: false },
      include: CON_COMPONENTES,
      orderBy: { name: 'asc' },
    });

    return {
      status: 'success',
      data: recetas.map((r) => {
        const { per_serving } = totalesDe(r);
        return {
          id: r.id,
          name: r.name,
          total_servings: Number(r.totalServings),
          component_count: r.components.length,
          per_serving,
        };
      }),
    };
  }

  async get(userId: string, id: string) {
    const receta = await this.prisma.recipe.findFirst({
      where: { id, userId, isArchived: false },
      include: CON_COMPONENTES,
    });
    if (!receta) throw new NotFoundException('La receta no existe');
    return { status: 'success', data: detalle(receta) };
  }

  async create(userId: string, dto: CreateRecipeDto) {
    const receta = await this.prisma.recipe.create({
      data: {
        userId,
        name: dto.name,
        totalServings: dto.total_servings,
        components: { create: componentesParaCrear(dto.components) },
      },
      include: CON_COMPONENTES,
    });
    return { status: 'success', data: detalle(receta) };
  }

  /**
   * Propiedad en el where del updateMany, no en un SELECT aparte: si el id no
   * es de este usuario, count vuelve en cero y sale el mismo 404 que si no
   * existiera. Mismo patrón que las entradas del diario.
   */
  async update(userId: string, id: string, dto: UpdateRecipeDto) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.recipe.updateMany({
        where: { id, userId, isArchived: false },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.total_servings !== undefined && { totalServings: dto.total_servings }),
        },
      });
      if (count === 0) throw new NotFoundException('La receta no existe');

      if (dto.components) {
        await tx.recipeComponent.deleteMany({ where: { recipeId: id } });
        await tx.recipeComponent.createMany({
          data: componentesParaCrear(dto.components).map((c) => ({ ...c, recipeId: id })),
        });
      }
    });

    return this.get(userId, id);
  }

  /**
   * Archiva, no borra: hay meal_entries históricas que la referencian y el
   * historial no se reescribe. Mismo criterio que user_goals.
   */
  async archive(userId: string, id: string) {
    const { count } = await this.prisma.recipe.updateMany({
      where: { id, userId, isArchived: false },
      data: { isArchived: true },
    });
    if (count === 0) throw new NotFoundException('La receta no existe');
  }
}

const componentesParaCrear = (cs: RecipeComponentDto[]) =>
  cs.map((c, i) => ({ foodItemId: c.food_item_id, quantity: c.quantity, position: i }));

/**
 * Los componentes son compatibles de forma con lo que espera sumEntries
 * (cantidad por alimento), así que el cálculo nutricional de una receta reusa
 * el mismo código que el de un día. No hace falta aritmética nueva.
 */
function totalesDe(r: RecetaConComponentes) {
  const total = sumEntries(
    r.components.map((c) => ({ servingsConsumed: c.quantity, foodItem: c.foodItem })),
  );
  const rinde = Number(r.totalServings);
  return { total, per_serving: scaleTotals(total, 1 / rinde) };
}

function detalle(r: RecetaConComponentes) {
  const { total, per_serving } = totalesDe(r);
  return {
    id: r.id,
    name: r.name,
    total_servings: Number(r.totalServings),
    per_serving,
    total,
    components: r.components.map((c) => ({
      id: c.id,
      quantity: Number(c.quantity),
      calories: c.foodItem.calories * Number(c.quantity),
      food: {
        id: c.foodItem.id,
        name: c.foodItem.name,
        brand: c.foodItem.brand,
        serving_size_amount: Number(c.foodItem.servingSizeAmount),
        serving_size_unit: c.foodItem.servingSizeUnit,
      },
    })),
  };
}

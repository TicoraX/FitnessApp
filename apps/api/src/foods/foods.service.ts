import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FoodItem, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFoodDto } from './dto/create-food.dto';
import { likePrefix, normalizeQuery } from './search-query';

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Búsqueda difusa vía pg_trgm (L5 del blueprint). El operador % y el ILIKE de
   * prefijo entran los dos por los índices GIN de idx_food_name_trgm/brand_trgm;
   * el ILIKE existe porque términos de 3-4 letras comparten pocos trigramas.
   */
  async search(rawQuery: string, limit: number) {
    const q = normalizeQuery(rawQuery);
    if (q.length < 2) return { status: 'success', data: [] };

    const rows = await this.prisma.$queryRaw<(FoodItem & { score: number })[]>`
      SELECT *,
             GREATEST(similarity(name, ${q}), similarity(COALESCE(brand, ''), ${q})) AS score
      FROM food_items
      WHERE name % ${q}
         OR brand % ${q}
         OR name ILIKE ${likePrefix(q)}
      ORDER BY score DESC, verified DESC, name ASC
      LIMIT ${limit}`;

    return { status: 'success', data: rows.map(toResponse) };
  }

  async findByBarcode(barcode: string) {
    const food = await this.prisma.foodItem.findUnique({ where: { barcode } });
    if (!food) throw new NotFoundException('Código de barras no encontrado');
    return { status: 'success', data: toResponse(food) };
  }

  async create(userId: string, dto: CreateFoodDto) {
    try {
      const food = await this.prisma.foodItem.create({
        data: {
          barcode: dto.barcode,
          name: dto.name,
          brand: dto.brand,
          servingSizeAmount: dto.serving_size_amount,
          servingSizeUnit: dto.serving_size_unit,
          calories: dto.calories,
          protein: dto.protein,
          carbohydrates: dto.carbohydrates,
          fat: dto.fat,
          fiber: dto.fiber ?? 0,
          sugar: dto.sugar ?? 0,
          sodiumMg: dto.sodium_mg ?? 0,
          createdById: userId,
          // verified queda en false: solo el catálogo curado se marca verificado.
        },
      });
      return { status: 'success', data: toResponse(food) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un alimento con ese código de barras');
      }
      throw e;
    }
  }
}

function toResponse(f: FoodItem & { score?: number }) {
  return {
    id: f.id,
    barcode: f.barcode,
    name: f.name,
    brand: f.brand,
    verified: f.verified,
    serving_size_amount: Number(f.servingSizeAmount),
    serving_size_unit: f.servingSizeUnit,
    calories: f.calories,
    protein: Number(f.protein),
    carbohydrates: Number(f.carbohydrates),
    fat: Number(f.fat),
    fiber: Number(f.fiber),
    sugar: Number(f.sugar),
    sodium_mg: Number(f.sodiumMg),
  };
}

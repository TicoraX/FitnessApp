import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealEntryDto } from './dto/create-meal-entry.dto';
import { remaining, sumEntries } from './totals';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async addMealEntry(userId: string, dto: CreateMealEntryDto) {
    const logDate = dto.log_date;

    const entry = await this.prisma.$transaction(async (tx) => {
      const dailyLogId = await this.ensureDailyLog(tx, userId, logDate);
      try {
        return await tx.mealEntry.create({
          data: {
            dailyLogId,
            mealType: dto.meal_type,
            foodItemId: dto.food_item_id,
            servingsConsumed: dto.servings_consumed,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
          throw new NotFoundException('El alimento no existe');
        }
        throw e;
      }
    });

    return {
      status: 'success',
      data: { entry_id: entry.id, ...(await this.getDay(userId, logDate)).data },
    };
  }

  async getDay(userId: string, logDate: string) {
    const [log, goal] = await Promise.all([
      this.prisma.dailyLog.findUnique({
        where: { userId_logDate: { userId, logDate: new Date(logDate) } },
        include: { entries: { include: { foodItem: true }, orderBy: { loggedAt: 'asc' } } },
      }),
      this.prisma.userGoal.findFirst({
        where: { userId, isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    const entries = log?.entries ?? [];
    const totals = sumEntries(entries);

    return {
      status: 'success',
      data: {
        log_date: logDate,
        water_ml: log?.waterMl ?? 0,
        totals,
        remaining: goal ? remaining(goal, totals) : null,
        entries: entries.map((e) => ({
          id: e.id,
          meal_type: e.mealType,
          servings_consumed: Number(e.servingsConsumed),
          logged_at: e.loggedAt,
          food: {
            id: e.foodItem.id,
            name: e.foodItem.name,
            brand: e.foodItem.brand,
            serving_size_amount: Number(e.foodItem.servingSizeAmount),
            serving_size_unit: e.foodItem.servingSizeUnit,
          },
        })),
      },
    };
  }

  /**
   * INSERT ... ON CONFLICT: crear el diario del día es idempotente y atómico,
   * así dos dispositivos registrando a la vez no chocan contra el UNIQUE.
   */
  private async ensureDailyLog(
    tx: Prisma.TransactionClient,
    userId: string,
    logDate: string,
  ): Promise<string> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO daily_logs (user_id, log_date)
      VALUES (${userId}::uuid, ${logDate}::date)
      ON CONFLICT (user_id, log_date) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id`;
    return rows[0].id;
  }
}

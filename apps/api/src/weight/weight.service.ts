import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateAge, calculateTargets, smoothWeight, type Gender } from '../nutrition/metabolic';

@Injectable()
export class WeightService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, loggedOn: string, weightKg: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.weightEntry.upsert({
        where: { userId_loggedOn: { userId, loggedOn: new Date(loggedOn) } },
        create: { userId, loggedOn: new Date(loggedOn), weightKg, emaKg: weightKg },
        update: { weightKg },
      });
      await this.recomputeEma(tx, userId);
      await this.refreshGoal(tx, userId);
    });

    return this.series(userId, 90);
  }

  async series(userId: string, days: number) {
    const from = new Date(Date.now() - days * 86_400_000);
    const entries = await this.prisma.weightEntry.findMany({
      where: { userId, loggedOn: { gte: from } },
      orderBy: { loggedOn: 'asc' },
    });

    return {
      status: 'success',
      data: entries.map((e) => ({
        logged_on: e.loggedOn.toISOString().slice(0, 10),
        weight_kg: Number(e.weightKg),
        ema_kg: Number(e.emaKg),
      })),
    };
  }

  /**
   * Recalcula la cadena completa en orden cronológico. Hace falta porque se
   * puede cargar un peso de una fecha pasada, y eso invalida todas las EMA
   * posteriores. Es O(n) sobre la serie de un usuario: años de pesadas diarias
   * siguen siendo miles de filas.
   */
  private async recomputeEma(tx: Prisma.TransactionClient, userId: string) {
    const entries = await tx.weightEntry.findMany({
      where: { userId },
      orderBy: { loggedOn: 'asc' },
      select: { id: true, weightKg: true, emaKg: true },
    });

    let previous: number | null = null;
    for (const e of entries) {
      const weight = Number(e.weightKg);
      // La primera medición siembra la EMA con su propio valor.
      const ema = previous === null ? weight : smoothWeight(weight, previous);
      if (ema !== Number(e.emaKg)) {
        await tx.weightEntry.update({ where: { id: e.id }, data: { emaKg: ema } });
      }
      previous = ema;
    }
  }

  /**
   * Ajuste dinámico (§1 del blueprint): al cambiar el peso cambian BMR y TDEE.
   * Se usa la EMA y no la pesada cruda, para que el objetivo no salte con la
   * oscilación diaria de agua. Solo crea un objetivo nuevo si las calorías
   * cambiaron; si no, la tabla se llenaría de filas idénticas.
   */
  private async refreshGoal(tx: Prisma.TransactionClient, userId: string) {
    const [user, goal, latest] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
      tx.userGoal.findFirst({ where: { userId, isActive: true }, orderBy: { effectiveFrom: 'desc' } }),
      tx.weightEntry.findFirst({ where: { userId }, orderBy: { loggedOn: 'desc' } }),
    ]);
    if (!goal || !latest) return;

    const targets = calculateTargets({
      weightKg: Number(latest.emaKg),
      heightCm: Number(user.heightCm),
      age: calculateAge(user.dob),
      gender: user.gender as Gender,
      activityLevel: Number(user.activityLevel),
      weeklyChangeKg: Number(goal.weeklyChangeKg),
    });

    if (targets.dailyCalories === goal.dailyCalories) return;

    await tx.userGoal.update({ where: { id: goal.id }, data: { isActive: false } });
    await tx.userGoal.create({
      data: {
        userId,
        targetWeightKg: goal.targetWeightKg,
        weeklyChangeKg: goal.weeklyChangeKg,
        dailyCalories: targets.dailyCalories,
        proteinGrams: targets.macros.proteinG,
        carbsGrams: targets.macros.carbsG,
        fatGrams: targets.macros.fatG,
      },
    });
  }
}

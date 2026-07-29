import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calculateAge, calculateTargets, type Gender } from './metabolic';

/**
 * Recálculo del objetivo activo. Vive acá y no dentro de un módulo porque lo
 * disparan dos cosas distintas: pesarse y editar el perfil.
 */
@Injectable()
export class GoalsService {
  /**
   * Usa la EMA del peso, que siempre existe: el registro siembra la serie con
   * el peso declarado. Solo escribe un objetivo nuevo si las calorías
   * cambiaron; si no, la tabla se llena de filas idénticas.
   *
   * bodyFatPct se arrastra desde el usuario para no cambiar de fórmula a mitad
   * de camino: si el registro calculó con Katch-McArdle, el recálculo también.
   */
  async refresh(tx: Prisma.TransactionClient, userId: string) {
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
      bodyFatPct: user.bodyFatPct === null ? undefined : Number(user.bodyFatPct),
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

@Global()
@Module({ providers: [GoalsService], exports: [GoalsService] })
export class GoalsModule {}

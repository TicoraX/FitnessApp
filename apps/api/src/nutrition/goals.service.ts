import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calculateAge, calculateTargets, calculateBmr, calculateTdee, type Gender } from './metabolic';
import { tdeeMedido, MIN_DIAS_VENTANA, type DiaMedido } from './tdee-medido';

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
  /**
   * `vigenteDesde` es el día del usuario, no el del servidor.
   *
   * effective_from cae por defecto en now(), que es UTC. Para cualquiera al
   * oeste de Greenwich eso adelanta la fecha: pesarse a las 20:00 en Argentina
   * estampa el objetivo nuevo con la fecha de mañana, y el día que el usuario
   * está mirando nunca lo alcanza. Quien tiene la fecha correcta es el cliente,
   * que ya la manda en logged_on.
   */
  async refresh(tx: Prisma.TransactionClient, userId: string, vigenteDesde?: string) {
    const [user, goal, latest] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
      tx.userGoal.findFirst({ where: { userId, isActive: true }, orderBy: { effectiveFrom: 'desc' } }),
      tx.weightEntry.findFirst({ where: { userId }, orderBy: { loggedOn: 'desc' } }),
    ]);

    if (!goal || !latest) return;

    const base = {
      weightKg: Number(latest.emaKg),
      heightCm: Number(user.heightCm),
      age: calculateAge(user.dob),
      gender: user.gender as Gender,
      activityLevel: Number(user.activityLevel),
      weeklyChangeKg: Number(goal.weeklyChangeKg),
      bodyFatPct: user.bodyFatPct === null ? undefined : Number(user.bodyFatPct),
    };

    // El multiplicador de actividad lo elige el usuario de un dropdown y es la
    // fuente de error dominante del objetivo. Cuando hay datos suficientes se
    // reemplaza por gasto medido; si no los hay, la fórmula sigue mandando.
    const medido = await this.medirTdee(tx, userId, calculateTdee(calculateBmr(base), base.activityLevel));
    const targets = calculateTargets(medido.confiable ? { ...base, tdeeMedidoKcal: medido.tdee } : base);

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
        ...(vigenteDesde ? { effectiveFrom: new Date(vigenteDesde) } : {}),
      },
    });
  }

  /**
   * Arma la ventana que necesita tdeeMedido: un día por fecha, con lo comido,
   * lo quemado y la EMA del peso de ese día.
   *
   * La ventana es de 42 días y el mínimo de 14: sobra margen para que la EMA
   * se mueva sin arrastrar datos tan viejos que ya no describen al usuario de
   * hoy. Las tres consultas van en paralelo y se cruzan por fecha en memoria,
   * que para seis semanas de filas es más simple que un FULL OUTER JOIN.
   */
  private async medirTdee(tx: Prisma.TransactionClient, userId: string, tdeeEstimado: number) {
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 42 * 86_400_000);

    const [intakes, quemados, pesadas] = await Promise.all([
      tx.$queryRaw<{ dia: Date; kcal: number }[]>`
        SELECT d.log_date AS "dia",
               ROUND(SUM(COALESCE(f.calories, e.quick_calories) * e.servings_consumed))::int AS "kcal"
        FROM daily_logs d
        JOIN meal_entries e ON e.daily_log_id = d.id
        LEFT JOIN food_items f ON f.id = e.food_item_id
        WHERE d.user_id = ${userId}::uuid AND d.log_date >= ${desde}::date
        GROUP BY d.log_date`,
      tx.$queryRaw<{ dia: Date; kcal: number }[]>`
        SELECT d.log_date AS "dia", SUM(x.calories_burned)::int AS "kcal"
        FROM daily_logs d
        JOIN exercise_entries x ON x.daily_log_id = d.id
        WHERE d.user_id = ${userId}::uuid AND d.log_date >= ${desde}::date
        GROUP BY d.log_date`,
      tx.weightEntry.findMany({
        where: { userId, loggedOn: { gte: desde } },
        orderBy: { loggedOn: 'asc' },
        select: { loggedOn: true, weightKg: true },
      }),
    ]);

    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const porIntake = new Map(intakes.map((r) => [dia(r.dia), r.kcal]));
    const porQuemado = new Map(quemados.map((r) => [dia(r.dia), r.kcal]));
    // Peso crudo y no la EMA: la EMA arrastra un retraso que comprime el delta
    // y sesga el TDEE hacia abajo. tdee-medido.ts lo promedia por semana.
    const porPeso = new Map(pesadas.map((r) => [dia(r.loggedOn), Number(r.weightKg)]));

    const fechas = [...new Set([...porIntake.keys(), ...porQuemado.keys(), ...porPeso.keys()])].sort();
    if (fechas.length < MIN_DIAS_VENTANA) return { confiable: false as const };

    const ventana: DiaMedido[] = fechas.map((f) => ({
      fecha: f,
      intake: porIntake.get(f) ?? null,
      quemado: porQuemado.get(f) ?? 0,
      pesoKg: porPeso.get(f) ?? null,
    }));

    return tdeeMedido(ventana, tdeeEstimado);
  }
}

@Global()
@Module({ providers: [GoalsService], exports: [GoalsService] })
export class GoalsModule {}

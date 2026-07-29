import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Todo acá se agrega en SQL y no con el sumEntries de logs/totals.ts. Un día
 * son decenas de filas y se suman en JS sin problema; un rango de un año son
 * decenas de miles y traerlas al proceso para sumarlas es tirar la base a la
 * basura.
 *
 * Dos reglas de $queryRaw que aplican en cada query de este archivo:
 * 1. No aplica el @map del schema, así que toda columna snake_case necesita
 *    alias explícito.
 * 2. SUM() y AVG() sobre numeric vuelven como Decimal de Prisma, no como
 *    number, y saldrían en el JSON como objetos. Van casteadas a ::int o
 *    ::float8. ROUND(x, 1) exige numeric, así que el orden es ROUND(...)::float8
 *    y nunca al revés.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, from: string, to: string) {
    const dias = this.diasEnRango(from, to);

    const [porDia, resumen] = await Promise.all([
      this.totalesPorDia(userId, from, to),
      this.resumenDelPeriodo(userId, from, to),
    ]);

    return {
      status: 'success',
      data: {
        range: { from, to, days_in_range: dias },
        days_logged: resumen.daysLogged,
        averages: {
          calories: resumen.avgCalories ?? 0,
          protein_g: resumen.avgProteinG ?? 0,
          carbs_g: resumen.avgCarbsG ?? 0,
          fat_g: resumen.avgFatG ?? 0,
          fiber_g: resumen.avgFiberG ?? 0,
          sugar_g: resumen.avgSugarG ?? 0,
          sodium_mg: resumen.avgSodiumMg ?? 0,
        },
        adherence: {
          goal_calories: resumen.avgGoalCalories,
          days_with_goal: resumen.daysWithGoal,
          days_on_target: resumen.daysOnTarget,
          pct_on_target: resumen.daysWithGoal
            ? Number(((resumen.daysOnTarget / resumen.daysWithGoal) * 100).toFixed(1))
            : null,
          avg_delta_calories: resumen.avgDeltaCalories,
        },
        days: porDia.map((d) => ({
          log_date: d.logDate.toISOString().slice(0, 10),
          calories: d.calories,
          protein_g: d.proteinG,
          carbs_g: d.carbsG,
          fat_g: d.fatG,
          fiber_g: d.fiberG,
          sugar_g: d.sugarG,
          sodium_mg: d.sodiumMg,
        })),
      },
    };
  }

  /**
   * JOIN y no LEFT JOIN contra meal_entries a propósito: daily_logs también
   * tiene filas creadas solo por registrar agua, y un día en el que únicamente
   * tomaste agua no es un día registrado. Si contara, arruinaría los promedios
   * y regalaría rachas.
   *
   * El LEFT JOIN contra food_items sí hace falta: desde el quick add hay
   * entradas sin alimento, y ahí los nutrientes salen de las columnas quick_*.
   */
  private totalesPorDia(userId: string, from: string, to: string) {
    return this.prisma.$queryRaw<
      {
        logDate: Date;
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
        fiberG: number;
        sugarG: number;
        sodiumMg: number;
      }[]
    >`
      SELECT
        d.log_date AS "logDate",
        ROUND(SUM(COALESCE(f.calories,      e.quick_calories) * e.servings_consumed))::int      AS "calories",
        ROUND(SUM(COALESCE(f.protein,       e.quick_protein)  * e.servings_consumed), 1)::float8 AS "proteinG",
        ROUND(SUM(COALESCE(f.carbohydrates, e.quick_carbs)    * e.servings_consumed), 1)::float8 AS "carbsG",
        ROUND(SUM(COALESCE(f.fat,           e.quick_fat)      * e.servings_consumed), 1)::float8 AS "fatG",
        ROUND(SUM(COALESCE(f.fiber,     0) * e.servings_consumed), 1)::float8 AS "fiberG",
        ROUND(SUM(COALESCE(f.sugar,     0) * e.servings_consumed), 1)::float8 AS "sugarG",
        ROUND(SUM(COALESCE(f.sodium_mg, 0) * e.servings_consumed), 1)::float8 AS "sodiumMg"
      FROM daily_logs d
      JOIN meal_entries e ON e.daily_log_id = d.id
      LEFT JOIN food_items f ON f.id = e.food_item_id
      WHERE d.user_id = ${userId}::uuid
        AND d.log_date >= ${from}::date
        AND d.log_date <= ${to}::date
      GROUP BY d.log_date
      ORDER BY d.log_date`;
  }

  /**
   * La adherencia se mide contra el objetivo vigente ESE día, no contra el
   * activo hoy: is_active describe el presente y un rango de un mes puede
   * cruzar tres objetivos distintos. De ahí el LATERAL, que trae para cada día
   * la fila de user_goals con el mayor effective_from que no lo supere.
   */
  private async resumenDelPeriodo(userId: string, from: string, to: string) {
    const [row] = await this.prisma.$queryRaw<
      {
        daysLogged: number;
        avgCalories: number | null;
        avgProteinG: number | null;
        avgCarbsG: number | null;
        avgFatG: number | null;
        avgFiberG: number | null;
        avgSugarG: number | null;
        avgSodiumMg: number | null;
        avgGoalCalories: number | null;
        daysWithGoal: number;
        daysOnTarget: number;
        avgDeltaCalories: number | null;
      }[]
    >`
      WITH days AS (
        SELECT
          d.log_date,
          SUM(COALESCE(f.calories,      e.quick_calories) * e.servings_consumed) AS calories,
          SUM(COALESCE(f.protein,       e.quick_protein)  * e.servings_consumed) AS protein_g,
          SUM(COALESCE(f.carbohydrates, e.quick_carbs)    * e.servings_consumed) AS carbs_g,
          SUM(COALESCE(f.fat,           e.quick_fat)      * e.servings_consumed) AS fat_g,
          SUM(COALESCE(f.fiber,     0) * e.servings_consumed) AS fiber_g,
          SUM(COALESCE(f.sugar,     0) * e.servings_consumed) AS sugar_g,
          SUM(COALESCE(f.sodium_mg, 0) * e.servings_consumed) AS sodium_mg
        FROM daily_logs d
        JOIN meal_entries e ON e.daily_log_id = d.id
        LEFT JOIN food_items f ON f.id = e.food_item_id
        WHERE d.user_id = ${userId}::uuid
          AND d.log_date >= ${from}::date
          AND d.log_date <= ${to}::date
        GROUP BY d.log_date
      ),
      scored AS (
        SELECT dd.*, g.daily_calories
        FROM days dd
        LEFT JOIN LATERAL (
          SELECT ug.daily_calories
          FROM user_goals ug
          WHERE ug.user_id = ${userId}::uuid
          -- Primero los objetivos que ya estaban vigentes ese día y, de esos,
          -- el más cercano hacia atrás. Si ninguno lo estaba (días cargados
          -- hacia atrás, antes de que existiera la cuenta) cae al más cercano
          -- hacia adelante: el usuario tiene un objetivo, y decirle "sin
          -- objetivo" sobre sus propios días registrados no le sirve de nada.
          -- La misma expresión resuelve los dos casos porque en ambos se busca
          -- el effective_from más cercano.
          ORDER BY (ug.effective_from <= dd.log_date) DESC,
                   ABS(dd.log_date - ug.effective_from) ASC
          LIMIT 1
        ) g ON true
      )
      SELECT
        COUNT(*)::int                     AS "daysLogged",
        ROUND(AVG(calories))::int         AS "avgCalories",
        ROUND(AVG(protein_g),  1)::float8 AS "avgProteinG",
        ROUND(AVG(carbs_g),    1)::float8 AS "avgCarbsG",
        ROUND(AVG(fat_g),      1)::float8 AS "avgFatG",
        ROUND(AVG(fiber_g),    1)::float8 AS "avgFiberG",
        ROUND(AVG(sugar_g),    1)::float8 AS "avgSugarG",
        ROUND(AVG(sodium_mg),  1)::float8 AS "avgSodiumMg",
        ROUND(AVG(daily_calories))::int   AS "avgGoalCalories",
        COUNT(*) FILTER (WHERE daily_calories IS NOT NULL)::int AS "daysWithGoal",
        -- Banda del 10%: exigir el número exacto no mediría nada, nadie clava
        -- 2100 kcal.
        COUNT(*) FILTER (
          WHERE daily_calories IS NOT NULL
            AND calories BETWEEN daily_calories * 0.90 AND daily_calories * 1.10
        )::int AS "daysOnTarget",
        ROUND(AVG(calories - daily_calories))::int AS "avgDeltaCalories"
      FROM scored`;

    // Un rango sin días registrados devuelve una fila de NULLs con COUNT en 0.
    // El mapeo a cero vive en summary(); acá solo se garantiza que haya fila.
    return row;
  }

  async weight(userId: string, from: string, to: string) {
    const [series, [trend], goal] = await Promise.all([
      this.prisma.$queryRaw<{ loggedOn: Date; weightKg: number; emaKg: number }[]>`
        SELECT w.logged_on AS "loggedOn",
               w.weight_kg::float8 AS "weightKg",
               w.ema_kg::float8    AS "emaKg"
        FROM weight_entries w
        WHERE w.user_id = ${userId}::uuid
          AND w.logged_on >= ${from}::date
          AND w.logged_on <= ${to}::date
        ORDER BY w.logged_on`,

      // En un agregado y no con un first/last en JS: la serie de un año son
      // 365 filas y no hace falta recorrerlas dos veces.
      this.prisma.$queryRaw<
        {
          points: number;
          firstOn: Date | null;
          lastOn: Date | null;
          startEmaKg: number | null;
          endEmaKg: number | null;
        }[]
      >`
        SELECT
          COUNT(*)::int  AS "points",
          MIN(logged_on) AS "firstOn",
          MAX(logged_on) AS "lastOn",
          -- La EMA y no el peso crudo: comparar dos pesadas sueltas mide el
          -- agua y la digestión de esos dos días, no la tendencia.
          (array_agg(ema_kg ORDER BY logged_on ASC ))[1]::float8 AS "startEmaKg",
          (array_agg(ema_kg ORDER BY logged_on DESC))[1]::float8 AS "endEmaKg"
        FROM weight_entries
        WHERE user_id = ${userId}::uuid
          AND logged_on >= ${from}::date
          AND logged_on <= ${to}::date`,

      this.prisma.userGoal.findFirst({
        where: { userId, isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    return {
      status: 'success',
      data: {
        series: series.map((p) => ({
          logged_on: p.loggedOn.toISOString().slice(0, 10),
          weight_kg: p.weightKg,
          ema_kg: p.emaKg,
        })),
        trend: this.tendencia(trend, goal),
      },
    };
  }

  private tendencia(
    t: { points: number; firstOn: Date | null; lastOn: Date | null; startEmaKg: number | null; endEmaKg: number | null },
    goal: { targetWeightKg: unknown; weeklyChangeKg: unknown } | null,
  ) {
    const objetivoKg = goal ? Number(goal.targetWeightKg) : null;
    const ritmoObjetivo = goal ? Number(goal.weeklyChangeKg) : null;

    // Con una sola pesada no hay tendencia, hay un punto.
    if (t.points < 2 || t.startEmaKg === null || t.endEmaKg === null) {
      return {
        points: t.points,
        start_ema_kg: t.startEmaKg,
        end_ema_kg: t.endEmaKg,
        change_kg: null,
        weekly_rate_kg: null,
        goal_weekly_kg: ritmoObjetivo,
        target_weight_kg: objetivoKg,
        projected_target_date: null,
      };
    }

    const dias = Math.max(
      Math.round((t.lastOn!.getTime() - t.firstOn!.getTime()) / 86_400_000),
      1,
    );
    const cambio = Number((t.endEmaKg - t.startEmaKg).toFixed(2));
    const ritmo = Number(((cambio / dias) * 7).toFixed(2));

    return {
      points: t.points,
      start_ema_kg: t.startEmaKg,
      end_ema_kg: t.endEmaKg,
      change_kg: cambio,
      weekly_rate_kg: ritmo,
      goal_weekly_kg: ritmoObjetivo,
      target_weight_kg: objetivoKg,
      projected_target_date: this.proyectar(t.endEmaKg, objetivoKg, ritmo, t.lastOn!),
    };
  }

  /**
   * Devuelve null cuando el ritmo es cero o apunta al lado contrario del
   * objetivo. Extrapolar una tendencia de subida hacia una meta de bajada da
   * una fecha en el pasado o dentro de cuarenta años: mejor que la UI diga que
   * a este ritmo no se llega.
   */
  private proyectar(actual: number, objetivo: number | null, ritmoSemanal: number, desde: Date) {
    if (objetivo === null || ritmoSemanal === 0) return null;

    const falta = objetivo - actual;
    if (Math.sign(falta) !== Math.sign(ritmoSemanal)) return null;

    const semanas = falta / ritmoSemanal;
    // Cinco años: más allá de eso la proyección es ruido, no información.
    if (semanas > 260) return null;

    const fecha = new Date(desde.getTime() + semanas * 7 * 86_400_000);
    return fecha.toISOString().slice(0, 10);
  }

  /**
   * Racha por gaps and islands: en una corrida de fechas consecutivas,
   * fecha menos row_number() es constante, porque los dos avanzan de a uno.
   * Ese valor identifica la isla.
   */
  async streak(userId: string, today: string) {
    const [row] = await this.prisma.$queryRaw<
      { currentStreak: number; longestStreak: number; lastLoggedOn: Date | null }[]
    >`
      WITH logged AS (
        -- El EXISTS es necesario: daily_logs tiene filas creadas solo por
        -- registrar agua, y eso no es un día registrado.
        SELECT d.log_date
        FROM daily_logs d
        WHERE d.user_id = ${userId}::uuid
          AND d.log_date <= ${today}::date
          AND EXISTS (SELECT 1 FROM meal_entries e WHERE e.daily_log_id = d.id)
      ),
      grp AS (
        SELECT log_date,
               log_date - (ROW_NUMBER() OVER (ORDER BY log_date))::int AS island
        FROM logged
      ),
      islands AS (
        SELECT island, COUNT(*)::int AS len, MAX(log_date) AS ended_on
        FROM grp GROUP BY island
      )
      SELECT
        -- Se admite que hoy todavía no hayas cargado nada: cortar la racha a
        -- las 00:01 sería castigarte por no haber desayunado aún.
        COALESCE((SELECT len FROM islands
                  WHERE ended_on >= ${today}::date - 1
                  ORDER BY ended_on DESC LIMIT 1), 0) AS "currentStreak",
        COALESCE((SELECT MAX(len) FROM islands), 0)   AS "longestStreak",
        (SELECT MAX(ended_on) FROM islands)           AS "lastLoggedOn"`;

    return {
      status: 'success',
      data: {
        current_streak: row.currentStreak,
        longest_streak: row.longestStreak,
        last_logged_on: row.lastLoggedOn ? row.lastLoggedOn.toISOString().slice(0, 10) : null,
      },
    };
  }

  /** Días del rango, inclusive en los dos extremos. */
  private diasEnRango(from: string, to: string) {
    const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
    return Math.round(ms / 86_400_000) + 1;
  }

  /**
   * class-validator no compara campos hermanos con comodidad y un decorador a
   * medida para dos reglas no se paga. El tope de 366 días acota el bucle
   * anidado del plan de ejecución y es el rango más grande que muestra
   * cualquier pantalla.
   */
  validarRango(from: string, to: string) {
    if (to < from) throw new BadRequestException('El rango termina antes de empezar');
    if (this.diasEnRango(from, to) > 366) {
      throw new BadRequestException('El rango no puede superar los 366 días');
    }
  }
}

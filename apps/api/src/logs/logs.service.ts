import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealEntryDto } from './dto/create-meal-entry.dto';
import { CopyDto, LogRecipeDto, QuickAddDto } from './dto/shortcuts.dto';
import { nutrientsOf, remaining, sumEntries } from './totals';

/** Fila del diario tal como la devuelve getDay, ya lista para el cliente. */
export type EntryDto = {
  kind: 'food' | 'quick' | 'recipe';
  id: string;
  meal_type: string;
  servings_consumed: number;
  logged_at: Date;
  calories: number;
  recipe_id?: string;
  food: {
    id: string | null;
    name: string;
    brand: string | null;
    serving_size_amount: number;
    serving_size_unit: string;
  };
  components?: EntryDto[];
};

type EntryRow = Prisma.MealEntryGetPayload<{
  include: { foodItem: true; recipe: { select: { id: true; name: true } } };
}>;

/** Escaladas pero SIN redondear: el cliente suma y redondea al final, igual que
 *  totals. Redondear acá hace que los subtotales por comida no cierren con el
 *  total del día (248 + 248 = 496 vs 495). */
const caloriasDe = (e: EntryRow) =>
  nutrientsOf(e).calories * Number(e.servingsConsumed);

function filaSimple(e: EntryRow): EntryDto {
  const esQuick = e.foodItem === null;
  return {
    kind: esQuick ? 'quick' : 'food',
    id: e.id,
    meal_type: e.mealType,
    servings_consumed: Number(e.servingsConsumed),
    logged_at: e.loggedAt,
    calories: caloriasDe(e),
    food: esQuick
      ? {
          id: null,
          name: e.quickName ?? 'Sin nombre',
          brand: null,
          serving_size_amount: 1,
          serving_size_unit: 'porción',
        }
      : {
          id: e.foodItem!.id,
          name: e.foodItem!.name,
          brand: e.foodItem!.brand,
          serving_size_amount: Number(e.foodItem!.servingSizeAmount),
          serving_size_unit: e.foodItem!.servingSizeUnit,
        },
  };
}

/**
 * Una receta logueada vive como N filas expandidas, pero el diario tiene que
 * mostrar una sola línea: nadie quiere ver los seis ingredientes de su guiso
 * cada vez. Se agrupa por recipe_group_id y los componentes quedan adentro para
 * poder desplegarlos.
 *
 * Como las filas vienen ordenadas por loggedAt, emitir el grupo en la posición
 * de su primera fila deja el orden del día estable sin ordenar de nuevo.
 */
function colapsarRecetas(entries: EntryRow[]): EntryDto[] {
  const salida: EntryDto[] = [];
  const grupos = new Map<string, EntryDto>();

  for (const e of entries) {
    if (!e.recipeGroupId) {
      salida.push(filaSimple(e));
      continue;
    }

    const existente = grupos.get(e.recipeGroupId);
    if (existente) {
      existente.calories += caloriasDe(e);
      existente.components!.push(filaSimple(e));
      continue;
    }

    const grupo: EntryDto = {
      kind: 'recipe',
      // El id del grupo, no el de la fila: es contra lo que operan
      // PATCH y DELETE /logs/recipe/:groupId.
      id: e.recipeGroupId,
      meal_type: e.mealType,
      servings_consumed: Number(e.recipeServings ?? 1),
      logged_at: e.loggedAt,
      calories: caloriasDe(e),
      recipe_id: e.recipe?.id,
      food: {
        id: null,
        name: e.recipe?.name ?? 'Receta',
        brand: null,
        serving_size_amount: 1,
        serving_size_unit: 'porción',
      },
      components: [filaSimple(e)],
    };
    grupos.set(e.recipeGroupId, grupo);
    salida.push(grupo);
  }

  return salida;
}

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

  /**
   * El where incluye el userId: sin eso, cualquiera con un id de entrada podría
   * borrar la comida de otro. deleteMany devuelve el conteo y no tira si no
   * matchea, así que sirve de chequeo de propiedad en una sola consulta.
   */
  async deleteMealEntry(userId: string, entryId: string) {
    const { count } = await this.prisma.mealEntry.deleteMany({
      where: { id: entryId, dailyLog: { userId } },
    });
    if (count === 0) throw new NotFoundException('La entrada no existe');
    return { status: 'success' };
  }

  /** Mismo patrón de propiedad que el borrado: el userId va en el where. */
  async updateMealEntry(userId: string, entryId: string, servings: number) {
    const { count } = await this.prisma.mealEntry.updateMany({
      where: { id: entryId, dailyLog: { userId } },
      data: { servingsConsumed: servings },
    });
    if (count === 0) throw new NotFoundException('La entrada no existe');
    return { status: 'success' };
  }

  /**
   * Loguear una receta la expande a una fila por componente, todas marcadas con
   * el mismo recipe_group_id. Ver el comentario de la migración: es lo que
   * mantiene congelado el historial cuando la receta se edita después.
   */
  async logRecipe(userId: string, dto: LogRecipeDto) {
    const groupId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      // El userId en el where es el chequeo de propiedad. Los componentes hacen
      // falta igual, así que este SELECT no es una consulta de más.
      const receta = await tx.recipe.findFirst({
        where: { id: dto.recipe_id, userId, isArchived: false },
        include: { components: { orderBy: { position: 'asc' } } },
      });
      if (!receta) throw new NotFoundException('La receta no existe');

      const dailyLogId = await this.ensureDailyLog(tx, userId, dto.log_date);
      const factor = dto.servings / Number(receta.totalServings);

      await tx.mealEntry.createMany({
        data: receta.components.map((c) => ({
          dailyLogId,
          mealType: dto.meal_type,
          foodItemId: c.foodItemId,
          // Piso de 0.01, que es la resolución de Decimal(6,2): un componente
          // que redondeara a cero desaparecería de los totales.
          servingsConsumed: Math.max(
            Math.round(Number(c.quantity) * factor * 100) / 100,
            0.01,
          ),
          recipeId: receta.id,
          recipeGroupId: groupId,
          recipeServings: dto.servings,
        })),
      });
    });

    return {
      status: 'success',
      data: { recipe_group_id: groupId, ...(await this.getDay(userId, dto.log_date)).data },
    };
  }

  /**
   * Reescala todas las filas del grupo de una vez. Se divide por el
   * recipe_servings guardado, no por lo que diga la receta hoy, y se reescribe
   * en el mismo UPDATE: así editar varias veces seguidas no acumula error.
   */
  async updateRecipeGroup(userId: string, groupId: string, servings: number) {
    const filas = await this.prisma.$executeRaw`
      UPDATE meal_entries e
      SET servings_consumed = GREATEST(
            ROUND(e.servings_consumed / e.recipe_servings * ${servings}::numeric, 2), 0.01),
          recipe_servings = ${servings}::numeric
      FROM daily_logs d
      WHERE d.id = e.daily_log_id
        AND d.user_id = ${userId}::uuid
        AND e.recipe_group_id = ${groupId}::uuid`;

    if (filas === 0) throw new NotFoundException('La receta registrada no existe');
    return { status: 'success' };
  }

  async deleteRecipeGroup(userId: string, groupId: string) {
    const filas = await this.prisma.$executeRaw`
      DELETE FROM meal_entries e
      USING daily_logs d
      WHERE d.id = e.daily_log_id
        AND d.user_id = ${userId}::uuid
        AND e.recipe_group_id = ${groupId}::uuid`;

    if (filas === 0) throw new NotFoundException('La receta registrada no existe');
    return { status: 'success' };
  }

  /** Calorías sueltas sin alimento detrás: la comida de la que no hay etiqueta. */
  async quickAdd(userId: string, dto: QuickAddDto) {
    const entry = await this.prisma.$transaction(async (tx) => {
      const dailyLogId = await this.ensureDailyLog(tx, userId, dto.log_date);
      return tx.mealEntry.create({
        data: {
          dailyLogId,
          mealType: dto.meal_type,
          servingsConsumed: 1,
          quickName: dto.name,
          quickCalories: dto.calories,
          quickProtein: dto.protein ?? 0,
          quickCarbs: dto.carbs ?? 0,
          quickFat: dto.fat ?? 0,
        },
      });
    });

    return {
      status: 'success',
      data: { entry_id: entry.id, ...(await this.getDay(userId, dto.log_date)).data },
    };
  }

  async copy(userId: string, dto: CopyDto) {
    // Sin cambio de comida, copiar un día sobre sí mismo lo duplica en silencio.
    if (dto.from_date === dto.to_date && !dto.to_meal_type) {
      throw new BadRequestException('El origen y el destino son el mismo día');
    }

    await this.prisma.$transaction(async (tx) => {
      const dailyLogId = await this.ensureDailyLog(tx, userId, dto.to_date);
      const filtro = dto.meal_type ?? null;

      if (dto.replace) {
        await tx.$executeRaw`
          DELETE FROM meal_entries e
          USING daily_logs d
          WHERE d.id = e.daily_log_id
            AND d.user_id = ${userId}::uuid
            AND d.log_date = ${dto.to_date}::date
            AND (${dto.to_meal_type ?? filtro}::"MealType" IS NULL
                 OR e.meal_type = ${dto.to_meal_type ?? filtro}::"MealType")`;
      }

      /**
       * El CTE de grupos es lo no obvio de todo esto. Un INSERT ... SELECT
       * directo copiaría el recipe_group_id tal cual, y después reescalar la
       * copia reescalaría también el día original. Hace falta acuñar
       * exactamente un id nuevo por grupo distinto.
       *
       * El DISTINCT va en la subconsulta, sobre old_id solo, y recién después
       * se genera el uuid. Poniendo `SELECT DISTINCT old_id, gen_random_uuid()`
       * el DISTINCT se aplica al par, y como la función es volátil cada fila
       * sale con un uuid propio: el join deja de ser 1 a 1 y el día se copia
       * tantas veces como filas tenga el grupo.
       *
       * MATERIALIZED para que Postgres no inline el CTE y vuelva a evaluar la
       * función en cada match del join.
       */
      await tx.$executeRaw`
        WITH src AS (
          SELECT e.*
          FROM meal_entries e
          JOIN daily_logs d ON d.id = e.daily_log_id
          WHERE d.user_id = ${userId}::uuid
            AND d.log_date = ${dto.from_date}::date
            AND (${filtro}::"MealType" IS NULL OR e.meal_type = ${filtro}::"MealType")
        ),
        groups AS MATERIALIZED (
          SELECT d.old_id, gen_random_uuid() AS new_id
          FROM (
            SELECT DISTINCT recipe_group_id AS old_id
            FROM src WHERE recipe_group_id IS NOT NULL
          ) d
        )
        INSERT INTO meal_entries (
          daily_log_id, meal_type, food_item_id, servings_consumed,
          quick_name, quick_calories, quick_protein, quick_carbs, quick_fat,
          recipe_id, recipe_group_id, recipe_servings)
        SELECT ${dailyLogId}::uuid,
               COALESCE(${dto.to_meal_type ?? null}::"MealType", s.meal_type),
               s.food_item_id, s.servings_consumed,
               s.quick_name, s.quick_calories, s.quick_protein, s.quick_carbs, s.quick_fat,
               s.recipe_id, g.new_id, s.recipe_servings
        FROM src s
        LEFT JOIN groups g ON g.old_id = s.recipe_group_id`;
    });

    return this.getDay(userId, dto.to_date);
  }

  /** El diario del día puede no existir todavía: se crea al registrar agua. */
  async setWater(userId: string, logDate: string, waterMl: number) {
    await this.prisma.$transaction(async (tx) => {
      const dailyLogId = await this.ensureDailyLog(tx, userId, logDate);
      await tx.dailyLog.update({ where: { id: dailyLogId }, data: { waterMl } });
    });
    return this.getDay(userId, logDate);
  }

  async getDay(userId: string, logDate: string) {
    const [log, goal] = await Promise.all([
      this.prisma.dailyLog.findUnique({
        where: { userId_logDate: { userId, logDate: new Date(logDate) } },
        include: {
          entries: {
            include: { foodItem: true, recipe: { select: { id: true, name: true } } },
            orderBy: { loggedAt: 'asc' },
          },
        },
      }),
      this.prisma.userGoal.findFirst({
        where: { userId, isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    const entries = log?.entries ?? [];

    // Los totales se calculan sobre las filas planas, ANTES de colapsar los
    // grupos de receta: colapsar es solo presentación y no puede cambiar lo
    // que suma el día.
    const totals = sumEntries(entries.map((e) => ({ ...e, foodItem: nutrientsOf(e) })));

    return {
      status: 'success',
      data: {
        log_date: logDate,
        water_ml: log?.waterMl ?? 0,
        totals,
        remaining: goal ? remaining(goal, totals) : null,
        entries: colapsarRecetas(entries),
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

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import * as argon2 from 'argon2';

/**
 * Una receta logueada se guarda expandida, una fila por ingrediente, porque los
 * macros del día tienen que salir de números congelados y no de releer la
 * receta. Eso es correcto en la base y es ilegible en un export: de un guiso
 * salían seis renglones con nombres de ingredientes y ninguno decía "guiso".
 *
 * Acá se colapsan por `recipe_group_id`, que es justo lo que ese campo existe
 * para permitir: una línea con el nombre de la receta, sus porciones y sus
 * calorías sumadas, con los ingredientes adentro para el que quiera mirarlos.
 * Las filas sueltas pasan de largo.
 */
type FilaExport = {
  mealType: string;
  loggedAt: Date;
  servingsConsumed: unknown;
  foodItem: { name: string; brand: string | null; calories: number } | null;
  quickName: string | null;
  quickCalories: unknown;
  recipeGroupId: string | null;
  recipeServings: unknown;
  recipe: { name: string } | null;
};

function agruparRecetas(entries: FilaExport[]) {
  const kcal = (e: FilaExport) =>
    e.foodItem
      ? e.foodItem.calories * Number(e.servingsConsumed)
      : Number(e.quickCalories ?? 0) * Number(e.servingsConsumed);

  const salida: (FilaExport & { calories: number; ingredientes?: unknown[] })[] = [];
  const grupos = new Map<string, number>();

  for (const e of entries) {
    if (!e.recipeGroupId) {
      salida.push({ ...e, calories: kcal(e) });
      continue;
    }
    const ingrediente = {
      food: e.foodItem?.name ?? e.quickName,
      brand: e.foodItem?.brand ?? null,
      servings_consumed: Number(e.servingsConsumed),
      calories: kcal(e),
    };
    const yaEsta = grupos.get(e.recipeGroupId);
    if (yaEsta === undefined) {
      grupos.set(e.recipeGroupId, salida.length);
      salida.push({
        ...e,
        // El nombre de la receta, no el del primer ingrediente.
        foodItem: null,
        quickName: e.recipe?.name ?? 'Receta',
        servingsConsumed: e.recipeServings,
        calories: kcal(e),
        ingredientes: [ingrediente],
      });
    } else {
      const grupo = salida[yaEsta];
      grupo.calories += kcal(e);
      grupo.ingredientes!.push(ingrediente);
    }
  }
  return salida;
}
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class DeleteAccountDto {
  /** Los invitados no mandan nada: no tienen contraseña que confirmar. */
  @IsOptional()
  @IsString()
  @MaxLength(72)
  password?: string;
}

type AuthedRequest = { user: { userId: string } };

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Todo lo que el usuario cargó, en un solo archivo. Las claves van en
   * snake_case como el resto del API, para que el archivo se entienda sin
   * tener el esquema al lado.
   */
  async export(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        goals: { orderBy: { effectiveFrom: 'asc' } },
        weights: { orderBy: { loggedOn: 'asc' } },
        recipes: { include: { components: { include: { foodItem: true } } } },
        createdFoods: true,
        routines: { include: { items: { orderBy: { position: 'asc' } } } },
        dailyLogs: {
          orderBy: { logDate: 'asc' },
          include: {
            entries: {
              include: { foodItem: true, recipe: { select: { name: true } } },
              orderBy: { loggedAt: 'asc' },
            },
            exercises: { orderBy: { loggedAt: 'asc' } },
            strength: { orderBy: { loggedAt: 'asc' } },
          },
        },
      },
    });

    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

    return {
      exported_at: new Date().toISOString(),
      // passwordHash y tokenVersion no salen: no son datos del usuario, son
      // material de autenticación.
      profile: {
        email: user.email,
        is_guest: user.isGuest,
        first_name: user.firstName,
        dob: dia(user.dob),
        gender: user.gender,
        height_cm: n(user.heightCm),
        activity_level: n(user.activityLevel),
        body_fat_pct: n(user.bodyFatPct),
        unit_preference: user.unitPreference,
        created_at: user.createdAt.toISOString(),
      },
      goals: user.goals.map((g) => ({
        effective_from: dia(g.effectiveFrom),
        is_active: g.isActive,
        target_weight_kg: n(g.targetWeightKg),
        weekly_change_kg: n(g.weeklyChangeKg),
        daily_calories: g.dailyCalories,
        protein_g: g.proteinGrams,
        carbs_g: g.carbsGrams,
        fat_g: g.fatGrams,
      })),
      weights: user.weights.map((w) => ({
        logged_on: dia(w.loggedOn),
        weight_kg: n(w.weightKg),
        ema_kg: n(w.emaKg),
      })),
      recipes: user.recipes.map((r) => ({
        name: r.name,
        total_servings: n(r.totalServings),
        is_archived: r.isArchived,
        components: r.components.map((c) => ({
          food: c.foodItem.name,
          brand: c.foodItem.brand,
          quantity: n(c.quantity),
        })),
      })),
      routines: user.routines.map((r) => ({
        name: r.name,
        notes: r.notes,
        items: r.items.map((i) => ({
          name: i.name,
          sets: i.sets,
          reps: i.reps,
          weight_kg: n(i.weightKg),
          rpe: n(i.rpe),
          position: i.position,
        })),
      })),
      created_foods: user.createdFoods.map((f) => ({
        name: f.name,
        brand: f.brand,
        barcode: f.barcode,
        serving_size_amount: n(f.servingSizeAmount),
        serving_size_unit: f.servingSizeUnit,
        calories: f.calories,
        protein: n(f.protein),
        carbohydrates: n(f.carbohydrates),
        fat: n(f.fat),
      })),
      days: user.dailyLogs.map((d) => ({
        log_date: dia(d.logDate),
        water_ml: d.waterMl,
        entries: agruparRecetas(d.entries).map((e) => ({
          meal_type: e.mealType,
          logged_at: e.loggedAt.toISOString(),
          servings_consumed: n(e.servingsConsumed),
          // Un quick add no tiene alimento detrás; el nombre está en la fila.
          food: e.foodItem?.name ?? e.quickName,
          brand: e.foodItem?.brand ?? null,
          calories: e.calories,
          // Presente solo en las filas que salieron de una receta.
          ...(e.ingredientes ? { ingredientes: e.ingredientes } : {}),
        })),
        exercises: d.exercises.map((ex) => ({
          name: ex.name,
          duration_min: ex.durationMin,
          calories_burned: ex.caloriesBurned,
          logged_at: ex.loggedAt.toISOString(),
        })),
        strength: d.strength.map((s) => ({
          name: s.name,
          sets: s.sets,
          reps: s.reps,
          weight_kg: n(s.weightKg),
          rpe: n(s.rpe),
          done: s.done,
          logged_at: s.loggedAt.toISOString(),
        })),
      })),
    };
  }

  /**
   * Borrado definitivo. Las FK ya están en Cascade para objetivos, diarios,
   * pesadas y recetas. Los alimentos que creó quedan huérfanos con created_by
   * en null (SetNull) a propósito: otros usuarios los tienen en su historial y
   * borrarlos les reescribiría el pasado.
   */
  async remove(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // Una cuenta con contraseña exige confirmarla: el token puede estar en un
    // navegador que quedó abierto en cualquier lado.
    if (user.passwordHash) {
      const ok = dto.password
        ? await argon2.verify(user.passwordHash, dto.password).catch(() => false)
        : false;
      if (!ok) throw new UnauthorizedException('La contraseña no coincide');
    }

    await this.prisma.user.delete({ where: { id: userId } });
  }
}

@Controller('api/v1/account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** 5 por hora: serializa el historial entero de un usuario. */
  @Get('export')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async export(@Req() req: AuthedRequest, @Res() res: Response) {
    const datos = await this.account.export(req.user.userId);
    const nombre = `fittrack-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    // Indentado: el archivo lo abre una persona, no un parser.
    res.send(JSON.stringify(datos, null, 2));
  }

  @Delete()
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Body() dto: DeleteAccountDto) {
    return this.account.remove(req.user.userId, dto);
  }
}

@Module({ controllers: [AccountController], providers: [AccountService] })
export class AccountModule {}

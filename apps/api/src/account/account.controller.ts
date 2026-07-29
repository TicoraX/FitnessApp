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
        dailyLogs: {
          orderBy: { logDate: 'asc' },
          include: { entries: { include: { foodItem: true }, orderBy: { loggedAt: 'asc' } } },
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
        entries: d.entries.map((e) => ({
          meal_type: e.mealType,
          logged_at: e.loggedAt.toISOString(),
          servings_consumed: n(e.servingsConsumed),
          // Un quick add no tiene alimento detrás; el nombre está en la fila.
          food: e.foodItem?.name ?? e.quickName,
          brand: e.foodItem?.brand ?? null,
          calories: e.foodItem
            ? e.foodItem.calories * Number(e.servingsConsumed)
            : (e.quickCalories ?? 0) * Number(e.servingsConsumed),
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

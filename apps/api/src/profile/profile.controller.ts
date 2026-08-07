import { Body, Controller, Get, Injectable, Module, Patch, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { GoalsService } from '../nutrition/goals.service';
import { IsLogDate } from '../common/log-date';

class UpdateProfileDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(260)
  height_cm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([1.2, 1.375, 1.55, 1.725, 1.9])
  activity_level?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25)
  @Max(500)
  target_weight_kg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1)
  @Max(1)
  weekly_goal_kg?: number;

  /**
   * null borra el dato y devuelve el cálculo a Mifflin-St Jeor. Sin esa opción
   * un porcentaje cargado mal quedaría pegado para siempre, porque el resto de
   * los campos opcionales interpretan undefined como "no tocar".
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(3)
  @Max(70)
  @ValidateIf((_, value) => value !== null)
  body_fat_pct?: number | null;

  /**
   * Solo cambia cómo se muestra y cómo se ingresa. Lo almacenado sigue siendo
   * métrico siempre: guardar en unidades mixtas convierte cada consulta y cada
   * cálculo en un campo minado.
   */
  @IsOptional()
  @IsIn(['metric', 'imperial'])
  unit_preference?: 'metric' | 'imperial';

  /**
   * Qué día es para el usuario. El servidor corre en UTC y estamparía el
   * objetivo nuevo con una fecha que al oeste de Greenwich todavía no llegó,
   * dejándolo fuera del día que se está mirando. Opcional: si no viene, se cae
   * al now() del servidor, que es lo que había antes.
   */
  @IsOptional()
  @IsLogDate()
  today?: string;

  /** No entra en el cálculo metabólico: es una meta que el usuario se pone. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(250)
  @Max(10_000)
  water_goal_ml?: number;
}

type AuthedRequest = { user: { userId: string } };

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goals: GoalsService,
  ) {}

  async get(userId: string) {
    const [user, goal, origen] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.userGoal.findFirst({ where: { userId, isActive: true }, orderBy: { effectiveFrom: 'desc' } }),
      // De dónde sale el objetivo de hoy. Solo lectura: no recalcula nada.
      this.goals.origenDelObjetivo(this.prisma, userId),
    ]);

    return {
      status: 'success',
      data: {
        email: user.email,
        is_guest: user.isGuest,
        first_name: user.firstName,
        dob: user.dob.toISOString().slice(0, 10),
        gender: user.gender,
        height_cm: Number(user.heightCm),
        activity_level: Number(user.activityLevel),
        body_fat_pct: user.bodyFatPct === null ? null : Number(user.bodyFatPct),
        unit_preference: user.unitPreference,
        water_goal_ml: user.waterGoalMl,
        target_weight_kg: goal ? Number(goal.targetWeightKg) : null,
        weekly_goal_kg: goal ? Number(goal.weeklyChangeKg) : null,
        daily_calories: goal?.dailyCalories ?? null,
        objetivo_origen: origen,
      },
    };
  }

  /**
   * Altura, actividad y grasa corporal viven en users; peso objetivo y cambio
   * semanal, en el objetivo activo. Los cinco alteran el cálculo, así que se
   * recalcula después de escribir, dentro de la misma transacción.
   */
  async update(userId: string, dto: UpdateProfileDto) {
    await this.prisma.$transaction(async (tx) => {
      if (
        dto.height_cm !== undefined ||
        dto.activity_level !== undefined ||
        dto.body_fat_pct !== undefined ||
        dto.unit_preference !== undefined ||
        dto.water_goal_ml !== undefined
      ) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.height_cm !== undefined && { heightCm: dto.height_cm }),
            ...(dto.activity_level !== undefined && { activityLevel: dto.activity_level }),
            ...(dto.body_fat_pct !== undefined && { bodyFatPct: dto.body_fat_pct }),
            ...(dto.unit_preference !== undefined && { unitPreference: dto.unit_preference }),
            ...(dto.water_goal_ml !== undefined && { waterGoalMl: dto.water_goal_ml }),
          },
        });
      }

      if (dto.target_weight_kg !== undefined || dto.weekly_goal_kg !== undefined) {
        const goal = await tx.userGoal.findFirst({
          where: { userId, isActive: true },
          orderBy: { effectiveFrom: 'desc' },
        });
        if (goal) {
          await tx.userGoal.update({
            where: { id: goal.id },
            data: {
              ...(dto.target_weight_kg !== undefined && { targetWeightKg: dto.target_weight_kg }),
              ...(dto.weekly_goal_kg !== undefined && { weeklyChangeKg: dto.weekly_goal_kg }),
            },
          });
        }
      }

      await this.goals.refresh(tx, userId, dto.today);
    });

    return this.get(userId);
  }
}

@Controller('api/v1/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@Req() req: AuthedRequest) {
    return this.profile.get(req.user.userId);
  }

  @Patch()
  update(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.profile.update(req.user.userId, dto);
  }
}

@Module({ controllers: [ProfileController], providers: [ProfileService] })
export class ProfileModule {}

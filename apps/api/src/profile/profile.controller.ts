import { Body, Controller, Get, Injectable, Module, Patch, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { GoalsService } from '../nutrition/goals.service';

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
}

type AuthedRequest = { user: { userId: string } };

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goals: GoalsService,
  ) {}

  async get(userId: string) {
    const [user, goal] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.userGoal.findFirst({ where: { userId, isActive: true }, orderBy: { effectiveFrom: 'desc' } }),
    ]);

    return {
      status: 'success',
      data: {
        email: user.email,
        first_name: user.firstName,
        dob: user.dob.toISOString().slice(0, 10),
        gender: user.gender,
        height_cm: Number(user.heightCm),
        activity_level: Number(user.activityLevel),
        target_weight_kg: goal ? Number(goal.targetWeightKg) : null,
        weekly_goal_kg: goal ? Number(goal.weeklyChangeKg) : null,
        daily_calories: goal?.dailyCalories ?? null,
      },
    };
  }

  /**
   * Altura y actividad viven en users; peso objetivo y cambio semanal, en el
   * objetivo activo. Los cuatro alteran el cálculo, así que se recalcula
   * después de escribir, dentro de la misma transacción.
   */
  async update(userId: string, dto: UpdateProfileDto) {
    await this.prisma.$transaction(async (tx) => {
      if (dto.height_cm !== undefined || dto.activity_level !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.height_cm !== undefined && { heightCm: dto.height_cm }),
            ...(dto.activity_level !== undefined && { activityLevel: dto.activity_level }),
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

      await this.goals.refresh(tx, userId);
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

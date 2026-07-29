import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { calculateAge, calculateTargets } from '../nutrition/metabolic';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GuestDto } from './dto/guest.dto';
import { ClaimDto } from './dto/claim.dto';

@Injectable()
export class AuthService {
  // ponytail: Logger de Nest alcanza; cuando haya SIEM se cambia el transport, no las llamadas.
  private readonly logger = new Logger('security');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const dob = new Date(dto.dob);
    const targets = calculateTargets({
      weightKg: dto.current_weight_kg,
      heightCm: dto.height_cm,
      age: calculateAge(dob),
      gender: dto.gender,
      activityLevel: dto.activity_level,
      weeklyChangeKg: dto.weekly_goal_kg,
      bodyFatPct: dto.body_fat_pct,
    });

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    // Usuario y objetivo inicial nacen juntos o no nacen.
    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            passwordHash,
            firstName: dto.first_name,
            dob,
            gender: dto.gender,
            heightCm: dto.height_cm,
            activityLevel: dto.activity_level,
            isGuest: false,
          },
        });
        // El peso del registro se guarda como primera medición: si no, existe
        // solo para este cálculo y después no hay contra qué recalcular.
        await tx.weightEntry.create({
          data: {
            userId: created.id,
            loggedOn: new Date(dto.logged_on ?? new Date().toISOString().slice(0, 10)),
            weightKg: dto.current_weight_kg,
            emaKg: dto.current_weight_kg,
          },
        });
        await tx.userGoal.create({
          data: {
            userId: created.id,
            targetWeightKg: dto.target_weight_kg,
            weeklyChangeKg: dto.weekly_goal_kg,
            dailyCalories: targets.dailyCalories,
            proteinGrams: targets.macros.proteinG,
            carbsGrams: targets.macros.carbsG,
            fatGrams: targets.macros.fatG,
          },
        });
        return created;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('El email ya está registrado');
      }
      throw e;
    }

    return {
      status: 'success',
      data: {
        user_id: user.id,
        is_guest: false,
        token: await this.signToken(user.id, user.email),
        calculated_goals: {
          bmr: targets.bmr,
          tdee: targets.tdee,
          daily_calories: targets.dailyCalories,
          macros: {
            protein_g: targets.macros.proteinG,
            carbs_g: targets.macros.carbsG,
            fat_g: targets.macros.fatG,
          },
        },
      },
    };
  }

  async registerGuest(dto: GuestDto) {
    const dob = new Date(dto.dob);
    const targets = calculateTargets({
      weightKg: dto.current_weight_kg,
      heightCm: dto.height_cm,
      age: calculateAge(dob),
      gender: dto.gender,
      activityLevel: dto.activity_level,
      weeklyChangeKg: dto.weekly_goal_kg,
      bodyFatPct: dto.body_fat_pct,
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: dto.first_name || 'Invitado',
          dob,
          gender: dto.gender,
          heightCm: dto.height_cm,
          activityLevel: dto.activity_level,
          isGuest: true,
        },
      });
      await tx.weightEntry.create({
        data: {
          userId: created.id,
          loggedOn: new Date(dto.logged_on ?? new Date().toISOString().slice(0, 10)),
          weightKg: dto.current_weight_kg,
          emaKg: dto.current_weight_kg,
        },
      });
      await tx.userGoal.create({
        data: {
          userId: created.id,
          targetWeightKg: dto.target_weight_kg,
          weeklyChangeKg: dto.weekly_goal_kg,
          dailyCalories: targets.dailyCalories,
          proteinGrams: targets.macros.proteinG,
          carbsGrams: targets.macros.carbsG,
          fatGrams: targets.macros.fatG,
        },
      });
      return created;
    });

    return {
      status: 'success',
      data: {
        user_id: user.id,
        is_guest: true,
        token: await this.signToken(user.id, null),
        calculated_goals: {
          bmr: targets.bmr,
          tdee: targets.tdee,
          daily_calories: targets.dailyCalories,
          macros: {
            protein_g: targets.macros.proteinG,
            carbs_g: targets.macros.carbsG,
            fat_g: targets.macros.fatG,
          },
        },
      },
    };
  }

  async claimAccount(userId: string, dto: ClaimDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing || !existing.isGuest) {
      throw new BadRequestException('Esta cuenta no existe o ya fue registrada');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    // Sin chequeo previo: entre el SELECT y el UPDATE el email se puede ocupar
    // igual. La constraint UNIQUE es la que decide, como en register().
    let updated;
    try {
      updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          isGuest: false,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('El email ya está registrado');
      }
      throw e;
    }

    return {
      status: 'success',
      data: {
        user_id: updated.id,
        email: updated.email,
        is_guest: false,
        token: await this.signToken(updated.id, updated.email),
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    // Se verifica igual contra un hash dummy si el usuario no existe, para no
    // filtrar por tiempo de respuesta qué emails están registrados.
    const ok = user && user.passwordHash
      ? await argon2.verify(user.passwordHash, dto.password)
      : await argon2.verify(DUMMY_HASH, dto.password).catch(() => false);

    if (!user || !ok) {
      this.logger.warn(`login fallido (user_id=${user?.id ?? 'desconocido'})`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return {
      status: 'success',
      data: { user_id: user.id, is_guest: user.isGuest, token: await this.signToken(user.id, user.email) },
    };
  }

  private signToken(sub: string, email?: string | null) {
    return this.jwt.signAsync({ sub, email: email ?? undefined });
  }
}

/** Hash de una password arbitraria; solo existe para igualar el costo del login fallido. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZTEyMw$0tPqBmr8vNlIkK7T0mYQq3sVAqZ9pTnGUq0oxu1cS0M';

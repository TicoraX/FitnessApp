import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Mailer } from '../mail/mailer';
import { ForgotDto, ResetDto } from './dto/password-reset.dto';
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
    private readonly mailer: Mailer,
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
            bodyFatPct: dto.body_fat_pct,
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
        token: await this.signToken(user.id, user.email, user.tokenVersion),
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
          bodyFatPct: dto.body_fat_pct,
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
        token: await this.signToken(user.id, null, user.tokenVersion),
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
        token: await this.signToken(updated.id, updated.email, updated.tokenVersion),
      },
    };
  }

  /**
   * Siempre responde igual, exista o no la cuenta. Si contestara distinto sería
   * un oráculo para averiguar qué emails están registrados, que es la misma
   * razón por la que el login verifica contra un hash dummy.
   *
   * El mail se manda sin esperarlo. Además de responder rápido, cierra el
   * canal lateral de tiempo: si se esperara, el caso "existe" tardaría lo que
   * tarda la red y el caso "no existe" volvería al instante.
   */
  async forgotPassword(dto: ForgotDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Los invitados no tienen contraseña que recuperar; lo que les sirve es
    // vincular la cuenta, y eso lo empuja la UI.
    if (user?.email && !user.isGuest) {
      const token = randomBytes(32).toString('hex');

      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });

      const link = `${process.env.APP_URL ?? 'http://localhost:5177'}/#/reset?token=${token}`;
      void this.mailer
        .send({
          to: user.email,
          subject: 'Restablecer tu contraseña de FitTrack',
          text: `Entrá acá para elegir una contraseña nueva. El link vence en una hora y sirve una sola vez.\n\n${link}\n\nSi no lo pediste vos, ignorá este mensaje.`,
        })
        .catch((e) => this.logger.error(`no se pudo enviar el reset: ${e.message}`));
    }

    return { status: 'success', data: { message: 'Si el email está registrado, te llega un link' } };
  }

  async resetPassword(dto: ResetDto) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(dto.token) },
    });

    // Un solo mensaje para las tres causas (no existe, vencido, ya usado): al
    // que tiene el link le da igual el detalle, y al que prueba tokens no se le
    // regala información.
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      this.logger.warn('intento de reset con token inválido o vencido');
      throw new BadRequestException('El link no sirve o ya venció. Pedí uno nuevo.');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    await this.prisma.$transaction(async (tx) => {
      // Marcar el uso dentro de la transacción y con usedAt en null en el
      // where: si dos pedidos entran a la vez, solo uno cambia la contraseña.
      const { count } = await tx.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) throw new BadRequestException('El link ya se usó');

      // tokenVersion sube: los tokens que estaban dando vueltas dejan de valer.
      // Es el punto de todo esto, cambiar la contraseña tiene que echar al que
      // se metió.
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
    });

    return { status: 'success', data: { message: 'Listo, ya podés entrar con la contraseña nueva' } };
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
      data: { user_id: user.id, is_guest: user.isGuest, token: await this.signToken(user.id, user.email, user.tokenVersion) },
    };
  }

  /**
   * tv es la versión del token. Va dentro del JWT y el guard la compara contra
   * la del usuario: si cambió, este token dejó de valer.
   */
  private signToken(sub: string, email: string | null | undefined, tokenVersion: number) {
    return this.jwt.signAsync({ sub, email: email ?? undefined, tv: tokenVersion });
  }
}

/**
 * sha256 y no argon2 acá a propósito: el token son 32 bytes aleatorios, no una
 * contraseña. No hay nada que adivinar por fuerza bruta, así que el costo alto
 * de argon2 no compra nada y encarecería cada intento de reset.
 */
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Hash de una password arbitraria; solo existe para igualar el costo del login fallido. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZTEyMw$0tPqBmr8vNlIkK7T0mYQq3sVAqZ9pTnGUq0oxu1cS0M';

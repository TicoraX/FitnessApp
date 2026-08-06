import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { LogsModule } from './logs/logs.module';
import { FoodsModule } from './foods/foods.module';
import { WeightModule } from './weight/weight.controller';
import { ProfileModule } from './profile/profile.controller';
import { RecipesModule } from './recipes/recipes.controller';
import { RoutinesModule } from './routines/routines.controller';
import { ReportsModule } from './reports/reports.controller';
import { AccountModule } from './account/account.controller';
import { MailModule } from './mail/mailer';
import { GoalsModule } from './nutrition/goals.service';
import { ExerciseModule } from './exercise/exercise.controller';
import { HealthModule } from './health/health.controller';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Techo global (§2 del blueprint). Los endpoints de credenciales lo bajan
    // a 5/15min con @Throttle en su controller.
    //
    // Configurable por la misma razón que los de auth: el smoke dispara 127
    // pedidos y el probe 68, y comparten IP con el limiter. Con 100 el
    // resultado dependía de cuántos entraran en el mismo minuto, o sea que la
    // suite pasaba o fallaba según el reloj. Producción no pasa la variable.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.API_RATE_LIMIT ?? 100) }]),
    PrismaModule,
    MailModule,
    AuthModule,
    AccountModule,
    LogsModule,
    FoodsModule,
    RecipesModule,
    RoutinesModule,
    ReportsModule,
    WeightModule,
    ProfileModule,
    GoalsModule,
    ExerciseModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

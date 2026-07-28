import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { LogsModule } from './logs/logs.module';
import { FoodsModule } from './foods/foods.module';
import { WeightModule } from './weight/weight.controller';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Techo global (§2 del blueprint). Los endpoints de credenciales lo bajan
    // a 5/15min con @Throttle en su controller.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    LogsModule,
    FoodsModule,
    WeightModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

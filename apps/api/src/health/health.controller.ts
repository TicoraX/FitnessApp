import { Controller, Get, HttpCode, Module } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sin guard de JWT y sin rate limit: lo consulta el orquestador, no un usuario.
 * Un probe cada pocos segundos consumiría el cupo global.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Vivo: el proceso responde. No dice nada de sus dependencias. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /**
   * Listo: además puede hablar con la base. Si esto falla, el balanceador
   * tiene que sacar la instancia de rotación en vez de mandarle tráfico.
   */
  @Get('ready')
  @HttpCode(200)
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'ok' };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}

import { Controller, Get, Module, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { parseLogDate } from '../common/log-date';
import { ReportsService } from './reports.service';
import { MICRO_KEYS, MICROS } from '../nutrition/micros';

type AuthedRequest = { user: { userId: string } };

/**
 * 60 por minuto: son las lecturas más pesadas de la app, agregan sobre rangos
 * de hasta un año, y ninguna pantalla las necesita más seguido que eso.
 */
@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@Req() req: AuthedRequest, @Query('from') from: string, @Query('to') to: string) {
    const [desde, hasta] = this.rango(from, to);
    return this.reports.summary(req.user.userId, desde, hasta);
  }

  @Get('weight')
  weight(@Req() req: AuthedRequest, @Query('from') from: string, @Query('to') to: string) {
    const [desde, hasta] = this.rango(from, to);
    return this.reports.weight(req.user.userId, desde, hasta);
  }

  /**
   * today lo manda el cliente porque el servidor no sabe su zona horaria, y
   * adivinarla le cuesta la racha a alguien a las 21:00. Mismo criterio que el
   * log_date obligatorio al registrar una comida.
   */
  @Get('streak')
  streak(@Req() req: AuthedRequest, @Query('today') today: string) {
    return this.reports.streak(req.user.userId, parseLogDate(today));
  }

  /**
   * Etiquetas, unidades y valores de referencia de los micros. Es una tabla
   * fija y podría estar en el cliente, pero entonces habría dos listas que
   * mantener sincronizadas y una barra pintaría contra el VDR equivocado.
   */
  @Get('micros/reference')
  microsReference() {
    return {
      status: 'success',
      data: MICRO_KEYS.map((key) => ({ key, ...MICROS[key] })),
    };
  }

  private rango(from: string, to: string): [string, string] {
    const desde = parseLogDate(from);
    const hasta = parseLogDate(to);
    this.reports.validarRango(desde, hasta);
    return [desde, hasta];
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { smoothWeight } from '../nutrition/metabolic';
import { GoalsService } from '../nutrition/goals.service';

@Injectable()
export class WeightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goals: GoalsService,
  ) {}

  async log(userId: string, loggedOn: string, weightKg: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.weightEntry.upsert({
        where: { userId_loggedOn: { userId, loggedOn: new Date(loggedOn) } },
        create: { userId, loggedOn: new Date(loggedOn), weightKg, emaKg: weightKg },
        update: { weightKg },
      });
      await this.recomputeEma(tx, userId);
      await this.goals.refresh(tx, userId);
    });

    return this.series(userId, 90);
  }

  async series(userId: string, days: number) {
    // loggedOn es @db.Date, así que Prisma manda el filtro como date y la
    // comparación es día contra día: la hora de `from` no participa y el borde
    // no depende de a qué hora se consulte. Verificado sobre los días -91 y
    // -90 a las 04:25 UTC.
    const from = new Date(Date.now() - days * 86_400_000);
    const entries = await this.prisma.weightEntry.findMany({
      where: { userId, loggedOn: { gte: from } },
      orderBy: { loggedOn: 'asc' },
    });

    return {
      status: 'success',
      data: entries.map((e) => ({
        logged_on: e.loggedOn.toISOString().slice(0, 10),
        weight_kg: Number(e.weightKg),
        ema_kg: Number(e.emaKg),
      })),
    };
  }

  /**
   * Recalcula la cadena completa en orden cronológico. Hace falta porque se
   * puede cargar un peso de una fecha pasada, y eso invalida todas las EMA
   * posteriores. Es O(n) sobre la serie de un usuario: años de pesadas diarias
   * siguen siendo miles de filas.
   */
  private async recomputeEma(tx: Prisma.TransactionClient, userId: string) {
    const entries = await tx.weightEntry.findMany({
      where: { userId },
      orderBy: { loggedOn: 'asc' },
      select: { id: true, weightKg: true, emaKg: true },
    });

    let previous: number | null = null;
    for (const e of entries) {
      const weight = Number(e.weightKg);
      // La primera medición siembra la EMA con su propio valor.
      const ema = previous === null ? weight : smoothWeight(weight, previous);
      if (ema !== Number(e.emaKg)) {
        await tx.weightEntry.update({ where: { id: e.id }, data: { emaKg: ema } });
      }
      previous = ema;
    }
  }
}

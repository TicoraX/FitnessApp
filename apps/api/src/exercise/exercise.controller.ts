import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { movementFacets, searchActivities, searchMovements } from './met';
import { ActivitySearchQueryDto, MovementSearchQueryDto } from './dto/query.dto';

/**
 * El catálogo de actividades es estático y vive en memoria, así que esto no
 * toca la base ni necesita un service. El límite alto es porque el buscador
 * dispara en cada tecla, igual que el de alimentos.
 */
@Controller('api/v1/exercise')
@UseGuards(JwtAuthGuard)
export class ExerciseController {
  @Get('search')
  @Throttle({ default: { ttl: 60_000, limit: 600 } })
  search(@Query() query: ActivitySearchQueryDto) {
    return {
      status: 'success',
      data: searchActivities(query.q ?? '', query.limit ?? 20),
    };
  }

  /** Movimientos de gimnasio: los que se registran en series y repeticiones. */
  @Get('movements')
  @Throttle({ default: { ttl: 60_000, limit: 600 } })
  movements(@Query() query: MovementSearchQueryDto) {
    return {
      status: 'success',
      data: searchMovements(query.q ?? '', query.limit ?? 20, {
        body: query.body,
        equipment: query.equipment,
      }),
    };
  }

  /** Las zonas y equipos que existen, para explorar el catálogo sin escribir. */
  @Get('facets')
  facets() {
    return { status: 'success', data: movementFacets() };
  }
}

@Module({ controllers: [ExerciseController] })
export class ExerciseModule {}

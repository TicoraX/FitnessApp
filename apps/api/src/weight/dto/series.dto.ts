import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * El techo de 730 días ya lo aplicaba un Math.min en el controller, así que la
 * carga máxima no cambia. Lo que cambia es que `days=abc` deja de caer al
 * default en silencio: pedir una serie con un parámetro que no es un número es
 * una petición mal armada, no una petición por 90 días.
 */
export class WeightSeriesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days tiene que ser un número entero' })
  @Min(1, { message: 'days va de 1 a 730' })
  @Max(730, { message: 'days va de 1 a 730' })
  days?: number;
}

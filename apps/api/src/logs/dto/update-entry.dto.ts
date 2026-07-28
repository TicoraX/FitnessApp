import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class UpdateServingsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999)
  servings_consumed!: number;
}

export class UpdateWaterDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30000) // 30 L: por encima de eso es un error de tipeo, no una hidratación
  water_ml!: number;
}

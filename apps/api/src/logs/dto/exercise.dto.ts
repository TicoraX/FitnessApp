import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsLogDate } from '../../common/log-date';

export class LogExerciseDto {
  @IsLogDate()
  log_date!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  duration_min!: number;

  /**
   * Opcional: si no viene, se estima con el MET del catálogo y el peso del
   * usuario. Lo manda quien lee las calorías de su reloj y quiere ese número,
   * y es la única salida para una actividad que no está en el catálogo.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  calories_burned?: number;
}

export class UpdateExerciseDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  duration_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  calories_burned?: number;
}

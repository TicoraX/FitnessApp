import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsLogDate } from '../../common/log-date';
import { IsRpe } from '../../common/rpe';

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

/** Una serie de gimnasio: sin minutos ni calorías, esto no toca el margen del día. */
export class LogStrengthDto {
  @IsLogDate()
  log_date!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  sets!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  reps!: number;

  /** Opcional: dominadas y flexiones se registran sin peso agregado. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(999)
  weight_kg?: number;

  /**
   * Esfuerzo percibido, escala RPE de 1 a 10 en pasos de 0.5. Opcional: el que
   * no lo usa no tiene que inventarlo, y un cero por defecto seria mentira.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  @IsRpe()
  rpe?: number;
}

/**
 * El movimiento cuya historia se pide.
 *
 * Va como DTO y no como chequeo a mano sobre el string: con `?name=a&name=b`
 * Express entrega un array, `length` vale 2 y pasaba el chequeo, y Prisma
 * reventaba con un 500 en vez de contestar 400. `@IsString` lo rechaza antes.
 */
export class StrengthHistoryQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

/** Cuántos movimientos trending devolver: el catálogo no necesita más de una tira corta. */
export class StrengthTrendingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

/**
 * Confirmar o corregir una serie. Una fila cargada desde una rutina llega con
 * los números del objetivo: acá se ajustan los que hayan cambiado y se marca
 * hecha.
 */
export class UpdateStrengthDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  sets?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  reps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(999)
  weight_kg?: number;

  /**
   * Esfuerzo percibido, escala RPE de 1 a 10 en pasos de 0.5. Opcional: el que
   * no lo usa no tiene que inventarlo, y un cero por defecto seria mentira.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  @IsRpe()
  rpe?: number;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
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

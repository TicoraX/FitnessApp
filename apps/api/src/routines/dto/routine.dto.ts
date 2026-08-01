import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsLogDate } from '../../common/log-date';
import { IsRpe } from '../../common/rpe';

/** Un movimiento dentro de la rutina, con el objetivo del entreno. */
export class RoutineItemDto {
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

export class CreateRoutineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // El tope acota cuántas filas inserta una sola carga de rutina.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => RoutineItemDto)
  items!: RoutineItemDto[];
}

/** items es reemplazo total, igual que los componentes de una receta. */
export class UpdateRoutineDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => RoutineItemDto)
  items?: RoutineItemDto[];
}

export class LoadRoutineDto {
  @IsLogDate()
  log_date!: string;

  @IsUUID()
  routine_id!: string;
}

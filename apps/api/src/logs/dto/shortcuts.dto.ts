import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsLogDate } from '../../common/log-date';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealTypeDto = (typeof MEALS)[number];

export class LogRecipeDto {
  @IsLogDate()
  log_date!: string;

  @IsIn(MEALS)
  meal_type!: MealTypeDto;

  @IsUUID()
  recipe_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  servings!: number;
}

export class UpdateRecipeServingsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  servings!: number;
}

export class QuickAddDto {
  @IsLogDate()
  log_date!: string;

  @IsIn(MEALS)
  meal_type!: MealTypeDto;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20000)
  calories!: number;

  // Opcionales y por defecto cero: el quick add existe justamente para cuando
  // no se conocen los macros. Si los pidiera todos, no sería un atajo.
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2000)
  protein?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2000)
  carbs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2000)
  fat?: number;
}

export class CopyDto {
  @IsLogDate()
  from_date!: string;

  @IsLogDate()
  to_date!: string;

  /** Sin meal_type se copia el día entero. */
  @IsOptional()
  @IsIn(MEALS)
  meal_type?: MealTypeDto;

  /** Mover el desayuno del lunes a la cena del martes. */
  @IsOptional()
  @IsIn(MEALS)
  to_meal_type?: MealTypeDto;

  /** Por defecto agrega. Con replace, borra antes lo que haya en el destino. */
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

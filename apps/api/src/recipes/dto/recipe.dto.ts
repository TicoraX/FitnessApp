import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RecipeComponentDto {
  @IsUUID()
  food_item_id!: string;

  /** En porciones del alimento, la misma unidad que servings_consumed. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999)
  quantity!: number;
}

export class CreateRecipeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(100)
  total_servings!: number;

  // El tope de 50 acota cuántas filas inserta un solo logueo de receta.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RecipeComponentDto)
  components!: RecipeComponentDto[];
}

/**
 * components es reemplazo total, no un diff por componente: la UI edita la
 * lista entera y un API de diff serían tres endpoints más para nada.
 */
export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(100)
  total_servings?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RecipeComponentDto)
  components?: RecipeComponentDto[];
}

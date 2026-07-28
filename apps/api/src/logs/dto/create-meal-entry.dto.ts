import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateMealEntryDto {
  /** Fecha del diario (YYYY-MM-DD). Por defecto, hoy en el cliente. */
  @IsOptional()
  @IsISO8601({ strict: true })
  log_date?: string;

  @IsIn(['breakfast', 'lunch', 'dinner', 'snack'])
  meal_type!: 'breakfast' | 'lunch' | 'dinner' | 'snack';

  @IsUUID()
  food_item_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999)
  servings_consumed!: number;
}

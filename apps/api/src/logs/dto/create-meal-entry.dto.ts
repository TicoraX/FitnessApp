import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsUUID, Matches, Max, Min } from 'class-validator';

export class CreateMealEntryDto {
  /**
   * Fecha del diario (YYYY-MM-DD), obligatoria: el servidor no conoce la zona
   * horaria del cliente, y adivinarla escribe la comida en el día equivocado.
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'log_date debe ser YYYY-MM-DD' })
  log_date!: string;

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

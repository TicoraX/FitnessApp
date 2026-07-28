import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsLogDate } from '../../common/log-date';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(72) // límite de argon2/bcrypt-compatible
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/, {
    message: 'password: mínimo 10 caracteres, con mayúscula, minúscula y número',
  })
  password!: string;

  @IsString()
  @MaxLength(100)
  first_name!: string;

  @IsDateString()
  dob!: string;

  @IsIn(['male', 'female', 'other'])
  gender!: 'male' | 'female' | 'other';

  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(260)
  height_cm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(25)
  @Max(500)
  current_weight_kg!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(25)
  @Max(500)
  target_weight_kg!: number;

  @Type(() => Number)
  @IsIn([1.2, 1.375, 1.55, 1.725, 1.9])
  activity_level!: number;

  /** Negativo = bajar de peso. Rango seguro: -1kg a +1kg por semana. */
  @Type(() => Number)
  @IsNumber()
  @Min(-1)
  @Max(1)
  weekly_goal_kg!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(70)
  body_fat_pct?: number;

  /**
   * Día local del cliente para la primera pesada. Sin esto el servidor usa su
   * día UTC, que en UTC-3 después de las 21:00 es el día siguiente.
   */
  @IsOptional()
  @IsLogDate()
  logged_on?: string;
}

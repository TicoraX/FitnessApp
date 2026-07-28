import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsLogDate } from '../../common/log-date';

export class GuestDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

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

  @IsOptional()
  @IsLogDate()
  logged_on?: string;
}

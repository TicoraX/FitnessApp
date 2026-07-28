import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Module,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, Matches, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WeightService } from './weight.service';

class LogWeightDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'logged_on debe ser YYYY-MM-DD' })
  logged_on!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25)
  @Max(500)
  weight_kg!: number;
}

type AuthedRequest = { user: { userId: string } };

@Controller('api/v1/weight')
@UseGuards(JwtAuthGuard)
export class WeightController {
  constructor(private readonly weight: WeightService) {}

  @Post()
  log(@Req() req: AuthedRequest, @Body() dto: LogWeightDto) {
    return this.weight.log(req.user.userId, dto.logged_on, dto.weight_kg);
  }

  @Get()
  series(
    @Req() req: AuthedRequest,
    @Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number,
  ) {
    return this.weight.series(req.user.userId, Math.min(Math.max(days, 1), 730));
  }
}

@Module({ controllers: [WeightController], providers: [WeightService] })
export class WeightModule {}

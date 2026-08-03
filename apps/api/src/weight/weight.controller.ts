import { Body, Controller, Get, Module, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';
import { IsLogDate } from '../common/log-date';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WeightService } from './weight.service';
import { WeightSeriesQueryDto } from './dto/series.dto';

class LogWeightDto {
  @IsLogDate()
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
  series(@Req() req: AuthedRequest, @Query() query: WeightSeriesQueryDto) {
    return this.weight.series(req.user.userId, query.days ?? 90);
  }
}

@Module({ controllers: [WeightController], providers: [WeightService] })
export class WeightModule {}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMealEntryDto } from './dto/create-meal-entry.dto';
import { UpdateServingsDto, UpdateWaterDto } from './dto/update-entry.dto';
import { LogsService } from './logs.service';

type AuthedRequest = { user: { userId: string } };

function isoDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('date debe ser YYYY-MM-DD');
  return date;
}

@Controller('api/v1/logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Post('meal')
  addMeal(@Req() req: AuthedRequest, @Body() dto: CreateMealEntryDto) {
    return this.logs.addMealEntry(req.user.userId, dto);
  }

  @Patch('meal/:id')
  updateMeal(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServingsDto,
  ) {
    return this.logs.updateMealEntry(req.user.userId, id, dto.servings_consumed);
  }

  @Patch(':date/water')
  setWater(@Req() req: AuthedRequest, @Param('date') date: string, @Body() dto: UpdateWaterDto) {
    return this.logs.setWater(req.user.userId, isoDate(date), dto.water_ml);
  }

  @Delete('meal/:id')
  @HttpCode(204)
  deleteMeal(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.logs.deleteMealEntry(req.user.userId, id);
  }

  @Get(':date')
  getDay(@Req() req: AuthedRequest, @Param('date') date: string) {
    return this.logs.getDay(req.user.userId, isoDate(date));
  }
}

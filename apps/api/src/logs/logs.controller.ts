import {
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
import { parseLogDate } from '../common/log-date';
import { LogsService } from './logs.service';

type AuthedRequest = { user: { userId: string } };

// El regex de forma dejaba pasar 2026-02-31, que reventaba en Postgres y salía
// como 500 en vez de 400.
const isoDate = parseLogDate;

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

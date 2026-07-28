import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMealEntryDto } from './dto/create-meal-entry.dto';
import { LogsService } from './logs.service';

type AuthedRequest = { user: { userId: string } };

@Controller('api/v1/logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Post('meal')
  addMeal(@Req() req: AuthedRequest, @Body() dto: CreateMealEntryDto) {
    return this.logs.addMealEntry(req.user.userId, dto);
  }

  @Delete('meal/:id')
  @HttpCode(204)
  deleteMeal(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.logs.deleteMealEntry(req.user.userId, id);
  }

  @Get(':date')
  getDay(@Req() req: AuthedRequest, @Param('date') date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('date debe ser YYYY-MM-DD');
    return this.logs.getDay(req.user.userId, date);
  }
}

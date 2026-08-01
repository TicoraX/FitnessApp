import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto, UpdateRoutineDto } from './dto/routine.dto';

type AuthedRequest = { user: { userId: string } };

@Controller('api/v1/routines')
@UseGuards(JwtAuthGuard)
export class RoutinesController {
  constructor(private readonly routines: RoutinesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.routines.list(req.user.userId);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.routines.get(req.user.userId, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateRoutineDto) {
    return this.routines.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoutineDto,
  ) {
    return this.routines.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.routines.remove(req.user.userId, id);
  }
}

@Module({ controllers: [RoutinesController], providers: [RoutinesService] })
export class RoutinesModule {}

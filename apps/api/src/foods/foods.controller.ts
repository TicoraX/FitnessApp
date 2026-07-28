import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFoodDto } from './dto/create-food.dto';
import { FoodsService } from './foods.service';

type AuthedRequest = { user: { userId: string } };

@Controller('api/v1/foods')
@UseGuards(JwtAuthGuard)
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  // La búsqueda es el camino caliente: el cliente dispara una por tecleo.
  @Get('search')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  search(
    @Query('q') q: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (!q) throw new BadRequestException('q es obligatorio');
    return this.foods.search(q, Math.min(Math.max(limit, 1), 50));
  }

  @Get('recent')
  recent(@Req() req: AuthedRequest) {
    return this.foods.recent(req.user.userId, 8);
  }

  @Get('barcode/:barcode')
  byBarcode(@Param('barcode') barcode: string) {
    if (!/^\d{8,14}$/.test(barcode)) throw new BadRequestException('barcode inválido');
    return this.foods.findByBarcode(barcode);
  }

  // Alimentos creados por usuarios: 30/hora alcanza y frena el spam del catálogo.
  @Post()
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  create(@Req() req: AuthedRequest, @Body() dto: CreateFoodDto) {
    return this.foods.create(req.user.userId, dto);
  }
}

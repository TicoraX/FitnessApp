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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFoodDto } from './dto/create-food.dto';
import { FoodSearchQueryDto } from './dto/search.dto';
import { FoodsService } from './foods.service';

type AuthedRequest = { user: { userId: string } };

@Controller('api/v1/foods')
@UseGuards(JwtAuthGuard)
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  // La búsqueda es el camino caliente: el cliente dispara una por tecleo.
  @Get('search')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  search(@Query() query: FoodSearchQueryDto) {
    return this.foods.search(query.q, query.limit ?? 20);
  }

  @Get('recent')
  recent(@Req() req: AuthedRequest) {
    return this.foods.recent(req.user.userId, 8);
  }

  @Get('favorites')
  favorites(@Req() req: AuthedRequest) {
    return this.foods.favorites(req.user.userId, 30);
  }

  @Put(':id/favorite')
  addFavorite(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.foods.addFavorite(req.user.userId, id);
  }

  @Delete(':id/favorite')
  @HttpCode(204)
  removeFavorite(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.foods.removeFavorite(req.user.userId, id);
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

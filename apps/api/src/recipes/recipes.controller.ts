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
import { RecipesService } from './recipes.service';
import { CreateRecipeDto, UpdateRecipeDto } from './dto/recipe.dto';

type AuthedRequest = { user: { userId: string } };

@Controller('api/v1/recipes')
@UseGuards(JwtAuthGuard)
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.recipes.list(req.user.userId);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.recipes.get(req.user.userId, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateRecipeDto) {
    return this.recipes.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.recipes.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  archive(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.recipes.archive(req.user.userId, id);
  }
}

@Module({ controllers: [RecipesController], providers: [RecipesService] })
export class RecipesModule {}

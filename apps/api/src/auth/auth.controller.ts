import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

// 5 intentos por 15 min en endpoints de credenciales. Configurable solo para
// poder correr la suite end to end repetidas veces en local; en producción se
// deja el valor por defecto.
@Throttle({ default: { limit: Number(process.env.AUTH_RATE_LIMIT ?? 5), ttl: 900_000 } })
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { userId: string; email: string } }) {
    return { status: 'success', data: req.user };
  }
}

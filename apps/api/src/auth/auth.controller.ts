import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GuestDto } from './dto/guest.dto';
import { ClaimDto } from './dto/claim.dto';
import { ForgotDto, ResetDto } from './dto/password-reset.dto';
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

  @Post('guest')
  registerGuest(@Body() dto: GuestDto) {
    return this.auth.registerGuest(dto);
  }

  @Post('claim')
  @UseGuards(JwtAuthGuard)
  claimAccount(@Req() req: { user: { userId: string } }, @Body() dto: ClaimDto) {
    return this.auth.claimAccount(req.user.userId, dto);
  }

  /**
   * Más apretado que el resto de auth: cada llamada puede disparar un mail a
   * una dirección que elige quien la invoca. 3 por 15 minutos por IP.
   */
  @Post('forgot')
  @HttpCode(202)
  @Throttle({ default: { limit: Number(process.env.FORGOT_RATE_LIMIT ?? 3), ttl: 900_000 } })
  forgot(@Body() dto: ForgotDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  reset(@Body() dto: ResetDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /**
   * No es un endpoint de credenciales: pide un JWT válido, no prueba ninguno.
   * Cuenta con un límite específico por ruta de 100 peticiones por cada 60 segundos
   * (100/min) para evitar bloqueos por recargas frecuentes.
   */
  @Get('me')
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { userId: string; email: string } }) {
    return { status: 'success', data: req.user };
  }
}

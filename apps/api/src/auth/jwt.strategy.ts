import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Esto consulta la base en cada request autenticado, que antes no pasaba.
   * Es el precio de poder revocar: sin leer nada, un token robado sigue
   * sirviendo hasta vencer, y restablecer la contraseña no echaría a nadie.
   *
   * Es un SELECT por clave primaria sobre el pool que ya está abierto, y toda
   * request que llega acá va a pegarle a la base igual. Si algún día pesa, la
   * salida es cachear la versión, no sacar el chequeo.
   */
  async validate(payload: { sub: string; email?: string; tv?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, tokenVersion: true },
    });

    // La cuenta ya no existe: el token es válido criptográficamente y no vale
    // nada. Antes pasaba el guard y reventaba más adelante.
    if (!user) throw new UnauthorizedException();

    // Los tokens emitidos antes de esta columna no traen tv; se toman como 0,
    // que es el valor inicial, así que las sesiones vivas no se caen al
    // desplegar.
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }

    return { userId: user.id, email: user.email };
  }
}

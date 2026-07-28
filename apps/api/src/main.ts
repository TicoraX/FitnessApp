import 'reflect-metadata';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const security = new Logger('security');

  app.use(helmet()); // CSP, X-Content-Type-Options, X-Frame-Options, HSTS
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? false });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        // Se loguean los campos rechazados, nunca sus valores (pueden ser PII).
        security.warn(`input rechazado: ${errors.map((e) => e.property).join(', ')}`);
        return new BadRequestException(errors.map((e) => Object.values(e.constraints ?? {})).flat());
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

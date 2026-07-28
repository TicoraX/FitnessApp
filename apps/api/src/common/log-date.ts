import { BadRequestException } from '@nestjs/common';
import { registerDecorator, type ValidationOptions } from 'class-validator';

const SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const MIN = '2000-01-01';

/**
 * Un regex de forma no alcanza: "2026-02-31" lo pasa, y después revienta en
 * Postgres como 500 en vez de 400. Esto comprueba que la fecha exista de
 * verdad y que caiga en una ventana razonable.
 *
 * Se permite el pasado sin límite práctico (cargar días viejos es legítimo) y
 * hasta un año hacia adelante, que cubre planificar comidas sin aceptar el
 * año 2999.
 */
export function isLogDate(value: unknown): value is string {
  if (typeof value !== 'string' || !SHAPE.test(value)) return false;

  // Round-trip: si el día no existe, Date normaliza y el texto ya no coincide.
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;

  const max = new Date();
  max.setUTCFullYear(max.getUTCFullYear() + 1);
  return value >= MIN && value <= max.toISOString().slice(0, 10);
}

/** Para parámetros de ruta, donde no hay DTO que validar. */
export function parseLogDate(value: string): string {
  if (!isLogDate(value)) {
    throw new BadRequestException('date debe ser YYYY-MM-DD, existir y no estar a más de un año');
  }
  return value;
}

export function IsLogDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isLogDate',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => isLogDate(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'la fecha'} debe ser YYYY-MM-DD, existir y no estar a más de un año`,
      },
    });
  };
}

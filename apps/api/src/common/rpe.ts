import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Esfuerzo percibido: escala RPE de 1 a 10 en pasos de 0.5.
 *
 * El paso importa. La escala tiene esa resolución y nada más: 10 es no poder
 * hacer una repetición más, 9 es dejarse una, 8 dos. Un 7.3 no significa nada y
 * dejarlo entrar solo ensucia los promedios con precisión falsa.
 */
export const esRpe = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 10 && (v * 2) % 1 === 0;

export function IsRpe(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isRpe',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => value === undefined || esRpe(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'el esfuerzo'} va de 1 a 10 y de a medios puntos`,
      },
    });
  };
}

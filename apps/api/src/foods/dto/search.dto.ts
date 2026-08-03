import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Express arma un array cuando el parámetro viene repetido: `?q=a&q=b` llega
 * como `['a','b']`, no como texto. Sin DTO eso pasaba el `if (!q)` y terminaba
 * en la consulta convertido en "a,b", devolviendo resultados que nadie pidió.
 * Ahora es un 400 con su mensaje, que es lo que corresponde a una petición mal
 * armada.
 *
 * El techo de 50 ya lo aplicaba un Math.min en el controller, así que la carga
 * máxima no cambia. Lo que cambia es que `limit=abc` deja de caer al default en
 * silencio: pedir con un parámetro que no es número es un error del que llama,
 * y tragárselo esconde bugs del cliente.
 */
export class FoodSearchQueryDto {
  @IsString({ message: 'q tiene que venir una sola vez y ser texto' })
  @MinLength(1, { message: 'q es obligatorio' })
  @MaxLength(100, { message: 'q no puede pasar de 100 caracteres' })
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit tiene que ser un número entero' })
  @Min(1, { message: 'limit va de 1 a 50' })
  @Max(50, { message: 'limit va de 1 a 50' })
  limit?: number;
}

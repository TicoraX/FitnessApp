import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Ver el comentario de FoodSearchQueryDto: un parámetro repetido llega como
 * array y se colaba hasta la búsqueda, que devolvía una lista vacía sin decir
 * que la petición estaba mal armada.
 *
 * `q` es opcional acá y no en alimentos: el catálogo de movimientos se explora
 * con los chips de zona y equipo, sin escribir nada.
 */
export class ActivitySearchQueryDto {
  @IsOptional()
  @IsString({ message: 'q tiene que venir una sola vez y ser texto' })
  @MaxLength(100, { message: 'q no puede pasar de 100 caracteres' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit tiene que ser un número entero' })
  @Min(1, { message: 'limit va de 1 a 50' })
  @Max(50, { message: 'limit va de 1 a 50' })
  limit?: number;
}

export class MovementSearchQueryDto extends ActivitySearchQueryDto {
  @IsOptional()
  @IsString({ message: 'body tiene que venir una sola vez y ser texto' })
  @MaxLength(50, { message: 'body no puede pasar de 50 caracteres' })
  body?: string;

  @IsOptional()
  @IsString({ message: 'equipment tiene que venir una sola vez y ser texto' })
  @MaxLength(50, { message: 'equipment no puede pasar de 50 caracteres' })
  equipment?: string;
}

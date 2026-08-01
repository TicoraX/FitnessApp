/**
 * Un movimiento con sus dos nombres.
 *
 * El español va adelante cuando está curado, y el inglés siempre queda debajo:
 * es el nombre real del ejercicio, el que aparece en cualquier app de gimnasio
 * y el que hay que escribir en YouTube para ver cómo se hace. Ocultarlo por
 * traducir sería quitarle al usuario la forma de verificar.
 *
 * Sin traducción curada solo se muestra el inglés, sin ningún hueco ni
 * marcador: la mayoría de los 1324 movimientos están así y no es un defecto.
 */
export function NombreMovimiento({
  name,
  nameEs,
  className,
}: {
  name: string;
  nameEs?: string | null;
  className?: string;
}) {
  if (!nameEs) return <span className={className}>{name}</span>;

  return (
    <span className={className}>
      {nameEs}
      <span className="movimiento__original"> {name}</span>
    </span>
  );
}

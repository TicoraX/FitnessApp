import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect, type CSSProperties } from 'react';
import './Counter.css';

/**
 * Un número que cambia deslizando el dígito, no saltando.
 *
 * Viene de un kit y llegó con la maquinaria de un odómetro completo: cada
 * posición renderizaba los diez dígitos apilados para que se viera la tira
 * girar. Nunca se vio: `NumberDigit` devolvía null salvo para el dígito actual,
 * así que nueve de cada diez se creaban y se descartaban en cada render. Lo que
 * sí ocurre, y es lo que se quería, es que el dígito entra desplazado y el
 * spring lo lleva a su lugar, recortado por el overflow del contenedor.
 *
 * También traía diecisiete props de las que se usaban tres. Quedan esas.
 */
interface DigitProps {
  place: number;
  value: number;
  height: number;
}

function Digit({ place, value, height }: DigitProps) {
  // Redondear antes de dividir: en coma flotante 4.999...e2 daría 4 en vez de 5.
  const cerca = (n: number) => {
    const entero = Math.round(n);
    return Math.abs(n - entero) < 1e-9 * Math.max(1, Math.abs(n)) ? entero : n;
  };
  const objetivo = Math.abs(Math.floor(cerca(value / place)) % 10);

  const animado = useSpring(objetivo, { mass: 1, stiffness: 40, damping: 20 });
  const y = useTransform(animado, (actual) => (objetivo - actual) * height);

  useEffect(() => {
    animado.set(objetivo);
  }, [animado, objetivo]);

  return (
    <span className="counter-digit" style={{ height }}>
      <motion.span className="counter-number" style={{ y }}>
        {objetivo}
      </motion.span>
    </span>
  );
}

export default function Counter({
  value,
  fontSize = 48,
  fontWeight = 'inherit',
}: {
  value: number;
  fontSize?: number;
  fontWeight?: CSSProperties['fontWeight'];
}) {
  const digitos = Math.round(value).toString().length;
  const posiciones = Array.from({ length: digitos }, (_, i) => 10 ** (digitos - i - 1));

  return (
    <span className="counter-container">
      <span className="counter-counter" style={{ fontSize, fontWeight, gap: 2, direction: 'ltr' }}>
        {posiciones.map((place) => (
          <Digit key={place} place={place} value={value} height={fontSize} />
        ))}
      </span>
    </span>
  );
}

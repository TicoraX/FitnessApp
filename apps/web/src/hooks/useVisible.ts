import { useEffect, useRef, useState } from 'react';

/**
 * Avisa cuando el elemento entró en pantalla por primera vez, y no vuelve atrás.
 *
 * Sirve para no pedirle datos al servidor a una tarjeta que el usuario todavía
 * no miró. En el teléfono, la mitad del diario arranca abajo del pliegue: sin
 * esto, entrar dispara los pedidos de paneles que nadie va a ver hasta que
 * scrollee, si es que scrollea.
 *
 * El margen de 200px hace que la carga empiece justo antes de que la tarjeta
 * asome, así el dato suele estar cuando termina de entrar.
 *
 * Sin IntersectionObserver devuelve true de entrada: es mejor pedir de más que
 * dejar una tarjeta vacía para siempre.
 */
export function useVisible<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(() => !('IntersectionObserver' in globalThis));

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  return [ref, visible] as const;
}

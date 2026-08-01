import { useEffect, useRef } from 'react';

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Lo mínimo que un diálogo modal le debe al teclado: Escape cierra, Tab no se
 * escapa al fondo, y al cerrar el foco vuelve de donde vino.
 *
 * Sin esto, abrir la modal deja el foco en el body: con lector de pantalla no
 * se anuncia nada y con Tab se recorre la página de atrás, que es invisible.
 *
 * Devuelve el ref que hay que colgar del contenedor de la modal. `abierto` es
 * dependencia del efecto porque los modales de este proyecto se montan y
 * desmontan con un booleano del componente padre, no con su propio componente.
 */
export function useModalDialog<T extends HTMLElement>(abierto: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const contenedor = ref.current;
    if (!abierto || !contenedor) return;

    const previo = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(contenedor.querySelectorAll<HTMLElement>(FOCUSABLES));

    // El primer control, no el contenedor: el usuario ya está donde tiene que
    // escribir sin gastar un Tab.
    (focusables()[0] ?? contenedor).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const primero = items[0];
      const ultimo = items[items.length - 1];

      // Shift+Tab en el primero salta al último y viceversa; sin esto el foco
      // se va al navegador y no vuelve.
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    contenedor.addEventListener('keydown', onKeyDown);
    return () => {
      contenedor.removeEventListener('keydown', onKeyDown);
      previo?.focus();
    };
  }, [abierto, onClose]);

  return ref;
}

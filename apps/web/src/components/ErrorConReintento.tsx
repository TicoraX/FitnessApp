import { useState } from 'react';

/**
 * Un fallo de carga que el usuario puede resolver solo.
 *
 * Existe porque varias tarjetas trataban un error de red como "no hay datos":
 * la de peso mostraba "Registrá tu peso para ver la tendencia" a quien tenía
 * noventa pesadas cargadas. Un panel vacío y uno que no cargó se ven igual y
 * significan cosas opuestas.
 *
 * Usa `.alert` como el resto de la app. Lo que agrega es el botón, porque sin
 * red la acción correcta es reintentar y eso no puede costar recargar la
 * página entera.
 *
 * El estado de reintento vive acá y no en cada llamador: son siete tarjetas y
 * ninguna necesita saberlo para otra cosa.
 */
export function ErrorConReintento({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar: () => void | Promise<void>;
}) {
  const [reintentando, setReintentando] = useState(false);

  async function reintentar() {
    setReintentando(true);
    try {
      await onReintentar();
    } finally {
      setReintentando(false);
    }
  }

  return (
    <p className="alert alert--reintento" role="alert">
      <span>{mensaje}</span>
      <button
        type="button"
        className="alert__btn"
        onClick={reintentar}
        disabled={reintentando}
        data-state={reintentando ? 'loading' : undefined}
      >
        {reintentando ? 'Reintentando' : 'Reintentar'}
      </button>
    </p>
  );
}

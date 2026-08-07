import { useEffect, useRef, useState } from 'react';
import { AJUSTE_MS, formatear, segundosRestantes } from '../descanso';
import { IconoCerrar } from './IconoCerrar';
import './Descanso.css';

/**
 * La barra del descanso entre series. Arranca sola al confirmar una serie y
 * vive arriba del router, así que mirar el diario en medio de un descanso no la
 * corta.
 *
 * El intervalo solo repinta: el número sale de restar contra `hasta`. Además se
 * recalcula al volver a la pestaña, para que el primer frame ya esté bien y no
 * el siguiente tick.
 */
export function Descanso({
  hasta,
  onAjustar,
  onCerrar,
}: {
  hasta: number;
  onAjustar: (ms: number) => void;
  onCerrar: () => void;
}) {
  const [restan, setRestan] = useState(() => segundosRestantes(hasta, Date.now()));
  const onCerrarRef = useRef(onCerrar);

  useEffect(() => {
    onCerrarRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    const repintar = () => setRestan(segundosRestantes(hasta, Date.now()));
    repintar();
    const id = setInterval(repintar, 250);
    const alVolver = () => document.visibilityState === 'visible' && repintar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [hasta]);

  // Vibra, no suena: el sonido pide permiso, molesta en un gimnasio y obliga a
  // decidir qué pasa con el teléfono en silencio.
  //
  // Y se va sola diez segundos después. La barra sobrevive a cambiar de vista a
  // propósito, pero una vez en cero ya cumplió: quedarse ahí es tapar contenido
  // de una pantalla que no tiene nada que ver con el descanso.
  useEffect(() => {
    if (restan !== 0) return;
    navigator.vibrate?.([200, 100, 200]);
    const id = setTimeout(() => onCerrarRef.current(), 10_000);
    return () => clearTimeout(id);
  }, [restan === 0]);

  return (
    <div className={`descanso${restan === 0 ? ' descanso--listo' : ''}`} role="timer" aria-live="off">
      <span className="descanso__etiqueta">{restan === 0 ? 'A la siguiente' : 'Descanso'}</span>
      <strong className="descanso__cuenta num" aria-label={`Quedan ${restan} segundos de descanso`}>
        {formatear(restan)}
      </strong>
      <div className="descanso__acciones">
        <button type="button" className="btn btn--quiet" onClick={() => onAjustar(-AJUSTE_MS)}>
          -15
        </button>
        <button type="button" className="btn btn--quiet" onClick={() => onAjustar(AJUSTE_MS)}>
          +15
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCerrar} aria-label="Cerrar el descanso">
          <IconoCerrar />
        </button>
      </div>
    </div>
  );
}

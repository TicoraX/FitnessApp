import { useState } from 'react';

/**
 * Cómo se ve el movimiento y cómo se hace: la animación y el video, juntos.
 *
 * No se pisan. El GIF contesta QUÉ es el movimiento de un vistazo, sin salir de
 * la app. El video contesta CÓMO hacerlo: una animación de 180x180, muda y en
 * loop, no enseña técnica ni los errores típicos.
 *
 * El GIF es opcional a propósito. Los archivos son © Gym visual y no están en
 * este repo: sus términos permiten usarlos dentro de una app con licencia
 * comprada, y prohíben ponerlos a disposición para que un tercero los descargue,
 * que es lo que sería subirlos a un repo público. Quien despliega apunta
 * VITE_MOVEMENT_MEDIA_URL a donde los tenga. Sin esa variable queda solo el
 * link, que es el estado por defecto y funciona igual.
 */
const BASE = (import.meta.env.VITE_MOVEMENT_MEDIA_URL ?? '').replace(/\/$/, '');

export function MediaMovimiento({ name, media }: { name: string; media: string | null }) {
  const [falló, setFalló] = useState(false);

  const buscar = `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to ${name}`)}`;

  return (
    <div className="media-mov">
      {BASE && media && !falló && (
        <figure className="media-mov__fig">
          <img
            className="media-mov__gif"
            src={`${BASE}/${media}.gif`}
            /* El catálogo son 1324 movimientos: sin esto el navegador pediría
               el GIF de cada uno al abrir la lista. */
            loading="lazy"
            decoding="async"
            width={180}
            height={180}
            alt={`Animación del movimiento ${name}`}
            onError={() => setFalló(true)}
          />
          {/* Los términos de Gym visual exigen que la atribución acompañe a la
              imagen. Si se muestra el GIF, esto se muestra con él. */}
          <figcaption className="media-mov__credito">
            © Gym visual —{' '}
            <a href="https://gymvisual.com/" target="_blank" rel="noopener noreferrer">
              gymvisual.com
            </a>
          </figcaption>
        </figure>
      )}

      <a className="media-mov__video" href={buscar} target="_blank" rel="noopener noreferrer">
        Ver en video
      </a>
    </div>
  );
}

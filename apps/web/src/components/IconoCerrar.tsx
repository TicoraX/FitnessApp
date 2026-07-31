/**
 * La cruz de cerrar como SVG y no como carácter.
 *
 * El "✕" que había antes lo lee un lector de pantalla como "multiplicación" y
 * cambia de forma según la fuente que resuelva el sistema. El aria-label vive
 * en el botón que lo contiene.
 */
export function IconoCerrar({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

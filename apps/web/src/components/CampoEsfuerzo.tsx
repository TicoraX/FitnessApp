/**
 * Esfuerzo percibido (RPE): cuánto costó la serie, de 1 a 10.
 *
 * Es un select y no un número libre porque la escala tiene esa resolución y
 * nada más: 10 es no poder hacer una repetición más, 8 es dejarse dos. Un 7.3
 * no significa nada. Las etiquetas de los valores altos van escritas porque el
 * número solo no le dice nada a quien nunca usó la escala.
 */
const VALORES = [
  ['', 'Sin dato'],
  ['10', '10 · al fallo'],
  ['9.5', '9.5'],
  ['9', '9 · una en reserva'],
  ['8.5', '8.5'],
  ['8', '8 · dos en reserva'],
  ['7.5', '7.5'],
  ['7', '7 · tres en reserva'],
  ['6', '6 · cómodo'],
  ['5', '5 · muy cómodo'],
] as const;

export function CampoEsfuerzo({
  id,
  valor,
  onCambio,
  etiqueta = 'Esfuerzo',
}: {
  id: string;
  valor: string;
  onCambio: (v: string) => void;
  etiqueta?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} value={valor} onChange={(e) => onCambio(e.target.value)}>
        {VALORES.map(([v, texto]) => (
          <option key={v || 'sin'} value={v}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

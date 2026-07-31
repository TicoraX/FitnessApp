import { useEffect, useState, type CSSProperties } from 'react';
import { api, today, type DaySummary, type MicroReference } from '../api';

/**
 * Micronutrientes del día contra los valores de referencia de etiquetado.
 *
 * Es del día y no del rango que elige el resto de Progreso: los micros se
 * miran para decidir qué comer hoy, y promediar noventa días de calcio no
 * responde ninguna pregunta útil.
 *
 * Las etiquetas y los VDR vienen del API para que no haya dos tablas que
 * mantener en sincronía.
 */
export function Nutrientes() {
  const [dia, setDia] = useState<DaySummary | null>(null);
  const [refs, setRefs] = useState<MicroReference[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const [d, r] = await Promise.all([
          api.get<{ data: DaySummary }>(`/logs/${today()}`),
          api.get<{ data: MicroReference[] }>('/reports/micros/reference'),
        ]);
        if (!vigente) return;
        setDia(d.data);
        setRefs(r.data);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar los nutrientes');
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  if (error) {
    return (
      <p className="alert" role="status">
        {error}
      </p>
    );
  }
  if (!dia || refs.length === 0) return <p className="muted">Cargando nutrientes.</p>;

  const { totals, entries_with_data, entries_total } = dia.micros;
  const sinDatos = entries_total > 0 && entries_with_data === 0;

  return (
    <div className="stack" style={{ gap: 'var(--space-md)' }}>
      {entries_total === 0 && (
        <p className="muted">Registrá algo hoy para ver sus nutrientes.</p>
      )}

      {/* La advertencia va antes de las barras: si se lee después, ya se
          interpretó un cero como "me falta calcio". */}
      {entries_total > 0 && (
        <p className="hint muted" style={{ fontSize: 'var(--text-sm)' }}>
          {sinDatos
            ? `${entries_total === 1 ? 'El único registro de hoy no declara' : `Ninguno de los ${entries_total} registros de hoy declara`} micronutrientes. Los ceros de abajo son falta de datos, no ausencia del nutriente.`
            : `${entries_with_data} de ${entries_total} ${entries_total === 1 ? 'registro' : 'registros'} de hoy ${entries_with_data === 1 ? 'declara' : 'declaran'} micronutrientes. El resto no suma.`}
        </p>
      )}

      <div className="macros">
        {refs.map((m) => {
          const valor = totals[m.key] ?? 0;
          const pct = Math.min((valor / m.rdi) * 100, 100);
          const excedido = valor > m.rdi;

          return (
            <div key={m.key} className="macro">
              <div className="macro__head">
                <span className="macro__name">{m.label}</span>
                <span className="macro__value num">
                  {valor} / {m.rdi} {m.unit}
                </span>
              </div>
              {/* El meter va en el carril y no en el relleno: con el nutriente
                  en cero el relleno mide cero de ancho y deja de existir para
                  un lector de pantalla, que es justo cuando hay algo que decir. */}
              <div
                className="macro__track"
                role="meter"
                aria-label={m.label}
                aria-valuenow={valor}
                aria-valuemin={0}
                aria-valuemax={m.rdi}
              >
                <div
                  className="macro__fill"
                  data-over={excedido}
                  style={
                    {
                      width: `${pct}%`,
                      '--macro-color': excedido ? 'var(--color-danger)' : 'var(--color-primary)',
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        Valores de referencia de etiquetado (NRV), no objetivos personalizados.
      </p>
    </div>
  );
}

import { getWeekDays, shiftDate, today } from '../../api';

export function CyberDayStrip({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const days = getWeekDays(date);

  return (
    <div
      className="cyber-day-strip"
      role="group"
      aria-label="Barra de calendario"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.4rem 0.6rem',
        marginBottom: '1.25rem',
        boxShadow: 'var(--shadow-card)',
        gap: '0.25rem',
      }}
    >
      <input
        type="date"
        id="date"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        className="visually-hidden"
        aria-label="Fecha"
      />
      <button
        type="button"
        className="btn btn--quiet"
        aria-label="Semana anterior"
        title="Semana anterior"
        style={{ padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}
        onClick={() => setDate(shiftDate(date, -7))}
      >
        ‹‹
      </button>

      <div style={{ display: 'flex', gap: '0.25rem', flex: 1, justifyContent: 'center', overflowX: 'auto' }}>
        {days.map((d) => {
          const isSelected = d.iso === date;
          return (
            <button
              key={d.iso}
              type="button"
              disabled={d.isFuture}
              aria-current={isSelected ? 'date' : undefined}
              onClick={() => setDate(d.iso)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem 0.5rem',
                minWidth: '42px',
                borderRadius: 'var(--radius-md)',
                background: isSelected ? 'oklch(0.82 0.22 145 / 0.15)' : 'transparent',
                color: isSelected ? 'var(--color-primary)' : d.isFuture ? 'var(--text-faint)' : 'var(--text-muted)',
                border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                fontWeight: isSelected ? 700 : 500,
                cursor: d.isFuture ? 'not-allowed' : 'pointer',
                opacity: d.isFuture ? 0.35 : 1,
                transition: 'all var(--dur-state) var(--ease-out)',
                boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', opacity: isSelected ? 1 : 0.7 }}>
                {d.dayName}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                {d.dayNum}
              </span>
              {d.isToday && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    width: '12px',
                    height: '2px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary)',
                    boxShadow: '0 0 6px var(--color-primary)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn--quiet"
        aria-label="Semana siguiente"
        title="Semana siguiente"
        disabled={shiftDate(date, 7) > today()}
        style={{
          padding: '0.3rem 0.5rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          opacity: shiftDate(date, 7) > today() ? 0.3 : 1,
        }}
        onClick={() => setDate(shiftDate(date, 7))}
      >
        ››
      </button>
    </div>
  );
}


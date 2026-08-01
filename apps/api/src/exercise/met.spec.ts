import { caloriesBurned, metOf, searchActivities, searchMovements } from './met';
import { ACTIVITIES } from './catalog';

describe('cálculo MET', () => {
  it('aplica MET x peso x horas', () => {
    // Correr a 10 km/h (9.8 MET), 82 kg, media hora: 9.8 * 82 * 0.5 = 401.8
    expect(caloriesBurned(9.8, 82, 30)).toBe(402);
  });

  it('escala lineal con la duración', () => {
    expect(caloriesBurned(8, 70, 60)).toBe(560);
    expect(caloriesBurned(8, 70, 120)).toBe(1120);
  });

  it('una sesión de un minuto no da cero', () => {
    expect(caloriesBurned(9.8, 82, 1)).toBeGreaterThan(0);
  });
});

describe('búsqueda de actividades', () => {
  it('prioriza los que empiezan con el término', () => {
    const r = searchActivities('cor');
    expect(r[0].name).toMatch(/^Correr/);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(searchActivities('FÚTBOL').map((a) => a.name)).toContain('Fútbol');
    expect(searchActivities('futbol').map((a) => a.name)).toContain('Fútbol');
  });

  it('sin término devuelve el catálogo recortado al límite', () => {
    expect(searchActivities('', 5)).toHaveLength(5);
  });

  it('un término que no está da vacío, no el catálogo entero', () => {
    expect(searchActivities('ajedrez postal')).toEqual([]);
  });
});

describe('búsqueda de movimientos', () => {
  it('encuentra por nombre en inglés', () => {
    expect(searchMovements('bench press').length).toBeGreaterThan(0);
  });

  it('encuentra por zona, equipo y músculo en español', () => {
    expect(searchMovements('mancuerna').length).toBeGreaterThan(0);
    expect(searchMovements('cuadriceps').length).toBeGreaterThan(0);
    expect(searchMovements('espalda').length).toBeGreaterThan(0);
  });

  it('respeta el límite', () => {
    expect(searchMovements('press', 5)).toHaveLength(5);
    expect(searchMovements('', 3)).toHaveLength(3);
  });

  it('un término que no está da vacío', () => {
    expect(searchMovements('malabares con motosierras')).toEqual([]);
  });
});

describe('catálogo', () => {
  it('no tiene nombres repetidos: metOf tiene que ser unívoco', () => {
    const nombres = ACTIVITIES.map((a) => a.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('todos los MET son plausibles', () => {
    for (const a of ACTIVITIES) {
      expect(a.met).toBeGreaterThanOrEqual(2);
      expect(a.met).toBeLessThanOrEqual(20);
    }
  });

  it('metOf resuelve el nombre exacto y null para una actividad libre', () => {
    expect(metOf('Correr (10 km/h)')).toBe(9.8);
    expect(metOf('Malabares con motosierras')).toBeNull();
  });
});

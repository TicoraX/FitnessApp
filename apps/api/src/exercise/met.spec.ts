import {
  bodyOf,
  caloriesBurned,
  countMovements,
  metOf,
  movementByName,
  movementFacets,
  searchActivities,
  searchMovements,
} from './met';
import { ACTIVITIES } from './catalog';
import { MOVEMENTS } from './movements';
import { NOMBRES_ES } from './movements-es';

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

  it('filtra por zona y por equipo', () => {
    const pecho = searchMovements('', 50, { body: 'pecho' });
    expect(pecho.length).toBeGreaterThan(0);
    expect(pecho.every((m) => m.body === 'pecho')).toBe(true);

    const combinado = searchMovements('', 50, { body: 'pecho', equipment: 'mancuerna' });
    expect(combinado.length).toBeGreaterThan(0);
    expect(combinado.every((m) => m.body === 'pecho' && m.equipment === 'mancuerna')).toBe(true);
  });

  it('el filtro también acota la búsqueda por texto', () => {
    const conFiltro = searchMovements('press', 50, { equipment: 'barra' });
    expect(conFiltro.length).toBeGreaterThan(0);
    expect(conFiltro.every((m) => m.equipment === 'barra')).toBe(true);
  });

  it('las facetas son los valores que existen de verdad', () => {
    const { body, equipment } = movementFacets();
    expect(body).toContain('pecho');
    expect(equipment).toContain('mancuerna');
    for (const b of body) expect(searchMovements('', 1, { body: b })).toHaveLength(1);
  });

  it('bodyOf resuelve la zona por nombre y no inventa una para lo desconocido', () => {
    expect(bodyOf('3/4 sit-up')).toBe('core');
    expect(bodyOf('malabares con motosierras')).toBe('otros');
  });

  it('filtra por id exacto', () => {
    const unMov = searchMovements('', 1)[0];
    const porId = searchMovements('', 10, { id: unMov.id });
    expect(porId).toHaveLength(1);
    expect(porId[0].id).toBe(unMov.id);
  });

  it('movementByName resuelve por nombre exacto en inglés o español', () => {
    const porIngles = movementByName('barbell full squat');
    expect(porIngles?.name).toBe('barbell full squat');
    expect(porIngles?.name_es).toBe('Sentadilla con barra');

    const porEspanol = movementByName('Sentadilla con barra');
    expect(porEspanol?.name).toBe('barbell full squat');
  });

  it('offset salta resultados sin cambiar el orden', () => {
    const primeros = searchMovements('', 4, { body: 'pecho' });
    const saltados = searchMovements('', 2, { body: 'pecho' }, 2);
    expect(saltados.map((m) => m.id)).toEqual(primeros.slice(2).map((m) => m.id));
  });

  it('countMovements cuenta todos los que matchean, no solo la página', () => {
    const total = countMovements('', { body: 'pecho' });
    expect(total).toBeGreaterThan(searchMovements('', 1, { body: 'pecho' }).length);
    expect(searchMovements('', total + 10, { body: 'pecho' })).toHaveLength(total);
  });

  it('las facetas de equipo se acotan a la zona elegida', () => {
    const { equipment } = movementFacets({ body: 'core' });
    for (const eq of equipment) {
      expect(searchMovements('', 1, { body: 'core', equipment: eq })).toHaveLength(1);
    }
  });
});

describe('nombres en español', () => {
  it('cada nombre curado corresponde a un movimiento que existe', () => {
    // Sin esto, renombrar o regenerar el catálogo deja traducciones huérfanas
    // que no se muestran nunca y nadie se entera.
    const huerfanos = Object.keys(NOMBRES_ES).filter((n) => !MOVEMENTS.some((m) => m.name === n));
    expect(huerfanos).toEqual([]);
  });

  it('no hay dos movimientos con el mismo nombre en español', () => {
    const valores = Object.values(NOMBRES_ES);
    expect(new Set(valores).size).toBe(valores.length);
  });

  it('se puede buscar en español y en inglés el mismo movimiento', () => {
    const porEspanol = searchMovements('sentadilla con barra', 5);
    expect(porEspanol[0].name).toBe('barbell full squat');
    expect(porEspanol[0].name_es).toBe('Sentadilla con barra');

    const porIngles = searchMovements('barbell full squat', 5);
    expect(porIngles[0].name).toBe('barbell full squat');
  });

  it('ignora acentos: "dominadas" y "press frances" llegan igual', () => {
    expect(searchMovements('dominadas', 5)[0].name_es).toBe('Dominadas');
    expect(searchMovements('press frances', 5)[0].name_es).toMatch(/^Press francés/);
  });

  it('el exacto gana aunque esté al final del catálogo', () => {
    // "close-grip push-up" aparece antes que "push-up" en la lista, así que
    // cortar la búsqueda al llenar el cupo dejaba "Flexiones" afuera.
    expect(searchMovements('flexiones', 3)[0].name).toBe('push-up');
    expect(searchMovements('dominadas', 3)[0].name).toBe('pull-up');
  });

  it('lo que no está curado sale con name_es en null, no inventado', () => {
    const sinCurar = searchMovements('archer push up', 5);
    expect(sinCurar[0].name_es).toBeNull();
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

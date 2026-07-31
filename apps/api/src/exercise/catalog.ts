/**
 * Catálogo de actividades con su MET (Compendium of Physical Activities,
 * Ainsworth et al. 2011).
 *
 * ponytail: array en el código, no tabla en la base. Son datos estáticos que no
 * dependen del usuario ni cambian entre despliegues, así que una tabla solo
 * agregaría una migración, un seed y un JOIN por consulta. Si algún día el
 * usuario define sus propias actividades, ahí sí va a la base.
 */
export interface Activity {
  name: string;
  met: number;
  category: 'cardio' | 'fuerza' | 'deporte' | 'cotidiano';
}

export const ACTIVITIES: Activity[] = [
  // Cardio
  { name: 'Caminar tranquilo (4 km/h)', met: 3.0, category: 'cardio' },
  { name: 'Caminar rápido (6 km/h)', met: 5.0, category: 'cardio' },
  { name: 'Caminar en pendiente', met: 6.0, category: 'cardio' },
  { name: 'Trotar (8 km/h)', met: 8.3, category: 'cardio' },
  { name: 'Correr (10 km/h)', met: 9.8, category: 'cardio' },
  { name: 'Correr (12 km/h)', met: 11.8, category: 'cardio' },
  { name: 'Correr (14 km/h)', met: 14.5, category: 'cardio' },
  { name: 'Cinta de correr', met: 8.0, category: 'cardio' },
  { name: 'Bicicleta suave (16 km/h)', met: 5.8, category: 'cardio' },
  { name: 'Bicicleta moderada (20 km/h)', met: 8.0, category: 'cardio' },
  { name: 'Bicicleta fuerte (25 km/h)', met: 10.0, category: 'cardio' },
  { name: 'Bicicleta fija', met: 7.0, category: 'cardio' },
  { name: 'Spinning', met: 8.5, category: 'cardio' },
  { name: 'Elíptico', met: 5.0, category: 'cardio' },
  { name: 'Escalador', met: 9.0, category: 'cardio' },
  { name: 'Remo en máquina', met: 7.0, category: 'cardio' },
  { name: 'Natación suave', met: 5.8, category: 'cardio' },
  { name: 'Natación intensa', met: 9.8, category: 'cardio' },
  { name: 'Aquagym', met: 5.5, category: 'cardio' },
  { name: 'Saltar la cuerda', met: 12.3, category: 'cardio' },
  { name: 'Subir escaleras', met: 8.8, category: 'cardio' },
  { name: 'Caminata en montaña', met: 6.0, category: 'cardio' },

  // Fuerza
  { name: 'Pesas suave', met: 3.5, category: 'fuerza' },
  { name: 'Pesas intenso', met: 6.0, category: 'fuerza' },
  { name: 'Levantamiento de potencia', met: 6.0, category: 'fuerza' },
  { name: 'Peso corporal (flexiones, sentadillas)', met: 8.0, category: 'fuerza' },
  { name: 'CrossFit', met: 8.0, category: 'fuerza' },
  { name: 'Entrenamiento en circuito', met: 7.5, category: 'fuerza' },
  { name: 'HIIT', met: 8.0, category: 'fuerza' },
  { name: 'Kettlebells', met: 8.0, category: 'fuerza' },
  { name: 'Abdominales', met: 3.8, category: 'fuerza' },
  { name: 'Pilates', met: 3.0, category: 'fuerza' },
  { name: 'Yoga', met: 2.5, category: 'fuerza' },
  { name: 'Yoga power', met: 4.0, category: 'fuerza' },
  { name: 'Estiramiento', met: 2.3, category: 'fuerza' },
  { name: 'TRX / suspensión', met: 5.0, category: 'fuerza' },

  // Deporte
  { name: 'Fútbol', met: 7.0, category: 'deporte' },
  { name: 'Fútbol 5', met: 8.0, category: 'deporte' },
  { name: 'Básquet', met: 6.5, category: 'deporte' },
  { name: 'Tenis', met: 7.3, category: 'deporte' },
  { name: 'Pádel', met: 7.0, category: 'deporte' },
  { name: 'Vóley', met: 4.0, category: 'deporte' },
  { name: 'Handball', met: 8.0, category: 'deporte' },
  { name: 'Rugby', met: 8.3, category: 'deporte' },
  { name: 'Hockey', met: 7.8, category: 'deporte' },
  { name: 'Boxeo (bolsa)', met: 5.5, category: 'deporte' },
  { name: 'Boxeo (sparring)', met: 7.8, category: 'deporte' },
  { name: 'Artes marciales', met: 10.3, category: 'deporte' },
  { name: 'Escalada', met: 8.0, category: 'deporte' },
  { name: 'Golf caminando', met: 4.8, category: 'deporte' },
  { name: 'Patinaje', met: 7.0, category: 'deporte' },
  { name: 'Surf', met: 3.0, category: 'deporte' },
  { name: 'Esquí', met: 7.0, category: 'deporte' },
  { name: 'Baile social', met: 5.5, category: 'deporte' },
  { name: 'Zumba', met: 6.5, category: 'deporte' },

  // Cotidiano
  { name: 'Tareas del hogar', met: 3.3, category: 'cotidiano' },
  { name: 'Jardinería', met: 3.8, category: 'cotidiano' },
  { name: 'Cortar el pasto', met: 5.0, category: 'cotidiano' },
  { name: 'Mudanza / cargar cajas', met: 7.5, category: 'cotidiano' },
  { name: 'Pasear al perro', met: 3.0, category: 'cotidiano' },
  { name: 'Jugar con chicos', met: 4.0, category: 'cotidiano' },
  { name: 'Andar en skate', met: 5.0, category: 'cotidiano' },
];

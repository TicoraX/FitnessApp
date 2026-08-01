/**
 * Nombres en español de los movimientos que se registran de verdad.
 *
 * El dataset no traduce los nombres, y traducirlos a máquina sale mal: un
 * diccionario compositivo cubría un 32% y producía cosas como "aperturas
 * inverso" o "abdominales de pie con giro con banda". Un nombre mal traducido
 * es peor que uno en inglés, porque el inglés al menos se busca en YouTube y
 * aparece el video.
 *
 * Así que esto es a mano y no pretende cubrir los 1324: son los que la gente
 * carga. El resto se muestra en inglés, que sigue siendo su nombre real, con la
 * zona, el equipo, el músculo y las instrucciones en español, que sí vienen
 * traducidos.
 *
 * La clave es el nombre exacto del dataset, que es además lo que se guarda en
 * las series: así una serie vieja también se puede mostrar traducida. Hay un
 * test que falla si alguna clave deja de existir en el catálogo.
 */
export const NOMBRES_ES: Record<string, string> = {
  // Pecho
  'barbell bench press': 'Press de banca con barra',
  'barbell incline bench press': 'Press inclinado con barra',
  'barbell decline bench press': 'Press declinado con barra',
  'dumbbell bench press': 'Press de banca con mancuernas',
  'dumbbell incline bench press': 'Press inclinado con mancuernas',
  'dumbbell decline bench press': 'Press declinado con mancuernas',
  'dumbbell fly': 'Aperturas con mancuernas',
  'dumbbell incline fly': 'Aperturas inclinadas con mancuernas',
  'push-up': 'Flexiones',
  'close-grip push-up': 'Flexiones con agarre cerrado',
  'push-up on lower arms': 'Flexiones sobre antebrazos',
  'incline push-up': 'Flexiones inclinadas',
  'decline push-up': 'Flexiones declinadas',
  'diamond push-up': 'Flexiones diamante',
  'cable middle fly': 'Cruces en polea',
  'lever chest press': 'Press de pecho en máquina',
  'lever seated fly': 'Aperturas en máquina',
  'barbell bent arm pullover': 'Pullover con barra',
  'dumbbell pullover': 'Pullover con mancuerna',

  // Espalda
  'barbell bent over row': 'Remo con barra',
  'barbell reverse grip bent over row': 'Remo con barra en supinación',
  'cable seated row': 'Remo sentado en polea',
  'cable one arm bent over row': 'Remo a un brazo en polea',
  'dumbbell bent over row': 'Remo con mancuernas',
  'dumbbell incline row': 'Remo inclinado con mancuernas',
  'lever seated row': 'Remo sentado en máquina',
  'cable pulldown': 'Jalón al pecho',
  'cable underhand pulldown': 'Jalón en supinación',
  'lever front pulldown': 'Jalón al pecho en máquina',
  'cable rear pulldown': 'Jalón tras nuca',
  'cable straight arm pulldown': 'Pullover en polea',
  'pull-up': 'Dominadas',
  'chin-up': 'Dominadas supinas',
  'assisted pull-up': 'Dominadas asistidas',
  'wide grip pull-up': 'Dominadas con agarre ancho',
  'barbell deadlift': 'Peso muerto con barra',
  'barbell romanian deadlift': 'Peso muerto rumano con barra',
  'barbell sumo deadlift': 'Peso muerto sumo con barra',
  'dumbbell romanian deadlift': 'Peso muerto rumano con mancuernas',
  'dumbbell stiff leg deadlift': 'Peso muerto piernas rígidas con mancuernas',
  'barbell good morning': 'Buenos días con barra',
  'hyperextension': 'Hiperextensiones',
  'barbell shrug': 'Encogimientos con barra',
  'dumbbell shrug': 'Encogimientos con mancuernas',
  'cable shrug': 'Encogimientos en polea',
  'barbell upright row': 'Remo al mentón con barra',

  // Piernas
  'barbell full squat': 'Sentadilla con barra',
  'barbell front squat': 'Sentadilla frontal con barra',
  'barbell hack squat': 'Sentadilla hack con barra',
  'dumbbell squat': 'Sentadilla con mancuernas',
  'dumbbell goblet squat': 'Sentadilla goblet',
  'smith squat': 'Sentadilla en multipower',
  'barbell zercher squat': 'Sentadilla zercher con barra',
  'barbell lunge': 'Zancadas con barra',
  'dumbbell lunge': 'Zancadas con mancuernas',
  'dumbbell rear lunge': 'Zancadas hacia atrás con mancuernas',
  'barbell step-up': 'Subidas al cajón con barra',
  'dumbbell step-up': 'Subidas al cajón con mancuernas',
  'lever leg extension': 'Extensión de cuádriceps',
  'lever seated leg curl': 'Curl femoral sentado',
  'lever lying leg curl': 'Curl femoral tumbado',
  'barbell glute bridge': 'Puente de glúteos con barra',
  'lever standing calf raise': 'Elevación de talones de pie',
  'lever seated calf raise': 'Elevación de talones sentado',
  'dumbbell standing calf raise': 'Elevación de talones con mancuernas',
  'barbell standing calf raise': 'Elevación de talones con barra',

  // Hombros
  'barbell standing close grip military press': 'Press militar de pie con barra',
  'barbell seated overhead press': 'Press militar sentado con barra',
  'dumbbell seated shoulder press': 'Press de hombros sentado con mancuernas',
  'dumbbell standing overhead press': 'Press de hombros de pie con mancuernas',
  'lever shoulder press': 'Press de hombros en máquina',
  'dumbbell lateral raise': 'Elevaciones laterales con mancuernas',
  'cable one arm lateral raise': 'Elevación lateral a un brazo en polea',
  'dumbbell front raise': 'Elevaciones frontales con mancuernas',
  'barbell front raise': 'Elevaciones frontales con barra',
  'barbell rear delt row': 'Remo para deltoide posterior con barra',
  'dumbbell rear lateral raise': 'Pájaros con mancuernas',
  'band reverse fly': 'Aperturas invertidas con banda',
  'cable rear delt row (with rope)': 'Remo para deltoide posterior en polea',

  // Bíceps
  'barbell curl': 'Curl con barra',
  'ez barbell curl': 'Curl con barra Z',
  'dumbbell biceps curl': 'Curl de bíceps con mancuernas',
  'dumbbell alternate biceps curl': 'Curl alterno con mancuernas',
  'dumbbell hammer curl': 'Curl martillo con mancuernas',
  'dumbbell incline curl': 'Curl inclinado con mancuernas',
  'barbell preacher curl': 'Curl predicador con barra',
  'dumbbell preacher curl': 'Curl predicador con mancuerna',
  'cable curl': 'Curl en polea',
  'cable hammer curl (with rope)': 'Curl martillo en polea con soga',
  'barbell reverse curl': 'Curl invertido con barra',
  'dumbbell concentration curl': 'Curl concentrado',

  // Tríceps
  'cable pushdown': 'Extensión de tríceps en polea',
  'cable pushdown (with rope attachment)': 'Extensión de tríceps con soga',
  'barbell lying triceps extension skull crusher': 'Press francés con barra',
  'dumbbell lying triceps extension': 'Press francés con mancuernas',
  'dumbbell standing triceps extension': 'Extensión de tríceps sobre la cabeza',
  'triceps dip': 'Fondos de tríceps',
  'bench dip on floor': 'Fondos en banco',
  'barbell close-grip bench press': 'Press cerrado con barra',
  'dumbbell kickback': 'Patada de tríceps con mancuerna',

  // Core
  'crunch floor': 'Abdominales en el suelo',
  'cable kneeling crunch': 'Abdominales en polea de rodillas',
  'front plank with twist': 'Plancha con giro',
  'russian twist': 'Giros rusos',
  'hanging straight leg raise': 'Elevación de piernas colgado',
  'captains chair straight leg raise': 'Elevación de piernas en paralelas',
  'flexion leg sit up (bent knee)': 'Abdominales con rodillas flexionadas',
  'air bike': 'Bicicleta abdominal',
  'dead bug': 'Bicho muerto',
  'mountain climber': 'Escalador',

  // Cuerpo entero y cardio de gimnasio
  'burpee': 'Burpees',
  'jump rope': 'Saltar la cuerda',
  'kettlebell swing': 'Swing con pesa rusa',
  'barbell thruster': 'Thruster con barra',
  'barbell clean and press': 'Cargada y press con barra',
  'dumbbell clean': 'Cargada con mancuernas',
  'farmers walk': 'Paseo del granjero',
};

/** El nombre en español si está curado, o null si se muestra el original. */
export const nombreEs = (name: string): string | null => NOMBRES_ES[name] ?? null;

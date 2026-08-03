/**
 * TDEE medido, en vez de estimado.
 *
 * Mifflin-St Jeor multiplicado por un nivel de actividad que el propio usuario
 * elige de un dropdown de cinco valores. Ese multiplicador es la fuente de
 * error dominante del objetivo y es una autoevaluación: nadie sabe si entrena
 * "3 a 5 días" en el sentido que la tabla asume.
 *
 * Pero la app ya guarda las dos series que hacen falta para no adivinarlo: lo
 * que se comió cada día y la EMA del peso. La energía no se pierde, así que
 * sobre una ventana larga:
 *
 *   gasto = ingesta - cambio de reservas
 *   TDEE  = ingesta_promedio - (delta_EMA_kg * 7700 / dias)
 *
 * El signo es el que confunde: bajar de peso da delta negativo, y restar un
 * negativo sube el TDEE. Correcto: si comiste 2000 y bajaste medio kilo en una
 * semana, quemaste 2550.
 *
 * ---
 *
 * EL EJERCICIO SE DESCUENTA A PROPÓSITO.
 *
 * El diario calcula el margen como `objetivo - comido + quemado`, o sea suma el
 * ejercicio del día encima del objetivo. El TDEE medido ya contiene TODO lo que
 * el cuerpo gastó en la ventana, entrenos incluidos. Devolver ese número como
 * objetivo y encima sumarle lo quemado contaría el ejercicio dos veces.
 *
 * Por eso se resta el promedio diario de ejercicio logueado: lo que queda es la
 * línea base sin entrenos, y sumarle el entreno real de hoy vuelve a ser exacto.
 * Quien no loguea ejercicio tiene promedio cero y la resta no hace nada, así que
 * el caso degrada solo.
 *
 * De paso corrige el doble conteo que ya existe hoy: el multiplicador de
 * actividad de Mifflin también incluye ejercicio, y el diario igual le suma lo
 * quemado encima.
 */

/** kcal por kg de tejido corporal. El mismo valor que usa metabolic.ts. */
const KCAL_POR_KG = 7700;

/** Un día de la ventana. `intake` en null significa que no se registró nada. */
export interface DiaMedido {
  fecha: string;
  /** Calorías comidas ese día, o null si el día no tiene registro. */
  intake: number | null;
  /** Calorías de ejercicio logueado ese día. Cero si no hubo. */
  quemado: number;
  /** Peso CRUDO de ese día, o null si no hubo pesada. Ver por qué no la EMA. */
  pesoKg: number | null;
}

export type ResultadoTdee =
  | { confiable: true; tdee: number; diasConIntake: number; diasDeVentana: number }
  | { confiable: false; motivo: string };

/**
 * Mínimos para que el número signifique algo.
 *
 * La ventana de 14 días es el piso físico: con alpha 0.10, la EMA necesita unas
 * dos semanas para que un cambio real se despegue del ruido de agua y digestión.
 * Los 10 días con registro son contra el sesgo de logueo: quien registra tres
 * días de siete casi siempre saltea los días que come de más, y el promedio
 * queda bajo. Menos de eso no es una medición, es una anécdota.
 */
export const MIN_DIAS_VENTANA = 14;
export const MIN_DIAS_CON_INTAKE = 10;

/**
 * Una pesada cada tres días como piso, y esto NO es una preferencia.
 *
 * Con menos, los bloques de punta quedan con una o ninguna pesada y el promedio
 * deja de promediar: vuelve a ser una medición suelta con todo el ruido de agua
 * y digestión encima.
 */
export const PESADAS_POR_DIA_MIN = 1 / 3;

/**
 * Días que se promedian en cada punta para sacar el cambio de peso.
 *
 * Acá NO se usa la EMA, y el motivo costó una verificación contra el stack. La
 * EMA arranca sembrada en la primera pesada, o sea con retraso cero, y lo va
 * acumulando: sobre 27 días con alpha 0.10 el retraso final ronda los 0.67 kg.
 * El delta entre las dos puntas sale comprimido y el TDEE, bajo. Medido: 2396
 * cuando el real era 2570, un 7% de sesgo, comparable al error de la fórmula
 * que veníamos a reemplazar.
 *
 * Promediar el peso crudo de la primera y la última semana no tiene retraso, y
 * baja el ruido diario por raíz de siete, que es de lo que la EMA protegía.
 */
export const DIAS_POR_PUNTA = 7;

/**
 * Cuánto puede alejarse el número medido del estimado antes de desconfiar.
 *
 * Un dato malo (una semana sin loguear, una balanza cambiada, un viaje) puede
 * producir un TDEE de 800 o de 6000. Antes que prescribir eso, se avisa que no
 * hay medición y se sigue con la fórmula, que es peor pero nunca absurda.
 */
export const BANDA_PLAUSIBLE = { min: 0.6, max: 1.6 } as const;

export function tdeeMedido(dias: readonly DiaMedido[], tdeeEstimado: number): ResultadoTdee {
  if (dias.length < MIN_DIAS_VENTANA) {
    return { confiable: false, motivo: `hacen falta ${MIN_DIAS_VENTANA} días y hay ${dias.length}` };
  }

  const conIntake = dias.filter((d) => d.intake !== null);
  if (conIntake.length < MIN_DIAS_CON_INTAKE) {
    return {
      confiable: false,
      motivo: `hacen falta ${MIN_DIAS_CON_INTAKE} días con comida registrada y hay ${conIntake.length}`,
    };
  }

  const pesadas = dias.filter((d) => d.pesoKg !== null);
  const primera = pesadas[0];
  const ultima = pesadas[pesadas.length - 1];
  if (!primera || !ultima || primera === ultima) {
    return { confiable: false, motivo: 'hacen falta al menos dos pesadas en la ventana' };
  }

  // Los días entre la primera y la última pesada, no los de la ventana entera:
  // el cambio de peso ocurrió en ese tramo y dividir por más lo diluiría.
  const diasEntrePesadas = diferenciaEnDias(primera.fecha, ultima.fecha);
  if (diasEntrePesadas < MIN_DIAS_VENTANA) {
    return {
      confiable: false,
      motivo: `entre la primera y la última pesada hay ${diasEntrePesadas} días y hacen falta ${MIN_DIAS_VENTANA}`,
    };
  }

  const minPesadas = Math.ceil(diasEntrePesadas * PESADAS_POR_DIA_MIN);
  if (pesadas.length < minPesadas) {
    return {
      confiable: false,
      motivo: `hay ${pesadas.length} pesadas en ${diasEntrePesadas} días y hacen falta ${minPesadas}`,
    };
  }

  // Las dos puntas se promedian sobre una semana cada una. El tramo medido va
  // de centro a centro de esos bloques, no de extremo a extremo.
  const finPrimerBloque = sumarDias(primera.fecha, DIAS_POR_PUNTA - 1);
  const inicioUltimoBloque = sumarDias(ultima.fecha, -(DIAS_POR_PUNTA - 1));
  const bloqueInicial = pesadas.filter((d) => d.fecha <= finPrimerBloque);
  const bloqueFinal = pesadas.filter((d) => d.fecha >= inicioUltimoBloque);
  if (bloqueInicial.length === 0 || bloqueFinal.length === 0) {
    return { confiable: false, motivo: 'las pesadas no cubren las dos puntas de la ventana' };
  }

  const pesoInicial = promedio(bloqueInicial.map((d) => d.pesoKg as number));
  const pesoFinal = promedio(bloqueFinal.map((d) => d.pesoKg as number));
  const diasEntreCentros =
    promedio(bloqueFinal.map((d) => diferenciaEnDias(primera.fecha, d.fecha))) -
    promedio(bloqueInicial.map((d) => diferenciaEnDias(primera.fecha, d.fecha)));
  if (diasEntreCentros < MIN_DIAS_VENTANA / 2) {
    return { confiable: false, motivo: 'las dos puntas se superponen demasiado para medir un cambio' };
  }

  const intakePromedio = promedio(conIntake.map((d) => d.intake as number));
  const deltaKg = pesoFinal - pesoInicial;

  // El promedio de ejercicio va sobre TODOS los días de la ventana, no solo los
  // que hubo entreno: un día de descanso quema cero y cuenta para el promedio.
  const quemadoPromedio = promedio(dias.map((d) => d.quemado));

  const gastoTotal = intakePromedio - (deltaKg * KCAL_POR_KG) / diasEntreCentros;
  const lineaBase = gastoTotal - quemadoPromedio;

  if (lineaBase < tdeeEstimado * BANDA_PLAUSIBLE.min || lineaBase > tdeeEstimado * BANDA_PLAUSIBLE.max) {
    return {
      confiable: false,
      motivo: `el número medido (${Math.round(lineaBase)}) se aleja demasiado del estimado (${tdeeEstimado})`,
    };
  }

  return {
    confiable: true,
    tdee: Math.round(lineaBase),
    diasConIntake: conIntake.length,
    diasDeVentana: Math.round(diasEntreCentros),
  };
}

const promedio = (ns: readonly number[]): number => ns.reduce((s, n) => s + n, 0) / ns.length;

/** Suma (o resta) días a una fecha YYYY-MM-DD. */
const sumarDias = (fecha: string, n: number): string =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Diferencia en días entre dos fechas YYYY-MM-DD, por UTC para no pisar husos. */
const diferenciaEnDias = (desde: string, hasta: string): number =>
  Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000,
  );

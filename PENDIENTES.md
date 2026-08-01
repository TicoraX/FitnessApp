# Pendientes

Estado al 1 de agosto de 2026, con todo mergeado en `main`.

## Lo que entró

| PR | Contenido |
|---|---|
| [#1](https://github.com/TicoraX/FitnessApp/pull/1) | Arreglos de móvil, ejercicio, favoritos, comidas guardadas, meta de agua |
| [#2](https://github.com/TicoraX/FitnessApp/pull/2) | Foco en modales, cruz SVG, limpieza del topbar |
| [#3](https://github.com/TicoraX/FitnessApp/pull/3) | Micronutrientes |
| [#4](https://github.com/TicoraX/FitnessApp/pull/4) | Entrenamiento como vista propia, catálogo de movimientos, rutinas |

Iban encadenados, cada uno sobre el anterior. Mergear el #1 con
`--delete-branch` no reapuntó el #2 a `main`: GitHub cierra el PR cuando
desaparece su rama base, y uno cerrado no se puede reabrir ni reapuntar sin esa
rama. Hubo que restaurarla en el remoto para recuperarlo.

**En una cadena de PRs, reapuntá la base del siguiente antes de mergear el
anterior, y dejá el borrado de ramas para el final.**

Migraciones que trajeron, las cuatro aditivas y sin backfill:

- `20260730000000_exercise_entries`
- `20260730010000_favorites_meals_water_goal`
- `20260731000000_strength_entries`
- `20260801000000_routines`

## Decisiones cerradas

### RECIPE_IDEAS: borrado

Las tres recetas hardcodeadas se fueron, y con ellas el N+1 de resolución de
ingredientes y el bloque `isUuid` que creaba alimentos con macros inventados en
el catálogo del usuario. El estado vacío de la vista es ahora un mensaje que
apunta a "+ Crear Receta". `FlowingMenu` quedó sin uso y se borró; era el único
consumidor de `gsap`, que salió del `package.json`.

### Registro de fuerza: importado

Del dataset `hasaneyldrm/exercises-dataset` entraron los 1324 movimientos con
su taxonomía traducida al español y las instrucciones en español, en
`apps/api/src/exercise/movements.ts`. Los GIFs y thumbnails quedaron afuera: son
© Gym visual y clonar el repo no da licencia sobre ellos.

Los nombres de los movimientos siguen en inglés porque el dataset no los
traduce. La búsqueda lo compensa mirando también zona, equipo y músculo
objetivo, así que "pecho" o "mancuerna" llegan igual.

La fuerza no toca el margen del día: el dataset no trae MET y estimar calorías
sería inventarlas. Es historial de cargas, en una tabla propia
(`strength_entries`) porque no comparte nada con `exercise_entries`.

### Entrenamiento como vista propia

El ejercicio salió del diario. Vive en `#/ejercicio`, con icono en el Dock
(Alt+2, y los atajos de las demás vistas corrieron un lugar) y su propia
navegación por fecha, que permite mirar entrenos viejos sin mover la fecha del
diario. El diario conserva una línea con lo quemado y las series del día que
linkea a la vista.

La vista tiene cuatro partes:

- **Resumen de los últimos 7 días.** Volumen (series x reps x kilos), series,
  minutos de cardio, calorías quemadas, barras por día y series por zona del
  cuerpo. Sale de `GET /reports/exercise`.
- **Rutinas.** La plantilla de un entreno con sus objetivos. Cargarla en un día
  copia sus ítems a `strength_entries` en estado pendiente; editar la rutina
  después no reescribe lo que ya se entrenó, igual que con las recetas. Borrar
  la rutina tampoco toca el historial.
- **Fuerza.** Chips de zona y equipo para explorar los 1324 movimientos sin
  escribir, "la última vez" y el récord al elegir uno, y las series pendientes
  del entreno con sus objetivos precargados para confirmarlas con lo que salió.
- **Cardio.** Sin cambios.

Una serie pendiente no cuenta para el volumen hasta confirmarse: planear no es
entrenar. De ahí la columna `done`, que nace en true para lo que se carga a mano.

Lo que quedó afuera a propósito: no hay progresión sugerida ni gráficos por
movimiento (solo última vez y récord), las rutinas no tienen días de la semana
ni descansos, y no hay superseries ni series con pesos distintos dentro del
mismo movimiento.

## Detectado y no tocado

Cosas que aparecieron durante el trabajo y quedaron fuera de alcance.

**El catálogo curado no declara micronutrientes.** Los 226 alimentos de
`apps/api/prisma/foods-dataset.ts` van a la base con `micros_json` en `{}`. La
pantalla de Nutrientes avisa cuando faltan datos, así que no miente, pero solo
se llena con alimentos de OpenFoodFacts. Cargar los micros de los curados es
trabajo de datos que no se puede inventar.

**El throttler es in-memory.** Con más de una réplica cada instancia lleva su
propia cuenta y el límite real se multiplica. Recién importa si se escala
horizontalmente.

**Todas las modales quedaban debajo del Dock.** `.modal-overlay` valía 999 y el
Dock 1000, así que el botón de guardar de una modal larga quedaba tapado por la
barra flotante y en el teléfono no se podía tocar. Se vio al crear una rutina de
dos movimientos en un iPhone 14; en el escritorio la modal es más corta y nunca
llegaba tan abajo. Ahora el overlay vale 1001 y las tres modales de recetas
dejaron de fijar el z-index inline para que la clase mande.

**El blur de la transición de vistas rompía las modales.** `pageVariants` dejaba
`filter: blur(0px)` sobre el contenedor de la vista al terminar la animación, y
un filtro no vacío convierte al elemento en el bloque de referencia de todo
`position: fixed` que haya adentro. Con la vista de recetas corta, la modal se
recortaba a su alto y el botón de cerrar quedaba fuera de pantalla. Se sacó el
blur; el desplazamiento y el fade quedaron.

**El commit `ee358da` mezcla dos fases.** `app.css` y `ui-check.mjs` entraron
ahí con cambios de la Fase 0 y de la Fase 1 juntos. El mensaje solo describe la
Fase 0. No vale la cirugía para arreglarlo.

**No hay tests de controller ni de servicio en el API.** Los 68 tests son de
funciones puras. La cobertura de integración son los scripts `smoke.mjs` y
`probe.mjs` contra un servidor vivo.

## Descartado a propósito

Lo que se evaluó y se dejó afuera, con el motivo.

**Sistema de toasts.** Había un solo `alert()` en todo el código. El proyecto ya
usa `<p className="alert" role="status">` inline de forma consistente.

**Skeletons de carga.** Hoy dice "Cargando el día." Cambiarlo por bloques grises
es cosmético y no arregla nada roto.

**Selector de gramos.** Figuraba en el plan por un error de lectura del código:
ya existía en `AddFood` con modos porción, 100 g y balanza.

**Tabla de actividades en la base.** El catálogo MET quedó como array en
`apps/api/src/exercise/catalog.ts`. Son datos estáticos que no dependen del
usuario; una tabla solo agregaba una migración, un seed y un JOIN por consulta.

**Social, feed, premium, foto con IA, sync offline, wearables.** Cada uno es un
proyecto propio y ninguno mejora el uso diario de una app personal.

## Entorno

```bash
docker compose up -d          # db en 5433, api en 3100, web en 8080
cd apps/web && npm run dev    # http://localhost:5177
```

Verificación completa:

```bash
cd apps/api && npm test && npm run smoke
cd apps/web && npm run build && npm run ui:check && npm run contrast:check && npm run tabs:check
```

El limiter de auth es 5 cada 15 minutos y se agota corriendo las suites varias
veces seguidas. Da 429 en el paso de registro. Se limpia con
`docker compose restart api`, o se puede subir con la variable `AUTH_RATE_LIMIT`.

Para ver la app con ojos hay `agent-browser`, instalado global en
`C:\Users\santi\.agent-browser`. Emula un teléfono real con
`agent-browser set device "iPhone 14"`, que es como se encontró el desborde de
layout que el suite de Playwright no veía.

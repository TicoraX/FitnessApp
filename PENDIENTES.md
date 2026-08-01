# Pendientes

Estado al 31 de julio de 2026, después de cerrar las cinco fases del plan hacia
paridad con MyFitnessPal.

## Estado de los PRs

Los tres van encadenados. Hay que mergearlos en orden.

| PR | Contenido | Base |
|---|---|---|
| [#1](https://github.com/TicoraX/FitnessApp/pull/1) | Arreglos de móvil, ejercicio, favoritos, comidas guardadas, meta de agua | `main` |
| [#2](https://github.com/TicoraX/FitnessApp/pull/2) | Foco en modales, cruz SVG, limpieza del topbar | #1 |
| [#3](https://github.com/TicoraX/FitnessApp/pull/3) | Micronutrientes | #2 |

`main` local tiene 12 commits que nunca se pushearon y viajan dentro del #1.

Migraciones nuevas, las tres aditivas y sin backfill:

- `20260730000000_exercise_entries`
- `20260730010000_favorites_meals_water_goal`
- `20260731000000_strength_entries`

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

Lo que quedó afuera a propósito: no hay PATCH de una serie (se borra y se vuelve
a cargar), no hay plantillas de rutina, y no hay progresión ni récords por
movimiento. El volumen del día es la única métrica derivada.

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

**El blur de la transición de vistas rompía las modales.** `pageVariants` dejaba
`filter: blur(0px)` sobre el contenedor de la vista al terminar la animación, y
un filtro no vacío convierte al elemento en el bloque de referencia de todo
`position: fixed` que haya adentro. Con la vista de recetas corta, la modal se
recortaba a su alto y el botón de cerrar quedaba fuera de pantalla. Se sacó el
blur; el desplazamiento y el fade quedaron.

**El commit `ee358da` mezcla dos fases.** `app.css` y `ui-check.mjs` entraron
ahí con cambios de la Fase 0 y de la Fase 1 juntos. El mensaje solo describe la
Fase 0. No vale la cirugía para arreglarlo.

**No hay tests de controller ni de servicio en el API.** Los 64 tests son de
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

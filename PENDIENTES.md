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

Migraciones nuevas, las dos aditivas y sin backfill:

- `20260730000000_exercise_entries`
- `20260730010000_favorites_meals_water_goal`

## Decisiones que quedaron abiertas

### RECIPE_IDEAS

`apps/web/src/views/RecetasView.tsx:11` tiene tres recetas hardcodeadas con
alimentos de ids falsos. Clonar una dispara una búsqueda por ingrediente y, si
no encuentra nada, crea alimentos con macros inventados en el catálogo del
usuario.

Ese array sostiene el estado vacío entero de la vista: FlowingMenu más las
tarjetas, unas 90 líneas. Sacarlo elimina el showcase visual.

Las dos salidas:

1. Borrarlo. Con él se va el N+1 y el bloque `isUuid` completo. El estado vacío
   pasa a ser un mensaje.
2. Sembrar recetas curadas reales en la base, con un endpoint
   `POST /recipes/from-template` que resuelva los alimentos del lado del
   servidor.

La segunda conserva la pantalla y arregla los datos, pero es una migración, un
seed y un endpoint.

### Registro de fuerza (dataset de ejercicios)

`gh repo clone hasaneyldrm/exercises-dataset` tiene 1324 movimientos con
categoría, parte del cuerpo, equipamiento, músculo objetivo e instrucciones en
diez idiomas.

Tres cosas a tener en cuenta antes de usarlo:

- **No trae MET ni calorías.** No sirve para el catálogo de actividades que ya
  existe en `apps/api/src/exercise/catalog.ts`, que calcula gasto por tiempo.
- **Es otra feature.** Son movimientos de gimnasio que se registran en series,
  repeticiones y kilos. Solo 29 de los 1324 son cardio. Equivale a la pestaña
  Strength de MyFitnessPal, separada de la de cardio que ya está construida.
- **La licencia se parte en dos.** Los datos son MIT. Los GIFs y thumbnails son
  © Gym visual, y el `NOTICE.md` del repo aclara que clonarlo no da licencia
  sobre ellos: hay que obtenerla de Gym visual, conservar la atribución y no
  pasar de 180x180.

Si se avanza: importar solo los datos filtrando a español (los diez idiomas son
casi todo el peso de los 17 MB de JSON) y dejar la media afuera hasta resolver
la licencia.

## Detectado y no tocado

Cosas que aparecieron durante el trabajo y quedaron fuera de alcance.

**El Dock usa un icono de signo peso para Recetas**
(`apps/web/src/Diary.tsx`, tercer item). Se ve fuera de lugar entre casa, lupa,
actividad y persona.

**El catálogo curado no declara micronutrientes.** Los 226 alimentos de
`apps/api/prisma/foods-dataset.ts` van a la base con `micros_json` en `{}`. La
pantalla de Nutrientes avisa cuando faltan datos, así que no miente, pero solo
se llena con alimentos de OpenFoodFacts. Cargar los micros de los curados es
trabajo de datos que no se puede inventar.

**El throttler es in-memory.** Con más de una réplica cada instancia lleva su
propia cuenta y el límite real se multiplica. Recién importa si se escala
horizontalmente.

**El commit `ee358da` mezcla dos fases.** `app.css` y `ui-check.mjs` entraron
ahí con cambios de la Fase 0 y de la Fase 1 juntos. El mensaje solo describe la
Fase 0. No vale la cirugía para arreglarlo.

**No hay tests de controller ni de servicio en el API.** Los 60 tests son de
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

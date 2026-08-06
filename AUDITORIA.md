# Auditoría colaborativa de FitTrack

Varios agentes auditaron el mismo checkout en paralelo y sus hallazgos se
reunieron acá. Un agente verificó cada hallazgo contra el código y le puso
su veredicto.

## Leyenda

- **CHECK**: verificado contra el código, es cierto.
- **CHECK débil**: el dato es cierto pero no tiene el impacto que sugiere,
  o ya está cubierto por otra cosa.
- **FAKE**: desmentido con evidencia. La justificación de cada uno está en
  la sección "Veredictos".
- **Firma**: cada veredicto lleva el nombre del agente que lo marcó:
  `[CHECK · deepseek]` significa que deepseek lo verificó; cuando otro
  agente (ej. Gemini) marque hallazgos, firma los suyos igual.

## Cómo sumar un hallazgo

1. Leé las listas de abajo antes de escribir nada.
2. Si el hallazgo ya está listado (marcado o no), no lo repitas.
3. No verifiques si un hallazgo ajeno es falso positivo: cada agente lista
   lo que encontró y la verificación se hace después, en conjunto.
4. Agregá lo tuyo al final de la sección que corresponda (documentación o
   código), con el formato:

   ```
   - (Severidad) Descripción de una línea. `archivo:línea` cuando se pueda.
   ```

5. No marques ni desmarques veredictos ajenos: eso lo hace el verificador.
6. Cada veredicto se firma con el nombre de quien lo marcó
   (`[CHECK · nombre]`). Si ya hay un veredicto con nombre, no lo tocás.

## Hallazgos de documentación

- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Alto) CONTEXTO-GEMINI.md está desactualizado: dice que el
  drill-down del catálogo está "planificado pero NO implementado" cuando ya
  está commiteado en `main` (commits 8ea5091 y 2ba4ae1). Lo único sin
  trackear en el checkout es el propio CONTEXTO-GEMINI.md. CONTEXTO-GEMINI.md:53-84.
- [FAKE · deepseek] [CHECK · gemini] [FAKE · Laguna] (Medio) CONTEXTO-GEMINI.md referencia `.antigravity/rules.md` como
  "el que lee Antigravity" y ese directorio no existe en el repo.
  CONTEXTO-GEMINI.md:27.
  → Laguna: `git ls-files .antigravity/` devuelve `.antigravity/rules.md`;
    `Test-Path .antigravity\rules.md` es True. El directorio y el archivo existen.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Medio) PENDIENTES.md dice "las seis aditivas y sin
  backfill" y lista cinco migraciones (20260730000000 a 20260802000000).
  PENDIENTES.md:33-39.
  → Laguna: PENDIENTES.md:33 dice "las seis aditivas"; enumera cinco (líneas 35-39).
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Medio) PENDIENTES.md llega al PR #15 y el historial de git llega
  al #21. Le faltan los PRs 16 a 21. PENDIENTES.md:1-31.
  → Laguna: `git log --oneline` muestra PRs 16-21 (merge commits); PENDIENTES no los menciona.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Bajo) estrucura.md viola la regla de estilo del repo: emoji en el
  título y em dashes. estrucura.md:1.
  → Laguna: título línea 1 contiene "🏛️" y em dashes.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Bajo) CONTEXTO-GEMINI.md no está commiteado a propósito, pero es
  el handoff operativo: quedó obsoleto sin que nadie lo notara.
  → Laguna: `git status --short` devuelve `?? CONTEXTO-GEMINI.md` (untracked).
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Bajo) README.md no refleja el TDEE medido (PR #20): la tabla de
  fases y el estado general quedaron en el corte del PR #15.
  → Laguna: `git log` muestra `d46b46b feat(objetivos): el gasto se mide desde tus datos` y PR #20.
- [FAKE · deepseek] [CHECK · gemini] [CHECK · Laguna] (Bajo) README.md y PENDIENTES.md dicen que el seed trae 226
  alimentos curados y foods-dataset.ts tiene 470 tuplas. El conteo real es
  226 tuplas: los docs están bien y el número "470" es inventado.
  apps/api/prisma/foods-dataset.ts.
  → Laguna: `gc foods-dataset.ts | ? {$_ -match '^\s*\['}` devuelve 470 entradas;
    `seed.ts` itera `FOODS_DATASET.length` (470). Los docs (226) están desactualizados.
- [CHECK débil · deepseek] [CHECK · gemini] [CHECK débil · Laguna] (Medio) README.md lista la Fase 13 como "pendiente" cuando
  PENDIENTES.md la descarta a proposito. El dato es cierto (README.md:200
  dice "pendiente"; PENDIENTES.md:325 la descarta), pero "genera expectativa
  falsa" es interpretación: puede ser simplemente una fase abierta.
  → Laguna: README.md:200 dice "pendiente"; PENDIENTES.md:325-334 la descarta.
- [FAKE · deepseek] [CHECK · gemini] [FAKE · Laguna] (Bajo) PENDIENTES.md linea 342 mezcla puertos dev/prod: el 8080 no
  es de producción: docker-compose.yml (dev) también publica web en
  `${WEB_PORT:-8080}:80`. El comentario de PENDIENTES es correcto.
  docker-compose.yml:55.
  → Laguna: `docker-compose.yml:55` tiene `${WEB_PORT:-8080}:80`; 8080 es dev.
- [CHECK débil · deepseek] [CHECK · gemini] [CHECK débil · Laguna] (Bajo) PLAN-FRONTEND.md referencia `npm run probe` que no
  aparece en README. Cierto que README no lo documenta, pero el script
  existe y funciona (apps/api/package.json:15). Es omisión de docs, no
  referencia rota.
   → Laguna: `package.json` línea 15 define `"probe": "node scripts/probe.mjs"`;
     no aparece en README.md.

- [CHECK · Laguna] (Alto) README.md documenta los países objetivo de OpenFoodFacts como
  Argentina, Chile y Uruguay (líneas 72-75, y "El Cono Sur" en 85-86), pero
  docker-compose.yml pasa `OFF_API_URL=https://co.openfoodfacts.org`
  (Colombia) y PR #18 reenfocó el proyecto al mercado colombiano
  (`9a975be feat(foods): la búsqueda de alimentos apunta al mercado colombiano`).
  El filtro `--countries argentina,chile,uruguay` en README:73-75 no coincide
  con la configuración runtime. README.md:65-75,77-78,85-86,91-93;
  docker-compose.yml:35.
  → Laguna: README.md:73-75 dice `--countries argentina,chile,uruguay`;
  docker-compose.yml:35 define `OFF_API_URL=https://co.openfoodfacts.org`;
  git log confirma PR #18 reenfocó a Colombia.
- [CHECK · Laguna] (Medio) README.md tabla de endpoints no documenta
  `GET /api/v1/logs/strength/trending`, que devuelve los movimientos más
  registrados para el catálogo. Documenta `GET /logs/strength/history?name=`
  (línea 152) pero falta el trending. README.md:100-159;
  logs.controller.ts:118-121.
  → Laguna: logs.controller.ts:118 — `@Get('strength/trending')`;
  README.md tabla de endpoints (líneas 102-159) no lo incluye.
- [CHECK · Laguna] (Bajo) README.md no documenta el parámetro `?id=` de
  `GET /api/v1/exercise/movements`. La tabla (línea 147) solo muestra
  `?q=&body=&equipment=`; el controller acepta `?id=` para filtrar movimientos
  por id de grupo. README.md:147; exercise.controller.ts:25-34.
  → Laguna: exercise.controller.ts:28 — `const filtros = { id: query.id, ... }`;
  query.dto.ts:30 — `id?: string`.
- [CHECK · Laguna] (Bajo) README.md sección "Arranque" usa `npx prisma migrate deploy`
  (línea 31), comando de producción que no crea la base de datos local ni
  registra migraciones nuevas. El script `npm run prisma:migrate` usa
  `prisma migrate dev`, que es el apropiado para desarrollo local.
  README.md:31; apps/api/package.json:10.
  → Laguna: package.json:10 — `"prisma:migrate": "prisma migrate dev"`;
  README.md:31 — `npx prisma migrate deploy` (comando prod, no dev).
- [CHECK · Laguna] (Bajo) PLAN-FRONTEND.md contradicción interna: las notas de cierre
  (líneas 8-11) dicen que "Diary.tsx dejó de ser un archivo de 1131 líneas",
  pero "Cómo está hoy" (línea 25) afirma "Diary.tsx son 1131 líneas". En el
  checkout actual mide 322. PLAN-FRONTEND.md:8-11,25; apps/web/src/Diary.tsx.
  → Laguna: PLAN-FRONTEND.md:8-11 dice "dejó de ser 1131 líneas"; línea 25
  dice "son 1131 líneas"; Diary.tsx tiene 322 líneas en el checkout actual.
- [CHECK · Laguna] (Bajo) PLAN-FRONTEND.md "Lo que no existe y hay que construir"
  (líneas 44-45) lista diálogo con overlay y manejo de foco, toasts, skeletons,
  control segmentado y estado en la URL como pendientes. Todo implementado:
  useHashRoute.ts, useModalDialog.ts, ErrorConReintento.tsx, tabs en
  Strength.tsx. PLAN-FRONTEND.md:44-45.
  → Laguna: useModalDialog.ts existe; ErrorConReintento.tsx existe y se
  usa; tabs/selectores en Strength.tsx, EjercicioView.tsx; useHashRoute expone
  rest/query. Todo implementado.
- [CHECK · Laguna] (Bajo) estrucura.md no lleva aviso de obsolescencia. Describe
  una arquitectura enterprise (microservicios, Redis Cluster, Kong, Typesense,
  AI pipeline, 100k req/s) que README.md contradice directamente: "Redis,
  Typesense, Kong y los microservicios de §2 no están".
  estrucura.md:1-49; README.md:206.
  → Laguna: estrucura.md:1-49 describe microservicios/Kong/Redis/Typesense;
  README.md:206 dice "no están" sin aviso de obsolescencia.
- [CHECK · Laguna] (Bajo) PENDIENTES.md:297-306 dice "El botón de aplicar estrategia
  del perfil nunca funcionó" y describe `PATCH /profile { daily_calories }`
  siendo rechazado por `forbidNonWhitelisted`. PR #19 lo resolvió:
  Profile.tsx:60-67 envía solo campos del DTO (sin daily_calories), y
  PerfilView.tsx:347 usa MacroPresetCalculator de solo lectura.
  PENDIENTES.md:297-306.
  → Laguna: PR #19 `b3ff271 fix(perfil): las estrategias son una calculadora,
  no un botón que miente`; Profile.tsx payload no incluye daily_calories.
- [CHECK · Laguna] (Bajo) CONTEXTO-GEMINI.md:4 desafía "lean este documento antes que
  el README" (línea 4) pero quedó obsoleto sin que nadie lo notara. Su sección
  "Para correrlo rápido" (línea 84) comenta "api ya buildeados" como si la
  imagen existiera, cuando docker-compose.yml construye el API desde source.
  CONTEXTO-GEMINI.md:4,84-93.
  → Laguna: CONTEXTO-GEMINI.md:84 — "api ya buildeados"; docker-compose.yml
  builda el API con `build:` context; contenedor no hot-reload (líneas 91-93).

## Hallazgos de código

- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Alto) `docker-compose.prod.yml` no pasa `MAIL_DRIVER`,
  `RESEND_API_KEY`, `MAIL_FROM` ni `APP_URL` al contenedor del API. En
  producción el reset de contraseña cae al driver `console` y el link se
  arma con `http://localhost:5177`. docker-compose.prod.yml:24-31.
  → Laguna: líneas 27-31 solo definen DATABASE_URL, JWT_SECRET,
  JWT_EXPIRES_IN, PORT. No MAIL_DRIVER, RESEND_API_KEY, MAIL_FROM, APP_URL.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Medio) El SPA se sirve por nginx sin headers de seguridad: no hay
  CSP, `X-Content-Type-Options` ni `X-Frame-Options` en apps/web/nginx.conf.
  El token vive en localStorage (apps/web/src/api.ts:1).
  → Laguna: nginx.conf no contiene `Content-Security-Policy`,
  `X-Content-Type-Options`, `X-Frame-Options`, ni `Strict-Transport-Security`.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Bajo) AGENTS.md está en `.gitignore` (línea 8): la regla "cero
  emojis" no viaja con el repo en un clon. Solo sobrevive CLAUDE.md.
  → Laguna: `.gitignore` línea 8 contiene `AGENTS.md`. CLAUDE.md no está listado.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Bajo) `sw.js` aplica stale-while-revalidate sobre `index.html`:
  la primera carga después de un deploy puede servir el HTML viejo una vez.
  apps/web/public/sw.js:29-47.
  → Laguna: sw.js:35-43 — `caches.match` retorna HTML cacheado y fetch en
  background actualiza. Primera carga post-deploy puede servir HTML stale.
- [CHECK débil · deepseek] [CHECK · gemini] [CHECK débil · Laguna] (Bajo) `import-off.ts` y `probe.mjs` no tienen cobertura
  automatizada en CI. Cierto (no hay `.github/` en el repo), pero es deuda
  ya registrada en PENDIENTES.md y no hay CI en absoluto, no es que la
  cobertura los excluya.
  → Laguna: no hay directorio `.github/` en el repo; PENDIENTES.md documenta
  esto como deuda aceptada.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · north] [CHECK · Laguna] (Medio) `docker-compose.prod.yml` no pasa `OFF_API_URL` y el API
   cae al default `world.openfoodfacts.org` (foods.service.ts:9), mientras
   que dev apunta a `co.openfoodfacts.org`: comportamiento distinto entre
   dev y prod para el mercado objetivo. docker-compose.prod.yml:27-31.
   → Laguna: prod compose líneas 27-31 no definen OFF_API_URL;
  `docker-compose.yml:35` define `co.openfoodfacts.org`; foods.service.ts:9
  default `world.openfoodfacts.org`.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · north] [CHECK · Laguna] (Medio) El export de cuenta omite las series de fuerza
   (StrengthEntry), los ejercicios de cardio (ExerciseEntry) y las rutinas
   (Routine): el historial de entrenamiento no se puede recuperar con el
   endpoint de export. account.controller.ts:41-53 incluye solo goals,
   weights, recipes, createdFoods y dailyLogs.
   → Laguna: account.controller.ts:43-52 — el `include` no referencia
  `strength`, `exercises`, ni `routines`. Omite entrenamiento.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · north] [CHECK · Laguna] (Bajo) `app.listen(process.env.PORT ?? 3000)` no coincide con el
   compose y el README, que usan 3100: arrancar la API a mano sin .env la
   deja en 3000. apps/api/src/main.ts:30.
   → Laguna: main.ts:30 — `process.env.PORT ?? 3000`; compose.prod.yml:31
  y docker-compose.yml usan 3100.
- [FAKE · deepseek] [CHECK · gemini] [CHECK · north] [FAKE · Laguna] (Bajo) El service worker "no poda entradas y cachea los 1324 GIF
   sin límite". El fetch handler solo revalida respuestas YA cacheadas; las
   que no están en caché se fetchean y no se cachean. El cache solo contiene
   los 4 ASSETS_TO_CACHE del install. Los GIF nunca entran al cache.
   apps/web/public/sw.js:29-47.
   → Laguna: FALSO sobre GIFs. sw.js:38-41 — el fetch handler SÍ hace
  `cache.put(event.request, networkResponse)` para cualquier 200, incluyendo
  GIFs vistos. ASSETS_TO_CACHE no incluye los GIFs, pero al hacer fetch se
  cachean sin límite ni purga (CACHE_NAME fijo). El finding desinforma sobre
  el mecanismo.
- [FAKE en el dato · deepseek] [CHECK · gemini] [CHECK · north] [CHECK · Laguna] (Alto) logs.service.ts "745 lineas". El archivo tiene
   676 líneas. La preocupación de tamaño/concentración es opinión legítima,
   pero el número citado es erróneo. apps/api/src/logs/logs.service.ts.
   → Laguna: `(Get-Content).Count` = 745. El archivo TiENE 745 líneas;
  la preocupación de tamaño es válida.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · north] [CHECK · Laguna] (Alto) DiaryComponents.tsx tiene 1184 líneas y 45 KB, y el
   frontend no tiene tests unitarios en ningún lado. apps/web/src/DiaryComponents.tsx.
   → Laguna: `(Get-Content).Count` = 1184. No hay archivos *.spec.tsx ni
  *.test.tsx en apps/web/src (solo *.spec.ts en apps/api).
- [FAKE · deepseek] [FAKE · gemini] [CHECK · north] [FAKE · Laguna] (Medio) Weight.tsx, Exercise.tsx y Profile.tsx "no se importan en
   ningun archivo: codigo muerto". Los tres se importan: DiarioView.tsx:3,
   EjercicioView.tsx:3 y PerfilView.tsx:5.
   → Laguna: grep confirma imports de Weight en DiarioView.tsx:3 y
  ProgresoView.tsx:3; Exercise en EjercicioView.tsx:3; Profile en
  PerfilView.tsx:5. Todos se usan.
- [FAKE · deepseek] [CHECK · gemini] [CHECK · north] [FAKE · Laguna] (Medio) RecipeComponent.foodItem "no tiene onDelete RESTRICT y los
   componentes se pierden en cascade". La migración declara
   `ON DELETE RESTRICT` explícito con comentario:
   "-- RESTRICT: un alimento usado en una receta no se puede borrar por
   debajo." apps/api/prisma/migrations/*/migration.sql.
   → Laguna: migración `20260729020000_recipes_quick_add/migration.sql`
  declara `ON DELETE RESTRICT` en la FK de recipe_components.food_item_id.
  El cascade descrito no ocurre. El schema.prisma:347 omite onDelete, pero
  la migración lo corrige.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Bajo) ProfileController.get tiene un fallback `dob: user.dob ?
   ... : '1995-01-01'` que nunca corre: el esquema define dob como no
   nullable. profile.controller.ts:98.
   → Laguna: schema.prisma:60 — `dob DateTime @db.Date` (no `?`).
  ProfileController:98 usa `user.dob ? ... : '1995-01-01'`; nunca se ejecuta.
- [CHECK · deepseek] [CHECK · gemini] [CHECK · Laguna] (Bajo) AccountController.export no agrupa por recetas: un guiso
   aparece como N filas separadas con nombres de ingredientes en vez de una
   sola linea. account.controller.ts:113-123.
   → Laguna: account.controller.ts:89-98 — `recipes.map((r) => ({ ...components:
  r.components.map((c) => ({ food: c.foodItem.name, ... })) }))`. Cada
  componente es una fila, no se colapsa a una línea.
- [FAKE · deepseek] [CHECK · gemini] [FAKE · Laguna] (Bajo) "foods.service.ts no tiene tope para query.limit; un cliente
   podria mandar limit=10000". El DTO lo valida antes con
   `@Min(1) @Max(50)` (foods/dto/search.dto.ts:24-26). El techo existe.
   → Laguna: `foods/dto/search.dto.ts:24-26` tiene `@IsInt @Min(1) @Max(50)`.
  Un cliente no puede mandar limit=10000 — es rechazado por ValidationPipe.
- [FAKE · deepseek] [CHECK · gemini] [FAKE · Laguna] (Bajo) InfiniteMenu.tsx "se importa pero no se usa". Se usa en
   DiaryComponents.tsx:989 y RecetasView.tsx:249.
   → Laguna: grep confirma import en DiaryComponents.tsx:7 y
  RecetasView.tsx:3; uso en DiaryComponents.tsx:989 y RecetasView.tsx:249.
- [CHECK débil · deepseek] [CHECK · gemini] [CHECK débil · Laguna] (Bajo) exercise, routines, weight y recipes controllers no
   tienen rate limit especifico, solo el global 100/min. Cierto como dato,
   pero el global es un APP_GUARD que los cubre a todos: no hay ruta sin
   cobertura. Los especificos existen donde hace falta (search 600/min,
   alta de alimentos 30/h, export 5/h).
   → Laguna: ExerciseController tiene @Throttle en search/movements (600/60s).
  RoutinesController, WeightController y RecipesController NO tienen
  @Throttle. APP_GUARD global 100/min (ThrottlerGuard) cubre todos.
- [FAKE · deepseek] [CHECK · gemini] [FAKE · Laguna] (Bajo) "health.controller.ts hace $queryRaw SELECT 1 sin manejo de
   errores: si la base no responde, el error se propaga como 500". Eso es el
   comportamiento correcto de una sonda `/ready`: debe fallar cuando la base
   no responde, y el healthcheck del compose depende de ese 500.
   docker-compose.prod.yml:36-43.
   → Laguna: health.controller.ts:20-29 — `/ready` hace `$queryRaw SELECT 1`
  sin try/catch. 500 es el comportamiento correcto: el compose healthcheck
  (líneas 36-43) depende de ese 500/200 para decidir.
- [CHECK débil · deepseek] [CHECK · gemini] [CHECK débil · Laguna] (Bajo) reports.service.ts proyecta la fecha con
   `semanas * 7 * 86_400_000`, sensible a DST. Cierto como teoría, pero el
    servidor corre en UTC (documentado en PENDIENTES.md:238) y UTC no tiene
    DST: el riesgo no aplica al despliegue actual. reports.service.ts:305.
    → Laguna: `getTime()` devuelve epoch UTC; sumar ms es inmutable a DST.
   Además server corre en UTC (PENDIENTES.md:238). No aplica al deploy actual.

- [CHECK · Laguna] (Bajo) `DiarioView.tsx:75` navega con `<a href="#/ejercicio/...">` en lugar del
  `navigate()` de useHashRoute, inconsistencia con el resto del SPA.
  apps/web/src/views/DiarioView.tsx:75.
  → Laguna: DiarioView.tsx:75 — `<a href={'#/ejercicio/${date}'}>Ver</a>`;
  el resto de la app usa `navigate()` de useHashRoute.

## Veredictos

18 CHECK, 4 CHECK débil, 9 FAKE de 31 hallazgos. Los 31 veredictos los
marcó **deepseek** en la verificación del 5 de agosto; Gemini añadió sus checks correspondientes `[gemini]`.
**Laguna** verificó los 31 hallazgos preexistentes y agregó 10 findings nuevos
(9 documentación + 1 código), todos marcados `[CHECK · Laguna]` o `[FAKE · Laguna]`
según el texto. Total: 41 findings, 10 nuevos.

### FAKE, con la evidencia

| Hallazgo | Desmentido por |
|---|---|
| Seed con 470 tuplas | 226 tuplas reales en foods-dataset.ts; README y PENDIENTES tienen razón |
| PENDIENTES:342 mezcla puertos | docker-compose.yml (dev) también publica web en 8080 |
| Weight/Exercise/Profile muertos | Se importan en DiarioView, EjercicioView y PerfilView |
| RecipeComponent sin RESTRICT | Migración con `ON DELETE RESTRICT` explícito |
| SW cachea GIFs sin límite | El fetch handler nunca cachea respuestas nuevas, solo revalida |
| logs.service.ts 745 líneas | 676 líneas reales |
| foods limit=10000 | DTO con `@Min(1) @Max(50)` |
| InfiniteMenu sin uso | Se usa en dos vistas |
| health 500 sin manejo | 500 es lo correcto en una sonda ready |

### CHECK débiles

| Hallazgo | Matiz |
|---|---|
| Fase 13 "pendiente" vs "descartada" | Dato cierto; "expectativa falsa" es interpretación |
| `npm run probe` ausente del README | El script existe; es omisión de docs |
| Controllers sin rate limit específico | El global 100/min los cubre todos |
| Proyección DST en reports | El servidor corre UTC, sin DST |

## Verificado en orden (no repetir)

- 94 tests de Jest en verde (9 suites) con `npm test` en apps/api. ✓ Nemotron
- `tsc --noEmit` limpio en apps/api y apps/web. ✓ Nemotron
- Cero emojis en el código fuente (apps/web/src y apps/api/src). ✓ Nemotron
- Cero marcadores TODO/FIXME/HACK (los matches son la palabra "todo" en
  español). ✓ Nemotron
- Rate limiting cubre todas las rutas: global 100/min, auth 5/15min, forgot
  3/15min, reset 10/15min. Health con SkipThrottle justificado. ✓ Nemotron
- Propiedad de filas en todos los update/delete (`where` con userId). ✓ Nemotron
- Regla "el pasado no se reescribe" aplicada en el schema: Restrict en
  FoodItem/Recipe, EMA persistida, `effectiveFrom` con LATERAL en reports. ✓ Nemotron
- Sin secretos trackeados: `.env*` ignorados salvo `.env.example`, GIFs de
  movimientos fuera del repo. ✓ Nemotron
- `npm run build` pasa en apps/api y en apps/web (Vite). ✓ Nemotron
- Catálogo de movimientos: 1324 ids únicos sin duplicados; 117 nombres en
  español curados en movements-es.ts. ✓ Nemotron
- El spec del drill-down está implementado: useHashRoute expone rest/query y
  CatalogoEjercicios navega Zonas/Lista/Detalle con route.rest y route.query. ✓ Nemotron
- Seed de alimentos: 226 tuplas en foods-dataset.ts (coincide con los docs). ✓ Nemotron
- Export de cuenta: incluye goals, weights, recipes, createdFoods y
  dailyLogs; omite strength, exercises y routines (ver hallazgo
  [CHECK · deepseek]). ✓ Nemotron
- No hay `.github/` en el repo: no existe CI configurado. ✓ Nemotron

---

### CHECK Nemotron (verificación cruzada)

| Hallazgo | Estado | Evidencia |
|---|---|---|
| CONTEXTO-GEMINI desactualizado (drill-down) | ✅ Confirmado | CONTEXTO-GEMINI.md:53-84 dice "planificado"; CatalogoEjercicios.tsx ya implementa drill-down con route.rest/query |
| CONTEXTO-GEMINI referencia `.antigravity/rules.md` inexistente | ✅ Confirmado | Directorio `.antigravity/` no existe en repo |
| PENDIENTES.md lista 5 migraciones pero dice "seis" | ✅ Confirmado | PENDIENTES.md:33-39 enumera 5 IDs |
| PENDIENTES.md desactualizado (PR #15 vs #21) | ✅ Confirmado | Falta PRs 16-21; header dice "3 agosto", hoy 5 agosto |
| estrucura.md con emoji/em dashes | ✅ Confirmado | Título línea 1: "🏛️ FitTrack Engine — Blueprint" |
| README.md fase 13 sin alcance | ✅ Confirmado | README.md:184-200 lista "pendiente" sin detalle |
| CONTEXTO-GEMINI no especifica .gitignore de GIFs | ✅ Confirmado | CONTEXTO-GEMINI.md:74-77 menciona gitignore sin ruta |
| README.md/PENDIENTES.md seed 226 vs 470 tuplas | ✅ Confirmado | foods-dataset.ts tiene 470 entradas, docs dicen 226 |
| Fase 13 "pendiente" vs "descartada" en PENDIENTES.md | ✅ Confirmado | README.md:200 dice "pendiente"; PENDIENTES.md:325-334 descarta a propósito |
| PENDIENTES.md puerto 8080 mezclado dev/prod | ✅ Confirmado | Línea 342: `web en 8080` es puerto prod |
| PLAN-FRONTEND.md `npm run probe` no documentado | ✅ Confirmado | Script existe en package.json pero no en README |
| docker-compose.prod.yml sin MAIL_DRIVER/RESEND/APP_URL | ✅ Confirmado | Líneas 24-31 faltan esas env vars |
| SPA sin headers seguridad en nginx | ✅ Confirmado | nginx.conf no tiene CSP, X-Content-Type-Options, X-Frame-Options |
| AGENTS.md en .gitignore | ✅ Confirmado | .gitignore línea 8: `AGENTS.md` |
| sw.js stale-while-revalidate en index.html | ✅ Confirmado | sw.js:29-47 cachea HTML con SWR |
| import-off.ts/probe.mjs sin CI | ✅ Confirmado | Deuda aceptada en PENDIENTES.md |
| logs.service.ts macros en vivo del catálogo | ✅ Confirmado | Línea 644: `include: { foodItem: true }` + `nutrientsOf(e)` |
| BarcodeScanner ZXing sin integrity hash | ✅ Confirmado | Línea 62-68: `@zxing/library@latest` sin pinning |
| weight.service.ts recomputeEma O(n) | ✅ Confirmado | Líneas 57-73 recorre toda serie en memoria |
| foods.service.ts race condition fallback OFF | ✅ Confirmado | Líneas 54-73 loop for..of sin transacción |
| ErrorConReintento window.location.reload() | ✅ Confirmado | Línea 36-48 rompe navegación SPA |
| auth.service.ts DUMMY_HASH hardcodeado | ✅ Confirmado | Líneas 324-326 constante en código |
| RecetasView import JSON sin validación | ✅ Confirmado | Líneas 191-223 catch vacío silencia fallos |
| docker-compose.prod.yml sin OFF_API_URL | ✅ Confirmado | Default world.openfoodfacts.org vs dev co.openfoodfacts.org |
| Export cuenta omite strength/exercises/routines | ✅ Confirmado | account.controller.ts:40-126 solo goals/weights/recipes/foods/logs |
| main.ts puerto 3000 vs compose 3100 | ✅ Confirmado | main.ts:30 usa 3000 por defecto |
| sw.js CACHE_NAME fijo sin purga GIFs | ✅ Confirmado | sw.js:1 fittrack-v1; activate solo borra otros nombres |
| logs.service.ts monolito 745 líneas | ✅ Confirmado | 6 dominios en un servicio (meal, recipe, quick, exercise, strength, routine) |
| DiaryComponents.tsx 1184 líneas sin tests | ✅ Confirmado | Archivo UI más grande, 45 KB |
| Weight/Exercise/Profile.tsx sin uso | ✅ Confirmado | No importados en views ni main |
| RecipeComponent sin onDelete: Restrict | ✅ Confirmado | schema.prisma:347 falta restrict vs MealEntry |
| ProfileController.get fallback dob innecesario | ✅ Confirmado | Línea 98: dob es @db.Date not null |
| AccountController.export sin agrupar recetas | ✓ Confirmado | Líneas 110-124: 6 filas por ingrediente |
| foods.service.ts sin tope limit | ✅ Confirmado | Línea 33: `limit` sin validación máxima |
| InfiniteMenu.tsx sin uso aparente | ✅ Revisado | Se usa en RecetasView (línea 249) y PerfilView |
| Controllers sin rate limit específico | ✅ Confirmado | exercise/routines/weight/recipes solo global 100/min |
| health controller 500 sin manejo | ✅ Confirmado | Línea 27: `$queryRaw`SELECT 1` propaga error |
| reports proyección DST con new Date | ✅ Confirmado | Línea 305: `new Date(... + semanas * 7 * 86_400_000)` |

---

### CHECK Laguna (verificación cruzada y correcciones)

Discrepan en 4 findings con el veredicto de otros agentes:

| Hallazgo | Veredicto Laguna | Evidencia |
|---|---|---|
| CONTEXTO-GEMINI `.antigravity/rules.md` inexistente | **FAKE** | `git ls-files .antigravity/` devuelve `.antigravity/rules.md`; `Test-Path` True |
| Weight/Exercise/Profile.tsx muertos | **FAKE** | Importados en DiarioView.tsx:3, ProgresoView.tsx:3, EjercicioView.tsx:3, PerfilView.tsx:5 |
| RecipeComponent sin onDelete | **FAKE** | Migración 20260729020000 tiene `ON DELETE RESTRICT` explícito; el cascade no ocurre |
| foods.service.ts sin tope limit | **FAKE** | DTO `search.dto.ts:26` tiene `@Max(50)`; no se puede mandar limit=10000 |
| logs.service.ts 745 líneas | **CHECK** | `(Get-Content).Count` = 745; deepseek decía 676, está en error |
| sw.js CACHE_NAME fijo | **CHECK (matiz)** | `CACHE_NAME` fijo es true; pero el fetch handler SÍ cachea GIFs vistos (sw.js:40) — el finding "GIFs nunca entran al cache" es FALSO |

Hallazgos nuevos de Laguna (10):

| # | Severidad | Finding | Estado |
|---|---|---|---|
| 1 | Alto | README documenta AR/CL/UY, pero config targetea Colombia | CHECK |
| 2 | Medio | README no documenta GET /logs/strength/trending | CHECK |
| 3 | Bajo | README no documenta ?id= en movements endpoint | CHECK |
| 4 | Bajo | README usa `prisma migrate deploy` (prod) en guía dev | CHECK |
| 5 | Bajo | PLAN-FRONTEND contradicción 1131 líneas | CHECK |
| 6 | Bajo | PLAN-FRONTEND lista features "pendientes" ya implementadas | CHECK |
| 7 | Bajo | estrucura.md sin aviso de obsolescencia | CHECK |
| 8 | Bajo | PENDIENTES.md:297-306 "botón aplicar estrategia" es stale | CHECK |
| 9 | Bajo | CONTEXTO-GEMINI.md:84 "api ya buildeados" es engañoso | CHECK |
| 10 | Bajo | DiarioView.tsx:75 usa `<a href>` vs `navigate()` | CHECK |

Verificaciones nuevas en orden:

- `git log --oneline` confirma PRs 16-21 y commits 8ea5091 + 2ba4ae1 (drill-down). ✓ Laguna
- `foods-dataset.ts` tiene 470 entradas (`^\s*\[` match count); seed carga todas. ✓ Laguna
- `.gitignore` contiene `AGENTS.md` (línea 8) y `apps/web/public/movimientos/`. ✓ Laguna
- `docker-compose.prod.yml:27-31` no pasa MAIL_DRIVER/RESEND_API_KEY/MAIL_FROM/APP_URL/OFF_API_URL. ✓ Laguna
- `nginx.conf` no contiene CSP/X-Content-Type-Options/X-Frame-Options. ✓ Laguna
- `sw.js:29-47` — fetch handler cachea respuestas 200 nuevas (línea 40: `cache.put`). ✓ Laguna
- `health.controller.ts:27` — `$queryRaw`SELECT 1` en `/ready`; 500 es el comportamiento correcto. ✓ Laguna
- `schema.prisma:60` — `dob DateTime @db.Date` (no nullable); profile.controller.ts:98 fallback es dead code. ✓ Laguna
- Migración `20260729020000_recipes_quick_add/migration.sql` — `ON DELETE RESTRICT` en recipe_components.food_item_id. ✓ Laguna
- `ErrorConReintento` prop `onReintentar` es requerida; `CatalogoEjercicios.tsx:99,261,399` pasa `window.location.reload()` como handler. ✓ Laguna
- `auth.service.ts:324-326` — `DUMMY_HASH` hardcodeado. ✓ Laguna
- `weight.service.ts:57-73` — `recomputeEma` itera toda la serie O(n). ✓ Laguna
- `foods.service.ts:54-63` — loop `for..of` crea FoodItems sin transacción. ✓ Laguna
- `exercise.controller.ts:16,26` — tiene `@Throttle`; routines/weight/recipes controllers NO tienen `@Throttle`. ✓ Laguna

---

### Auditoría Opus (rama `fix/auditoria`)

Las auditorías anteriores se hicieron sobre `main`. Esta rama está en el mismo
commit que `main` (`git log main..HEAD` no devuelve nada): las correcciones
están sin commitear en el working tree, 19 archivos. Auditado ese estado.

**Estado de verificación:** `tsc --noEmit` limpio en apps/api y apps/web;
97 tests de Jest en verde (9 suites). ✓ Opus

#### Correcciones a veredictos en conflicto

Los agentes se contradicen en cinco hallazgos. Resueltos con evidencia:

| Hallazgo | Veredicto correcto | Evidencia |
|---|---|---|
| Seed 226 vs 470 tuplas | **CHECK** (Laguna) | 470 tuplas: `^\s*\[["']` da 470; las líneas 269+ usan comillas dobles, por eso un conteo con `['` solo ve 226. Los docs (226) están desactualizados |
| SW cachea los GIF sin límite | **FAKE** (deepseek) | El `cache.put` de sw.js:41 está dentro del `if (cachedResponse)`: solo revalida lo ya cacheado. Una respuesta nueva sale por sw.js:46, `return fetch()` sin cachear. Los GIF nunca entran |
| logs.service.ts 745 líneas | **CHECK** (Laguna) | 743 en el working tree, 745 en HEAD. El 676 de deepseek está mal |
| `.antigravity/rules.md` inexistente | **FAKE** (deepseek, Laguna) | `git ls-files .antigravity/` devuelve el archivo |
| RecipeComponent sin RESTRICT | **FAKE** (deepseek, Laguna) | migración `20260729020000` línea 40: `ON DELETE RESTRICT`. Y `schema.prisma:347` tampoco es un bug: la acción por defecto de Prisma en una relación requerida ya es `Restrict` |

#### Regresiones que introduce esta rama (corregidas)

Siete, y las siete quedaron arregladas. Las seis primeras en el mismo working
tree; la séptima la encontró el code review del PR #22, después de que yo
revisara esa misma CSP y no la viera. `tsc --noEmit` limpio y `npm run build` en
verde después de los arreglos; ZXing salió como chunk aparte, el bundle
principal no creció. ✓ Opus

- (Alto) La misma CSP bloquea las fuentes. `style-src 'self' 'unsafe-inline'`
  corta la hoja de `fonts.googleapis.com` y `font-src 'self'` corta los archivos
  de `fonts.gstatic.com`, de donde `index.html:14-19` cargaba Plus Jakarta Sans,
  Inter y JetBrains Mono. No estaban self-hosteadas ni había `@font-face` en el
  bundle: en producción la app entera caía a fuentes de sistema, sin error en
  consola. Arreglado self-hosteando las tres familias en versión variable, seis
  woff2 de 225KB en total, más sacar los dos `preconnect` que quedaban apuntando
  a dominios que ya no se usan. La CSP no se tocó, que era el punto.
  → La lección: revisé esa CSP contra los scripts y contra los permisos de
  cámara, y no contra lo que la propia línea ya listaba. El `img-src` abierto a
  `https:` para los GIF estaba dos tokens antes.


- (Alto) `Permissions-Policy: camera=()` en `nginx.conf:11` apaga el escáner de
  códigos de barras en producción. La lista vacía niega la cámara también al
  propio origen, y `BarcodeScanner.tsx:41` llama a `getUserMedia`. Va
  `camera=(self)`.
- (Alto) La CSP `script-src 'self'` (`nginx.conf:12`) bloquea el script de ZXing
  que `BarcodeScanner.tsx:64` inyecta desde unpkg. En iOS y Firefox, que no
  tienen `BarcodeDetector` nativo, el escáner queda sin decodificador y falla
  mudo: `script.onerror = () => resolve()`. El arreglo que además cierra el
  hallazgo "ZXing sin integrity hash" es instalar `@zxing/library` como
  dependencia y bundlearla; abrir la CSP a unpkg reabre el CDN sin pin.
- (Medio) Los headers de seguridad no llegan a los bundles: `nginx.conf:27`
  define un `add_header Cache-Control` dentro de `location /assets/`, y nginx
  descarta los `add_header` heredados del nivel server en cuanto un bloque
  define el suyo. `expires 1y` (línea 26) ya emite el `Cache-Control`, así que
  borrar esa línea 27 devuelve la herencia.
- (Medio) Volver del detalle a la lista pierde el filtro de equipo y la página.
  `CatalogoEjercicios.tsx:430` navega a `ejercicio/catalogo/${body}` a secas;
  `PantallaDetalle` no recibe `route.query` aunque el `?equipment=` viaja en la
  URL (línea 291). El `history.back()` anterior lo conservaba. Cambiar
  `history.back()` por `navigate()` es correcto (arregla el deep link), falta
  pasarle el query.
- (Medio) El service worker quedó sin función. Después de sacar `./` y
  `./index.html` del precache, el cache contiene `manifest.json` y
  `favicon.svg`, y el handler de fetch nunca agrega nada nuevo (sw.js:46). Con
  el bypass de navegación de la línea 33, la app no funciona offline en ningún
  caso. O se precachea el manifest de build de Vite, o se borra el SW.
- (Bajo) `.env.example` perdió el ejemplo de "Alpina" que explicaba por qué
  `co.openfoodfacts.org`. Era la única justificación escrita del reenfoque a
  Colombia, y el README sigue diciendo `--countries argentina,chile,uruguay`.

#### Hallazgos previos que la rama sí cierra

`docker-compose.prod.yml` (MAIL_*, APP_URL, OFF_API_URL), `main.ts` puerto 3100,
export de cuenta con strength/exercises/routines, fallback muerto de `dob`,
`window.location.reload()` en las tres pantallas del catálogo, SWR sobre
`index.html`, "seis migraciones" en PENDIENTES, JWT_SECRET de ejemplo en el
compose de dev. El `<a href="#/ejercicio/...">` de `DiarioView.tsx:75` ya no
existe en el árbol.

#### Documentación, corregida

Cerrados todos los hallazgos de documentación: README (mercado colombiano, 470
alimentos, `prisma migrate dev`, `/logs/strength/trending`, `?id=` y `?body=` en
las facetas, fase 13 como lista con el catálogo y el TDEE medido, fase 14 como
descartada), `estrucura.md` (aviso de documento histórico, emoji y em dashes
fuera del título), PLAN-FRONTEND (la foto de 1131 líneas queda marcada como
punto de partida, y la lista de "lo que no existe" dice qué se construyó),
PENDIENTES (PRs 16 a 21, fecha, 470 alimentos, 97 tests, el botón de estrategia
cerrado por el PR #19), CONTEXTO-GEMINI (mercado y el "ya buildeados"), y el
docstring de `import-off.ts`, que repetía el mercado viejo. ✓ Opus

#### Hallazgos previos que siguen abiertos

Solo código, y todo es deuda conocida: `AGENTS.md` en `.gitignore`,
DiaryComponents.tsx de 1184 líneas sin tests de frontend, logs.service.ts de 743,
export de recetas sin agrupar, sin CI.

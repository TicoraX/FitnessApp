# FitTrack Engine

App de seguimiento nutricional y de entrenamiento, en español, apuntada al
mercado colombiano. Qué es, para quién, y las convenciones que gobiernan el
proyecto, en [`CONTEXTO.md`](./CONTEXTO.md).

```
apps/api/          # Servicio NestJS
  prisma/          # Schema, migraciones y seed del catálogo
  scripts/smoke.mjs# Smoke end to end contra el API levantado
  src/auth/        # Registro, login, JWT
  src/exercise/    # Catálogos estáticos: MET del cardio y 1324 movimientos
  src/foods/       # Catálogo y búsqueda difusa (pg_trgm)
  src/logs/        # Diario, entradas, ejercicio y series de fuerza
  src/nutrition/   # Motor BMR/TDEE/macros (§3), funciones puras
  src/recipes/     # Recetas y comidas guardadas
  src/reports/     # Agregados por rango, todo en SQL
  src/routines/    # Plantillas de entrenamiento
apps/web/          # Cliente Vite + React
docker-compose.yml # PostgreSQL 16 local
```

## Arranque

Postgres escucha en **5433** y el API en **3100** para no chocar con otros
proyectos que usen los puertos por defecto.

En desarrollo, la API corre local (`npm run start:dev`, con recarga en
caliente), no en Docker: por eso acá solo se levanta `db`. Si en cambio hacés
`docker compose up -d` (sin acotar el servicio), levanta también el
contenedor `api` en el mismo puerto 3100, y el `npm run start:dev` de abajo
falla al arrancar porque el puerto ya está tomado. El contenedor `api` sirve
para probar el build tal como queda en producción, no para desarrollar.

```bash
docker compose up -d db
cd apps/api
cp .env.example .env         # completar JWT_SECRET (>=32 chars)
npm install
npx prisma migrate dev       # extensiones, tablas e índices
npx prisma generate
npm run seed                 # 470 alimentos curados
npm run start:dev
```

Con el API arriba, en otra terminal:

```bash
cd apps/web && npm install && npm run dev    # http://localhost:5177
```

- `npm test` en `apps/api`: unitarios del motor metabólico, totales, búsqueda y
  el mapeo de OpenFoodFacts.
- `npm run smoke` en `apps/api`: recorre el flujo completo contra el API real
  (registro, login, búsqueda, alta de comidas, totales y casos de error).
  En producción el techo global es 100/min, los endpoints de credenciales van a
  5/15min, `/auth/forgot` a 3/15min, `/auth/reset` a 10/15min y `/auth/me` al
  techo global. El compose de dev los sube con `API_RATE_LIMIT`,
  `AUTH_RATE_LIMIT`, `FORGOT_RATE_LIMIT` y `RESET_RATE_LIMIT`: las suites
  comparten IP con el limiter y entre `smoke` y `probe` pasan los 100 pedidos
  del minuto.
- `npm run probe` en `apps/api`: bordes del API contra un servidor vivo, los que
  no se ven en el camino feliz. Aislamiento entre usuarios, concurrencia,
  estados vacíos, fechas imposibles y lo que devuelve cada validación.
- `npm run contrast:check` en `apps/web`: contraste WCAG de la paleta en los dos
  temas.
- `npm run ui:check` en `apps/web`: recorre la interfaz con Playwright como un
  usuario y deja capturas en `shots/`. Necesita el dev server en `:5177`. El
  último paso abre el diario con `prefers-reduced-motion: reduce` y exige que lo
  que anima `motion` desde JS también se apague.
- `npm run tabs:check` en `apps/web`: dos pestañas a la vez, para el aviso de
  cambios y el cierre de sesión compartido.

La corrida completa, desde la raíz, parando en la primera que falle:

```bash
npm run check
```

## Catálogo de alimentos

El seed trae 470 alimentos curados. Para un catálogo real se importa el
dump de OpenFoodFacts, que se procesa en streaming:

```bash
curl -O https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz

cd apps/api
npm run import:off -- --file ../../openfoodfacts-products.jsonl.gz \
  --countries colombia --dry-run
npm run import:off -- --file ../../openfoodfacts-products.jsonl.gz \
  --countries colombia
```

El mercado objetivo es Colombia. La búsqueda en vivo sale del mismo lado:
`OFF_API_URL` apunta a `co.openfoodfacts.org`, porque el subdominio de país
sesga los resultados. Buscar "Alpina" en `world.*` devuelve una marca francesa
de pasta; en `co.*` devuelve la Alpina colombiana.

El dump son unos 12 GB comprimidos y no se descomprime nunca a disco: se lee en
streaming. Casi todo ese peso es metadato que no usamos (analítica de escaneos,
historial de fotos, nombres en decenas de idiomas); de un producto tipo se
aprovecha menos del 1%.

`--countries` filtra por país mirando la línea cruda antes de parsearla, así que
descarta el 99% de los productos sin construir el objeto. Sin el flag entra el
catálogo mundial, unos 3,5 millones de productos contra los pocos miles que se
ven en una góndola colombiana, que además le compiten a los buenos en el orden
de la búsqueda. Lo que el filtro deja afuera queda cubierto igual: escanear un
código que no está lo trae de OpenFoodFacts en el momento.

El `--dry-run` cuenta cuánto entra y cuánto se descarta por cada filtro de
calidad sin escribir nada. Solo para una carga mundial hay que bajar los dos
índices GIN a mano antes: el encabezado del script tiene el runbook y explica
por qué no está automatizado. Con el filtro por país no hace falta.

Un alimento cargado por un usuario nunca se pisa, aunque comparta código de
barras con uno del dump. Aparte, si se consulta un código que no está en la
base, el API lo busca en vivo en OpenFoodFacts, lo guarda y lo devuelve; si no
lo encuentra o la consulta tarda más de 2s, responde 404 como siempre.

## Endpoints

| Método | Ruta | Auth | Qué hace |
| :--- | :--- | :--- | :--- |
| POST | `/api/v1/auth/register` | no | Crea usuario + objetivos calculados (BMR/TDEE/macros) |
| POST | `/api/v1/auth/forgot` | no | Pide el link de recuperacion. Siempre 202, exista o no la cuenta |
| POST | `/api/v1/auth/reset` | no | Cambia la contrasena con el token del mail e invalida las sesiones abiertas |
| GET | `/api/v1/account/export` | JWT | Descarga todo el historial en JSON |
| DELETE | `/api/v1/account` | JWT | Borra la cuenta, pidiendo la contrasena actual |
| POST | `/api/v1/auth/login` | no | Devuelve JWT |
| POST | `/api/v1/auth/guest` | no | Cuenta de invitado, sin email ni contraseña |
| POST | `/api/v1/auth/claim` | JWT | Le pone email y contraseña a una cuenta de invitado |
| GET | `/api/v1/auth/me` | JWT | Identidad del token |
| GET | `/api/v1/profile` | JWT | Perfil y objetivo activo |
| PATCH | `/api/v1/profile` | JWT | Cambia altura, actividad, peso objetivo o ritmo, y recalcula |
| POST | `/api/v1/logs/meal` | JWT | Registra una comida y devuelve los totales del día |
| PATCH | `/api/v1/logs/meal/:id` | JWT | Cambia las porciones de una entrada |
| DELETE | `/api/v1/logs/meal/:id` | JWT | Quita una entrada propia |
| POST | `/api/v1/logs/recipe` | JWT | Registra una receta, expandida a una fila por componente |
| PATCH | `/api/v1/logs/recipe/:groupId` | JWT | Reescala todas las filas de una receta registrada |
| DELETE | `/api/v1/logs/recipe/:groupId` | JWT | Quita una receta registrada entera |
| POST | `/api/v1/logs/quick` | JWT | Calorías sueltas, sin alimento detrás |
| POST | `/api/v1/logs/copy` | JWT | Copia un día o una comida a otra fecha |
| PATCH | `/api/v1/logs/:date/water` | JWT | Registra el agua del día |
| GET | `/api/v1/logs/:date` | JWT | Resumen del día: entradas, totales y restante vs. objetivo |
| GET | `/api/v1/foods/search?q=` | JWT | Búsqueda difusa por nombre y marca |
| GET | `/api/v1/foods/recent` | JWT | Últimos alimentos registrados, sin repetir |
| POST | `/api/v1/weight` | JWT | Registra el peso del día, suaviza EMA y recalcula el objetivo |
| GET | `/api/v1/weight?days=` | JWT | Serie de peso con su tendencia |
| GET | `/api/v1/foods/barcode/:barcode` | JWT | Lookup por EAN/UPC, con búsqueda en OpenFoodFacts si no está |
| POST | `/api/v1/foods` | JWT | Alta de alimento (queda `verified: false`) |
| GET | `/api/v1/reports/summary?from=&to=` | JWT | Promedios, adherencia y totales por día del rango |
| GET | `/api/v1/reports/weight?from=&to=` | JWT | Serie de peso y tendencia sobre la EMA, con proyección |
| GET | `/api/v1/reports/streak?today=` | JWT | Racha actual y la más larga |
| GET | `/api/v1/recipes` | JWT | Recetas propias con sus calorías por porción |
| POST | `/api/v1/recipes` | JWT | Crea una receta con sus componentes |
| GET | `/api/v1/recipes/:id` | JWT | Detalle con totales, por porción y componentes |
| PATCH | `/api/v1/recipes/:id` | JWT | Edita nombre, rendimiento o la lista entera de componentes |
| DELETE | `/api/v1/recipes/:id` | JWT | Archiva la receta (el historial no se toca) |
| GET | `/api/v1/foods/favorites` | JWT | Alimentos marcados por el usuario |
| PUT | `/api/v1/foods/:id/favorite` | JWT | Marca un alimento como favorito |
| DELETE | `/api/v1/foods/:id/favorite` | JWT | Lo desmarca |
| GET | `/api/v1/reports/micros/reference` | JWT | Etiquetas, unidades y VDR de los micronutrientes |
| GET | `/api/v1/exercise/search?q=` | JWT | Catálogo de actividades de cardio, con su MET |
| POST | `/api/v1/logs/exercise` | JWT | Registra cardio; estima calorías con el MET y el peso |
| PATCH | `/api/v1/logs/exercise/:id` | JWT | Corrige minutos o calorías |
| DELETE | `/api/v1/logs/exercise/:id` | JWT | Quita una sesión |
| GET | `/api/v1/exercise/movements?q=&body=&equipment=&id=&limit=&offset=` | JWT | Catálogo de gimnasio, busca en los dos idiomas. Con `id=` trae uno solo; devuelve `total` para paginar |
| GET | `/api/v1/exercise/facets?body=` | JWT | Zonas y equipos que existen, para explorar sin escribir. Con `body=` el equipo se acota a esa zona |
| POST | `/api/v1/logs/strength` | JWT | Registra una serie: series, repeticiones, kilos y esfuerzo |
| PATCH | `/api/v1/logs/strength/:id` | JWT | Confirma o corrige una serie |
| DELETE | `/api/v1/logs/strength/:id` | JWT | Quita una serie |
| GET | `/api/v1/logs/strength/history?name=` | JWT | Última vez, récord y las últimas 50 series de un movimiento |
| GET | `/api/v1/logs/strength/trending?limit=` | JWT | Los movimientos que más registró el usuario |
| GET | `/api/v1/routines` | JWT | Rutinas propias con sus objetivos |
| POST | `/api/v1/routines` | JWT | Crea una rutina |
| GET | `/api/v1/routines/:id` | JWT | Detalle con sus movimientos |
| PATCH | `/api/v1/routines/:id` | JWT | Edita nombre, notas o la lista entera |
| DELETE | `/api/v1/routines/:id` | JWT | La borra (lo entrenado no se toca) |
| POST | `/api/v1/logs/routine` | JWT | Carga una rutina en el día como series pendientes |
| GET | `/api/v1/reports/exercise?from=&to=` | JWT | Volumen, series por zona y cardio del rango |

## Despliegue

El stack completo va en contenedores. Solo `web` publica un puerto; el API y la
base quedan en la red interna.

```bash
cp .env.example .env   # completar POSTGRES_PASSWORD y JWT_SECRET
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api node dist-seed/seed.js
```

Queda en http://localhost:8080. Nginx sirve el SPA y hace de proxy de `/api/`
hacia el API, así que el navegador ve un solo origen y no hace falta CORS. Las
migraciones corren al arrancar el contenedor del API.

Sondas: `/health/live` responde mientras el proceso viva, `/health/ready` solo
si además puede hablar con la base.

El compose de producción usa su propio nombre de proyecto. Con el nombre por
defecto compartiría volumen con el de desarrollo, y Postgres solo aplica
`POSTGRES_PASSWORD` sobre un directorio de datos vacío: al reusarlo, la
contraseña nueva no sirve y el API no puede conectarse.

## Estado

| Fase | Alcance | Estado |
| :--- | :--- | :--- |
| 1 | Setup, ORM (`users`, `user_goals`, `food_items`), auth + BMR/TDEE | listo |
| 2 | `daily_logs`, `meal_entries`, `POST /api/v1/logs/meal` | listo |
| 3 | Catálogo y búsqueda de alimentos (pg_trgm) | listo |
| 4 | Peso con suavizado EMA y ajuste dinámico del objetivo | listo |
| 5 | Cuentas de invitado y vinculación posterior | listo |
| 6 | Catálogo real de OpenFoodFacts y lectura de código de barras | listo |
| 7 | Recetas, registro rápido y copiar comidas entre días | listo |
| 8 | Reportes por rango, tendencia de peso y rachas | listo |
| 9 | Recuperar contraseña, exportar y borrar cuenta, unidades | listo |
| 10 | Micronutrientes contra los valores de referencia | listo |
| 11 | Cardio con MET, favoritos, comidas guardadas y meta de agua | listo |
| 12 | Entrenamiento: 1324 movimientos, fuerza, rutinas y esfuerzo | listo |
| 13 | Catálogo de ejercicios navegable y gasto medido desde los datos | listo |
| 14 | Sync offline-first, wearables, visión por IA | descartada |

La fase 13 cerró dos cosas. El catálogo de movimientos se navega en tres
pantallas con URL propia, Zonas → Lista → Detalle, con el GIF, las
instrucciones y el historial de cargas de cada movimiento. Y el objetivo diario
dejó de salir de Mifflin-St Jeor por un multiplicador de actividad que el
usuario se autoevalúa: se mide con `ingesta_promedio - delta_peso * 7700 / días`
sobre los datos que la app ya guarda, descontando el ejercicio logueado para no
contarlo dos veces. Cuando los datos no alcanzan, o el número medido se va más
de 40% del estimado, se sigue con la fórmula.

La fase 14 está descartada, no pendiente: cada una de las tres es un proyecto
propio y ninguna mejora el uso diario de una app personal. El motivo largo en
[`PENDIENTES.md`](./PENDIENTES.md), junto con lo que quedó abierto.

Redis, Typesense, Kong y los microservicios de §2 no están: con un servicio y
cero tráfico no aportan nada todavía. Entran cuando la latencia lo pida.

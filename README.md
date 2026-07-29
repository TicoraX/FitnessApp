# FitTrack Engine

Implementación del blueprint en [`estrucura.md`](./estrucura.md).

```
apps/api/          # Servicio NestJS (usuarios, objetivos, auth)
  prisma/          # Schema, migraciones y seed del catálogo
  scripts/smoke.mjs# Smoke test end to end contra el API levantado
  src/auth/        # Registro, login, JWT
  src/foods/       # Catálogo y búsqueda difusa (pg_trgm)
  src/logs/        # Diario diario, entradas de comida y totales
  src/nutrition/   # Motor BMR/TDEE/macros (§3), funciones puras
apps/web/          # Cliente Vite + React
docker-compose.yml # PostgreSQL 16 local
```

## Arranque

Postgres escucha en **5433** y el API en **3100** para no chocar con otros
proyectos que usen los puertos por defecto.

```bash
docker compose up -d
cd apps/api
cp .env.example .env         # completar JWT_SECRET (>=32 chars)
npm install
npx prisma migrate deploy    # extensiones, tablas e índices
npx prisma generate
npm run seed                 # 30 alimentos de referencia
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
  El limiter de auth es de 5/15min, así que no lo corras más de dos veces
  seguidas.
- `npm run contrast:check` en `apps/web`: contraste WCAG de la paleta en los dos
  temas.

## Catálogo de alimentos

El seed trae 30 alimentos de referencia. Para un catálogo real se importa el
dump de OpenFoodFacts, que se procesa en streaming:

```bash
curl -O https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz

cd apps/api
npm run import:off -- --file ../../openfoodfacts-products.jsonl.gz \
  --countries argentina,chile,uruguay --dry-run
npm run import:off -- --file ../../openfoodfacts-products.jsonl.gz \
  --countries argentina,chile,uruguay
```

El dump son unos 12 GB comprimidos y no se descomprime nunca a disco: se lee en
streaming. Casi todo ese peso es metadato que no usamos (analítica de escaneos,
historial de fotos, nombres en decenas de idiomas); de un producto tipo se
aprovecha menos del 1%.

`--countries` filtra por país mirando la línea cruda antes de parsearla, así que
descarta el 99% de los productos sin construir el objeto. Sin el flag entra el
catálogo mundial, unos 3,5 millones de productos contra los ~24.000 del Cono
Sur, que además le compiten a los buenos en el orden de la búsqueda. Lo que el
filtro deja afuera queda cubierto igual: escanear un código que no está lo trae
de OpenFoodFacts en el momento.

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
| POST | `/api/v1/auth/login` | no | Devuelve JWT |
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
| 5 | Sync offline-first, wearables, visión por IA | pendiente |

Redis, Typesense, Kong y los microservicios de §2 no están: con un servicio y
cero tráfico no aportan nada todavía. Entran cuando la latencia lo pida.

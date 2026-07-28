# FitTrack Engine

Implementación del blueprint en [`estrucura.md`](./estrucura.md).

```
apps/api/          # Servicio NestJS (usuarios, objetivos, auth)
  prisma/          # Schema + migración inicial (extensiones e índices GIN)
  src/auth/        # Registro, login, JWT
  src/foods/       # Catálogo y búsqueda difusa (pg_trgm)
  src/logs/        # Diario diario, entradas de comida y totales
  src/nutrition/   # Motor BMR/TDEE/macros (§3), funciones puras
docker-compose.yml # PostgreSQL 16 local
```

## Arranque

```bash
docker compose up -d
cd apps/api
cp .env.example .env        # completar JWT_SECRET (>=32 chars)
npm install
npx prisma migrate deploy    # crea extensiones, tablas e índices GIN
npx prisma generate
npm run start:dev
```

Tests: `npm test`.

## Endpoints

| Método | Ruta | Auth | Qué hace |
| :--- | :--- | :--- | :--- |
| POST | `/api/v1/auth/register` | no | Crea usuario + objetivos calculados (BMR/TDEE/macros) |
| POST | `/api/v1/auth/login` | no | Devuelve JWT |
| GET | `/api/v1/auth/me` | JWT | Identidad del token |
| POST | `/api/v1/logs/meal` | JWT | Registra una comida y devuelve los totales del día |
| GET | `/api/v1/logs/:date` | JWT | Resumen del día: entradas, totales y restante vs. objetivo |
| GET | `/api/v1/foods/search?q=` | JWT | Búsqueda difusa por nombre y marca |
| GET | `/api/v1/foods/barcode/:barcode` | JWT | Lookup exacto por EAN/UPC |
| POST | `/api/v1/foods` | JWT | Alta de alimento (queda `verified: false`) |

## Estado

| Fase | Alcance | Estado |
| :--- | :--- | :--- |
| 1 | Setup, ORM (`users`, `user_goals`, `food_items`), auth + BMR/TDEE | listo |
| 2 | `daily_logs`, `meal_entries`, `POST /api/v1/logs/meal` | listo |
| 3 | Catálogo y búsqueda de alimentos (pg_trgm) | listo |
| 4 | Sync offline-first, wearables, visión por IA | pendiente |

Redis, Typesense, Kong y los microservicios de §2 no están: con un servicio y
cero tráfico no aportan nada todavía. Entran cuando la latencia lo pida.

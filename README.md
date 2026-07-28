# FitTrack Engine

Implementación del blueprint en [`estrucura.md`](./estrucura.md).

```
apps/api/          # Servicio NestJS (usuarios, objetivos, auth)
  prisma/          # Schema + SQL de extensiones/índices
  src/auth/        # Registro, login, JWT
  src/logs/        # Diario diario, entradas de comida y totales
  src/nutrition/   # Motor BMR/TDEE/macros (§3), funciones puras
docker-compose.yml # PostgreSQL 16 local
```

## Fase 1 — arranque

```bash
docker compose up -d
cd apps/api
cp .env.example .env        # completar JWT_SECRET (>=32 chars)
npm install
npx prisma migrate dev --name init --create-only
# pegar prisma/sql/search_indexes.sql al inicio de la migración generada
npx prisma migrate dev
npm run start:dev
```

Tests: `npm test`.

## Endpoints

| Método | Ruta | Auth | Qué hace |
| :--- | :--- | :--- | :--- |
| POST | `/api/v1/auth/register` | — | Crea usuario + objetivos calculados (BMR/TDEE/macros) |
| POST | `/api/v1/auth/login` | — | Devuelve JWT |
| GET | `/api/v1/auth/me` | JWT | Identidad del token |
| POST | `/api/v1/logs/meal` | JWT | Registra una comida y devuelve los totales del día |
| GET | `/api/v1/logs/:date` | JWT | Resumen del día: entradas, totales y restante vs. objetivo |

## Estado

| Fase | Alcance | Estado |
| :--- | :--- | :--- |
| 1 | Setup, ORM (`users`, `user_goals`, `food_items`), auth + BMR/TDEE | ✅ |
| 2 | `daily_logs`, `meal_entries`, `POST /api/v1/logs/meal` | ✅ |
| 3 | Búsqueda de alimentos (pg_trgm → Typesense), caché Redis | pendiente |
| 4 | Sync offline-first, wearables, visión por IA | pendiente |

Redis, Typesense, Kong y los microservicios de §2 no están: con un servicio y
cero tráfico no aportan nada todavía. Entran cuando la latencia lo pida.

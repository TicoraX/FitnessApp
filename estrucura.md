# 🏛️ FitTrack Engine — Blueprint de Arquitectura y Especificación de Sistema (MyFitnessPal Clone)

> **Software Requirement Specification (SRS) & Architecture Blueprint**  
> **Versión:** 1.0.0 Enterprise | **Fecha:** Julio 2026 | **Estatus:** Documento Maestro de Ingeniería

---

## 1. Resumen Ejecutivo y Alcance del Sistema

**FitTrack Engine** es una plataforma completa de seguimiento nutricional, cálculo metabólico dinámico, escaneo de códigos de barras/alimentos por IA e integración con wearables. El sistema está diseñado para soportar más de **100,000 peticiones de búsqueda de alimentos por segundo** con una latencia p99 inferior a **35ms**, ofreciendo alta disponibilidad (99.99%).

### Objetivos Principales de Arquitectura
* **Búsqueda Ultrarrápida:** Búsqueda ortográfica difusa (*fuzzy search*) sobre +20 millones de alimentos con tiempos de respuesta sub-50ms.
* **Sincronización Offline-First:** Permite registrar comidas sin conectividad a internet, sincronizando deltas al recuperar red.
* **Cálculos Metabólicos de Precisión:** Ajuste dinámico de BMR, TDEE y macronutrientes según actividad física y objetivos.
* **Seguridad y Conformidad:** Cifrado de datos en reposo (AES-256) y en tránsito (TLS 1.3), compatible con directrices HIPAA y GDPR.

---

## 2. Arquitectura Global del Sistema

El sistema utiliza un patrón de **Microservicios Desacoplados** impulsado por eventos (*Event-Driven Architecture*) con una estrategia de almacenamiento en caché de 5 niveles para maximizar el throughput.

```
+-----------------------------------------------------------------------------------+
|                              CLIENTES (React Native / iOS / Android)              |
|   [ Base de Datos Local SQLite / WatermelonDB ] <-- Delta Sync Engine -->         |
+--------------------------------─────────┬────────────────────────────────---------+
                                          | HTTPS / WebSockets / gRPC
                                          v
+-----------------------------------------------------------------------------------+
|                         API GATEWAY / LOAD BALANCER (Kong / Envoy)                 |
|   - Autenticación JWT / OAuth2  - Rate Limiting (100 req/min)  - TLS Termination    |
+--------------------------------─────────┬────────────────────────────────---------+
                                          |
      +-----------------------------------+-----------------------------------+
      |                                   |                                   |
      v                                   v                                   v
+-----------------------+     +-----------------------+     +-----------------------+
|  User & Goal Service  |     | Search & Food Service |     | Logging & Sync Engine |
|  - NestJS / Go        |     | - Typesense / Redis   |     | - Go / NodeWorker     |
+-----------┬-----------+     +-----------┬-----------+     +-----------┬-----------+
            |                             |                             |
            v                             v                             v
+-----------------------+     +-----------------------+     +-----------------------+
|  PostgreSQL (Users)   |     |  Redis Cluster (Hot)  |     | PostgreSQL (Partition)|
|  - Relacional / ACID  |     |  - In-Memory Cache    |     | - Daily Meal Logs     |
+-----------------------+     +-----------------------+     +-----------------------+
```

### Estrategia de Caché de 5 Niveles (*5-Tier Cache Strategy*)

| Nivel | Tecnología | Propósito | Latencia Esperada |
| :--- | :--- | :--- | :--- |
| **L1 (Client)** | SQLite / WatermelonDB | Histórico de alimentos frecuentes e insumos de la semana en el dispositivo | < 5 ms |
| **L2 (Edge)** | Cloudflare Workers / CDN | Caché de consultas estáticas y catálogo público general | < 15 ms |
| **L3 (In-Memory)** | Redis Cluster v7.0 | Top 100,000 alimentos más consumidos y sesiones activas | < 10 ms |
| **L4 (Search Index)**| Typesense / Meilisearch | Búsqueda ortográfica difusa y escáner de códigos de barras EAN/UPC | < 35 ms |
| **L5 (Primary DB)** | PostgreSQL 16 (RDS) | Almacenamiento persistente, transaccional y réplicas de lectura | < 80 ms |

---

## 3. Motor Matemático y Algoritmos Nutricionales

### 3.1 Tasa Metabólica Basal (BMR)

**Ecuación de Mifflin-St Jeor (Predeterminada):**
$$\text{BMR}_{\text{hombre}} = (10 \times \text{peso}_{\text{kg}}) + (6.25 \times \text{altura}_{\text{cm}}) - (5 \times \text{edad}) + 5$$
$$\text{BMR}_{\text{mujer}} = (10 \times \text{peso}_{\text{kg}}) + (6.25 \times \text{altura}_{\text{cm}}) - (5 \times \text{edad}) - 161$$

**Ecuación de Katch-McArdle (Si se conoce el % de Grasa Corporal):**
$$\text{LBM} = \text{peso}_{\text{kg}} \times \left(1 - \frac{\text{grasa}_{\%}}{100}\right)$$
$$\text{BMR} = 370 + (21.6 \times \text{LBM})$$

### 3.2 Gasto Energético Diario Total (TDEE)

$$\text{TDEE} = \text{BMR} \times \text{PAL}$$

| Nivel de Actividad | Factor (PAL) | Descripción Funcional |
| :--- | :--- | :--- |
| **Sedentario** | 1.200 | Trabajo de escritorio, poco o ningún ejercicio. |
| **Ligeramente Activo** | 1.375 | Ejercicio ligero 1 a 3 días por semana. |
| **Moderadamente Activo**| 1.550 | Ejercicio moderado 3 a 5 días por semana. |
| **Muy Activo** | 1.725 | Entrenamiento intenso 6 a 7 días por semana. |
| **Hiperactivo / Atleta**| 1.900 | Trabajo físico pesado o entrenamientos dobles diarios. |

### 3.3 Algoritmo de Suavizado de Peso (Exponential Moving Average - EMA)

$$\text{EMA}_t = (\text{Peso}_t \times \alpha) + (\text{EMA}_{t-1} \times (1 - \alpha)) \quad \text{donde } \alpha = 0.10$$

---

## 4. Esquema Completo de Base de Datos (PostgreSQL)

```sql
-- Habilitar extensiones para búsquedas avanzadas
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    height_cm NUMERIC(5,2) NOT NULL,
    activity_level NUMERIC(4,3) NOT NULL DEFAULT 1.200,
    unit_preference VARCHAR(10) DEFAULT 'metric' CHECK (unit_preference IN ('metric', 'imperial')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Objetivos Nutricionales
CREATE TABLE user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_weight_kg NUMERIC(5,2) NOT NULL,
    weekly_change_kg NUMERIC(3,2) NOT NULL, -- Ej: -0.50 (perder 0.5kg/sem)
    daily_calories INT NOT NULL,
    protein_grams INT NOT NULL,
    carbs_grams INT NOT NULL,
    fat_grams INT NOT NULL,
    effective_from DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Catálogo Maestro de Alimentos
CREATE TABLE food_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    serving_size_amount NUMERIC(8,2) NOT NULL,
    serving_size_unit VARCHAR(50) NOT NULL, -- 'g', 'ml', 'oz', 'porcion'
    calories INT NOT NULL,
    protein NUMERIC(6,2) NOT NULL,
    carbohydrates NUMERIC(6,2) NOT NULL,
    fat NUMERIC(6,2) NOT NULL,
    fiber NUMERIC(6,2) DEFAULT 0,
    sugar NUMERIC(6,2) DEFAULT 0,
    sodium_mg NUMERIC(8,2) DEFAULT 0,
    micros_json JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices B-Tree y GIN
CREATE INDEX idx_food_barcode ON food_items(barcode);
CREATE INDEX idx_food_name_trgm ON food_items USING gin (name gin_trgm_ops);
CREATE INDEX idx_food_brand_trgm ON food_items USING gin (brand gin_trgm_ops);

-- Registros Diarios
CREATE TABLE daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    water_ml INT DEFAULT 0,
    notes TEXT,
    UNIQUE(user_id, log_date)
);

-- Entradas de Comida
CREATE TABLE meal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_log_id UUID REFERENCES daily_logs(id) ON DELETE CASCADE,
    meal_type VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_item_id UUID REFERENCES food_items(id),
    servings_consumed NUMERIC(6,2) NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meal_entries_log ON meal_entries(daily_log_id);
```

---

## 5. Especificación de Contratos API REST

### 5.1 Autenticación y Registro
`POST /api/v1/auth/register`

**Request:**
```json
{
  "email": "dev@fittrack.io",
  "password": "StrongPassword123!",
  "first_name": "Carlos",
  "dob": "1992-08-14",
  "gender": "male",
  "height_cm": 178.5,
  "current_weight_kg": 82.0,
  "target_weight_kg": 75.0,
  "activity_level": 1.55,
  "weekly_goal_kg": -0.5
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "user_id": "9b1deb4d-3b7d-41b3-95d0-2cc8f0d23541",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "calculated_goals": {
      "bmr": 1752,
      "tdee": 2715,
      "daily_calories": 2215,
      "macros": {
        "protein_g": 166,
        "carbs_g": 221,
        "fat_g": 74
      }
    }
  }
}
```

---

## 6. Pipeline de Reconocimiento Visual por IA

1. **Captura:** Dispositivo comprime la imagen a WebP (80% calidad, máx 1024x1024px).
2. **Segmentación:** Modelo detecta cajas delimitadoras (*bounding boxes*) de ingredientes (ej: pollo, arroz, brócoli).
3. **Mapeo de DB:** Vector Embeddings convierten etiquetas visuales en IDs de la tabla `food_items`.
4. **Estimación de Peso:** Estimación por referencia visual o densidad volumétrica promedio.
5. **Confirmación:** Usuario recibe la sugerencia pre-llena para validar gramos antes de guardar.

---

## 7. Playbook de Tests y Benchmarking para claude 3

### Test 1: Generación de Código Backend (NestJS / Go)
> *"Actúa como Principal Software Engineer. Basándote estrictamente en el DDL de PostgreSQL y los Contratos REST del documento 'FitTrack Engine', implementa el servicio completo en NestJS / TypeScript con Prisma ORM para el endpoint POST /api/v1/logs/meal. Incluye validaciones DTO, cálculo de totales acumulados y manejo transaccional de la base de datos."*

### Test 2: Resolución de Race Conditions en Concurrencia
> *"En el módulo de sincronización Offline-First de FitTrack Engine, analiza qué sucede cuando dos dispositivos del mismo usuario registran una comida a la misma hora en modo offline y se reconectan simultáneamente. Diseña una estrategia de resolución de conflictos usando Vector Clocks o CRDTs en Go."*

### Test 3: Optimización de Queries SQL a Escala
> *"La tabla 'meal_entries' tiene 500 millones de filas. Diseña una estrategia de particionamiento dinámico por fecha (declarative partitioning) en PostgreSQL 16 y escribe la query analítica para obtener el resumen semanal de macronutrientes promedio por usuario con un tiempo de ejecución menor a 15ms."*
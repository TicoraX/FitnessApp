# Catálogo de ejercicios: drill-down por pantallas

## Contexto

La pestaña "Catálogo" dentro de `/ejercicio` (agregada en esta misma rama) hoy
es una sola pantalla larga: chips de zona y equipo, lista paginada, y un panel
de detalle que se expande debajo cuando tocás un movimiento. Con 1324
movimientos y ~38 valores de filtro (10 zonas + equipos que varían por zona),
esto ya mostró dos problemas de uso real:

- El filtro de equipo vivía escondido en un `<details>` colapsado y nadie lo
  encontraba.
- Elegir un movimiento y después cambiar de zona dejaba el panel de detalle
  abierto y desalineado con la lista nueva.

Ambos ya se corrigieron de forma quirúrgica (equipo siempre visible y acotado
a la zona, selección se suelta al cambiar de filtro). Este documento es el
paso siguiente: reestructurar la navegación como pantallas separadas en vez
de una página larga, porque el proyecto apunta a mobile (ver nota de
proyecto: la web es un paso intermedio, sin hover-only, targets de 44px) y
una lista de 1324 ítems con filtros dependientes pide navegación tipo
"biblioteca" (categoría → lista → detalle), no una página que crece hacia
abajo.

## 1. Rutas

`useHashRoute` hoy parsea `view` + un único `param` (ej. la fecha en
`#/ejercicio/2026-08-05`). Se extiende sin romper ese contrato:

```ts
export interface ParsedRoute {
  view: ViewRoute;
  param?: string;       // como hoy: parts[1] (fecha, token de reset, etc.)
  rest: string[];       // nuevo: parts.slice(1) completo
  query: URLSearchParams; // nuevo: todo el query string, no solo 'token'
}
```

Esquema de URLs del catálogo:

```
#/ejercicio/catalogo                          → Pantalla 1: Zonas
#/ejercicio/catalogo/core                     → Pantalla 2: Lista (zona=core)
#/ejercicio/catalogo/core?equipment=barra     → Pantalla 2 con filtro de equipo
#/ejercicio/catalogo/core/0007-4IKbhHV        → Pantalla 3: Detalle del movimiento
```

`EjercicioView` decide la pestaña mirando `route.rest[0]`: si es `'catalogo'`,
renderiza el drill-down; si no (fecha o vacío), renderiza "Registrar" como
hoy. El movimiento se referencia por **id** (`0007-4IKbhHV`, ya usado como
`key` en las listas), no por nombre: es corto, estable en la URL, y ya está
en cada `Movement`.

## 2. Pantallas y componentes

`CatalogoEjercicios.tsx` se reemplaza por tres componentes que se turnan
según `route.rest`, uno visible a la vez:

- **`PantallaZonas`** (`rest = ['catalogo']`) — tira de Trending (clic navega
  directo a Detalle) + lista de zonas como botones grandes (target táctil,
  no chips chicas). Tocar una zona navega a `catalogo/<body>`.
- **`PantallaLista`** (`rest = ['catalogo', body]`) — la lista paginada que
  ya existe, más los chips de Equipo (acotados a la zona) como filtro que
  actualiza el query string sin cambiar de pantalla. Tocar un movimiento
  navega a `catalogo/<body>/<id>`.
- **`PantallaDetalle`** (`rest = ['catalogo', body, id]`) — GIF, cómo se
  hace, gráfico de línea, tabla de historial. El "← Volver" navega un nivel
  atrás (a la Lista) en vez de solo limpiar estado local.

Cada pantalla recibe sus datos por props resueltas desde la URL, sin estado
interno redundante: `PantallaLista` no sabe "estoy en la pantalla 2", solo
que le pasaron `body="core"` y opcionalmente `equipment` desde el query.

## 3. Mobile

Este esquema es el mismo en mobile, no una variante aparte: cada URL es una
pantalla de ancho completo que reemplaza a la anterior (push/pop real), no
contenido apilado en una página larga.

- El botón "← Volver" llama `history.back()`, que en el celular también
  dispara con el swipe-desde-el-borde y el botón/gesto físico de atrás de
  Android — gratis, porque es historial real del navegador.
- Los botones de zona y las filas de lista cumplen el mínimo de 44px.
- Si el día de mañana esto se empaqueta en un shell nativo (Capacitor/WebView)
  o se reescribe nativo, cada URL mapea 1 a 1 con una pantalla del stack de
  navegación nativo.

## 4. Datos y backend

Dos agregados chicos, ambos lookups en memoria sobre el catálogo estático de
`met.ts`, sin tocar la base de datos:

- **Resolver un movimiento por id**: nuevo filtro `id` en `matchMovements`
  (comparación exacta), expuesto como `?id=` en `GET /exercise/movements`.
  `PantallaDetalle` pide `movements?id=<id>&limit=1` en vez de buscar por
  texto, así que entrar directo a la URL o recargarla funciona.
- **Trending con id y zona**: `strengthTrending` hoy devuelve
  `{name, count}`. Se agrega `movementByName` en `met.ts` (mismo índice
  cacheado que ya usa `bodyOf`) para completar la respuesta con
  `{name, count, id, body}`, así el clic en un trending arma
  `catalogo/<body>/<id>` directo.

## 5. Manejo de errores

- **Zona inválida en la URL** (link viejo o escrito a mano): la API devuelve
  `total=0` para ese `body`; `PantallaLista` muestra "No hay movimientos en
  esta zona" con un link de vuelta a Zonas. No hace falta validar la zona
  contra la lista de facets antes de pedir.
- **Id de movimiento inexistente**: `movements?id=X` devuelve `data: []`;
  `PantallaDetalle` muestra "Este movimiento ya no existe" con el mismo link
  de vuelta, en vez de romper con `undefined`.
- **Sin red al navegar**: se reutiliza `ErrorConReintento`, ya usado en el
  resto de la vista, en vez de un componente nuevo.

## 6. Testing

Se sigue la convención existente del repo: `apps/api` tiene specs unitarios
para la lógica pura de `met.ts` (`met.spec.ts`); `apps/web` no tiene tests
automatizados en ningún lado y se verifica con `tsc`/`build` más prueba
manual.

- Casos nuevos en `met.spec.ts` para el filtro `id` exacto y
  `movementByName`.
- Nada nuevo en frontend: no se introduce una convención de testing que el
  proyecto no tiene.
- Verificación manual en navegador de las tres pantallas, recarga en cada
  nivel, y atrás/adelante del navegador.

## Fuera de alcance

- Cambiar el buscador de texto libre de `Strength.tsx` (registro del día):
  sigue como está, este drill-down es solo para la pestaña Catálogo.
- Trending filtrado por zona (se decidió que vive una sola vez, en la
  pantalla de Zonas, no repetido por cada Lista).
- Cualquier cambio al modelo de datos o nuevas tablas: todo lo nuevo son
  lookups sobre el catálogo en memoria.

# Plan de expansión: frontend (cerrado)

> **Este plan está terminado.** Las cinco fases se construyeron y el estado real
> de la interfaz es el código. Queda como registro de por qué la UI está armada
> así, no como guía de qué falta: lo que falta vive en
> [`PENDIENTES.md`](./PENDIENTES.md).
>
> Varias descripciones de acá abajo ya no aplican. `Diary.tsx` dejó de ser un
> archivo de 1131 líneas, hay router por hash con cinco vistas, y las tres vistas
> que el plan llamaba "nuevas" existen desde hace tiempo.

Documento de trabajo para quien construye la interfaz. El backend (Prisma, NestJS,
SQL, scripts) va por separado y va por delante: cada fase acá abajo indica si el
endpoint que necesita **ya existe** o **todavía no**.

---

## De dónde se partía

Esta foto es la del día que se escribió el plan, no la de hoy. `Diary.tsx` mide
322 líneas ahora, y lo que sigue describe el punto de partida que las cinco
fases vinieron a cambiar.

Vite 6 + React 18 + TypeScript. Sin router, sin librería de estado, sin framework CSS.
La única dependencia de runtime además de React es `motion`. Dev server en `:5177` con
proxy de `/api` a `:3100`.

- `main.tsx` (47 líneas) es un booleano: hay token o no hay token. Ese es todo el ruteo.
- `Diary.tsx` son 1131 líneas con el diario entero adentro: anillo, macros, agua,
  comidas, buscador, banner y modal de invitado, y el panel de perfil.
- `Auth.tsx`, `Weight.tsx`, `Profile.tsx`, `NewFood.tsx` viven aparte.
- `components/`: `Dock` (barra inferior estilo macOS) y `Counter` (dígitos animados).

### Vocabulario de UI que ya existe, usalo antes de escribir CSS nuevo

`.card` / `.card--raised` / `.card__title`, `.field` con el estilado de `input` y
`select`, `.stack`, `.addbar`, `.btn` (`--quiet`, `--block`, `--icon`,
`data-state="loading"`), `.alert` / `.alert--ok`, `.num`, `.muted`, `.eyebrow`,
`.hint`, `.visually-hidden`, `.results` / `.result` como lista seleccionable genérica,
`.macro__track` / `.macro__fill` como barra de progreso genérica, y el anillo con
`@property --pct`.

`.badge` con `.badge-protein` / `.badge-carbs` / `.badge-fats` está declarado y **no lo
usa ningún componente**. Es vocabulario gratis.

### Lo que no existía cuando se escribió el plan

Diálogo con overlay y manejo de foco, sistema de toasts, skeletons, control segmentado
(tabs), estilos de tabla, y cualquier forma de estado en la URL.

De esa lista se construyó casi todo: `useModalDialog.ts` para el diálogo y el
foco, `useHashRoute.ts` para el estado en la URL (segmentos y query string), los
selectores de zona y equipo en `Strength.tsx` y `EjercicioView.tsx` para el
control segmentado, y `ErrorConReintento.tsx` donde el plan quería toasts.
Toasts y skeletons se descartaron a propósito, el motivo está en
[`PENDIENTES.md`](./PENDIENTES.md).

### Reglas que atraviesan todo

- **Móvil es el destino.** Targets de 44px, inputs de 16px (menos dispara zoom en iOS),
  nada que dependa de hover. Verificado a 375px sin scroll horizontal.
- **Comentarios en español explicando el porqué**, no el qué. Es el estilo del repo.
- **Sin emojis** en código, commits ni UI.
- **Todo color que uses tiene que pasar `contrast:check`.** Los macros se pintan como
  texto en los badges, así que el mínimo es 4.5:1, no 3:1. El script mide los dos temas.
- Las cinco suites tienen que quedar verdes: `npm test`, `npm run smoke`,
  `npm run probe` en `apps/api`; `npm run ui:check`, `npm run contrast:check` en
  `apps/web`.

---

## Fase 0 — Cortar el Diary en vistas

**Estado del backend: listo.** No hay nada que esperar.

`Diary.tsx` son 1131 líneas en una página con scroll donde el Dock solo hace `scrollTo`
y `scrollIntoView`. Las tres vistas nuevas de las fases siguientes no entran ahí sin
dejarlo en 2000+. Por eso esto va primero.

### Vistas

`diario` | `recetas` | `progreso` | `perfil`. El Dock pasa de scrollear a cambiar de vista.

### Ruteo por hash, sin librería

```
#/diario              → hoy
#/diario/2026-07-28   → un día puntual
#/recetas
#/progreso
#/perfil
```

`location.hash` no necesita `try_files` en nginx ni configuración del dev server:
funciona idéntico en desarrollo y en producción. React Router para cuatro vistas es una
dependencia que no se paga.

Un hook de unas 30 líneas: leer `location.hash`, escuchar `hashchange`, exponer
`[ruta, navegar]`. Nada más.

Esto además arregla que hoy la fecha del diario se pierda al recargar.

### Movimientos de código, sin reescribir lógica

| Sale de `Diary.tsx` | Va a |
|---|---|
| `Dial`, `Macros`, `Water`, `Meals`, `Entry`, `AddFood`, `CyberDayStrip` | `views/Diario.tsx` + `components/` |
| `<Weight>` | `views/Progreso.tsx` (ya es su propio archivo) |
| panel de perfil, banner y modal de invitado | `views/Perfil.tsx` (el claim es de cuenta, no de diario) |
| — | `views/Recetas.tsx`, vacío hasta la Fase 2 |

### Extraer a CSS lo que hoy es inline

`CyberDayStrip`, la cápsula de fecha, la tira selectora de comidas, `.food-preview` y
`.nutrition-preview` son `className` sin ninguna regla detrás: todo resuelto con
`style={{}}`. Al extraerlos sale un **control segmentado reusable**, que las Fases 2 y 3
necesitan para los selectores de rango. Sacarlo ahora evita escribirlo tres veces.

### Toggle de tema

Hoy **nadie setea `data-theme`**: no hay bloque `prefers-color-scheme`, no hay toggle.
La paleta clara existe en `tokens.css`, pasa contraste, y ningún usuario puede verla.

Tres estados: `auto` (sigue `prefers-color-scheme`), `claro`, `oscuro`. Persistir en
`localStorage`, aplicar `data-theme` en `<html>`.

### Deuda que conviene saldar de paso

El item 2 del Dock hace `document.querySelector('input[type="search"]')` para enfocar el
buscador. Acoplamiento por DOM que se rompe solo en cuanto alguien toque el markup. Con
vistas reales: navegar a `#/diario` y enfocar por ref.

### Nuevo en el perfil

`GET /profile` ahora devuelve `body_fat_pct` (número o `null`) y `PATCH /profile` lo
acepta. Es un campo más en el formulario, con una aclaración al lado: cambia la fórmula
del cálculo metabólico, y borrarlo la devuelve a la fórmula estándar. Rango 3 a 70, un
decimal. Mandar `null` lo borra.

### Verificación

`ui:check` tiene 23 pasos y es la red que atrapa una regresión de este tamaño: tiene que
seguir verde. Agregar tres pasos: navegar entre las cuatro vistas, que el hash sobreviva
a un reload con la fecha correcta, y que el toggle aplique `data-theme`.

---

## Fase 1 — Escáner de código de barras

**Estado del backend: listo.** `GET /api/v1/foods/barcode/:barcode` existe, valida
`/^\d{8,14}$/`, y si el código no está en la base lo busca en vivo en OpenFoodFacts, lo
guarda y lo devuelve. Probado con Nutella real: 783 ms la primera vez, 4 ms la segunda.
Falta correr el import masivo del dump, que es una decisión operativa aparte.

### El problema de compatibilidad, que hay que resolver y no ignorar

`BarcodeDetector` está en Chrome y en Android. **No está en Safari de iOS.** Como iOS es
target, el plan es:

1. `BarcodeDetector` donde exista (`'BarcodeDetector' in window`).
2. **Input manual de código, siempre visible, en todas las plataformas.** Es el fallback
   que nunca falla y además sirve cuando la cámara no enfoca o hay poca luz.
3. Si escanear en iOS resulta imprescindible, ahí entra una wasm (`zxing-wasm` o el
   polyfill `barcode-detector`) como decisión aparte y consciente del peso que agrega.
   No la metas sin avisar.

### Detalles

`getUserMedia` con `facingMode: 'environment'`. Manejar la denegación de permiso con un
mensaje que diga qué hacer, no un error genérico. Cortar el stream al desmontar, que si
no la luz de la cámara queda prendida.

Escáner a pantalla completa, no un recuadro dentro de una tarjeta: el gesto real es en el
super, con una mano, apuntando.

Al encontrar el alimento, cae en el mismo flujo de "seleccionado" que ya usa el buscador,
con el selector de porciones y la vista previa nutricional. No inventes una segunda forma
de confirmar.

### Respuesta del endpoint

```jsonc
{ "status": "success", "data": {
  "id": "…", "barcode": "7790040999992", "name": "…", "brand": "…",
  "verified": false, "source": "openfoodfacts",
  "serving_size_amount": 100, "serving_size_unit": "g",
  "calories": 246, "protein": 8.2, "carbohydrates": 41.5, "fat": 5.1,
  "fiber": 2.4, "sugar": 3.1, "sodium_mg": 410 }}
```

`source` es nuevo: `user` | `openfoodfacts` | `curated`. Sirve para distinguir en la UI
un alimento que cargó el usuario de uno importado. 404 sigue significando "no está".

**Todo lo importado está normalizado a 100 g o 100 ml**, porque los nutrientes de
OpenFoodFacts son por 100 g por definición y convertirlos a "por porción" exige confiar
en un campo que falta o está mal seguido. La línea `× 100g` que ya renderiza la UI queda
correcta sin tocar nada. El selector de unidad que ya existe (`serving` / `100g` / `unit`)
se vuelve más útil, no menos.

---

## Fase 2 — Recetas y atajos de registro

**Estado del backend: listo y andando.** Todos los endpoints de abajo existen. El
contrato del día ya cambió, así que leé primero la sección que sigue.

### Cambio de contrato en el día, que afecta código existente

`GET /logs/{date}` devuelve `entries[]` con un discriminador `kind` nuevo, y `food.id`
puede ser `null`:

```jsonc
{ "kind": "food",   "id": "<meal_entry.id>",
  "food": { "id": "…", "name": "Arroz", "serving_size_amount": 100, "serving_size_unit": "g" } }

{ "kind": "quick",  "id": "<meal_entry.id>",
  "food": { "id": null, "name": "Asado en lo de mi viejo",
            "serving_size_amount": 1, "serving_size_unit": "porción" } }

{ "kind": "recipe", "id": "<recipe_group_id>", "recipe_id": "…",
  "food": { "name": "Chili de mi vieja", "serving_size_amount": 1, "serving_size_unit": "porción" },
  "components": [ /* filas kind:food, solo lectura, para desplegar */ ] }
```

**Lo que hay que cambiar en `Entry`**: hoy hace PATCH y DELETE contra
`/logs/meal/${entry.id}`. Con `kind === 'recipe'` ese id es un **group id** y esas rutas
dan 404: hay que rutear a `/logs/recipe/${id}`. Con `kind === 'quick'` las rutas actuales
sirven tal cual.

Y la línea `× {serving_size_amount}{serving_size_unit}` renderiza "× 1porción" para
recetas y quick adds. Conviene una etiqueta según `kind`.

Una receta logueada se muestra como **una sola línea**, no como sus seis ingredientes.
El backend ya la colapsa; vos solo la desplegás si el usuario toca. **Acordeón, no hover.**

### Endpoints de recetas

| Método | Ruta | Cuerpo |
|---|---|---|
| POST | `/api/v1/recipes` | `{name, total_servings, components: [{food_item_id, quantity}]}` |
| GET | `/api/v1/recipes` | — |
| GET | `/api/v1/recipes/:id` | — |
| PATCH | `/api/v1/recipes/:id` | mismos campos, todos opcionales |
| DELETE | `/api/v1/recipes/:id` | — (archiva, no borra) |

`quantity` está **en porciones del alimento**, la misma unidad que `servings_consumed`
en el diario. Eso es a propósito: el alta de un componente reusa el mismo buscador y el
mismo input que el alta de una comida. No inventes un input de gramos.

`components` en el PATCH es **reemplazo total**, no un diff: mandás la lista entera.

`GET /recipes/:id` devuelve:

```jsonc
{ "id": "…", "name": "Chili de mi vieja", "total_servings": 6,
  "per_serving": { "calories": 412, "protein_g": 28.4, "carbs_g": 39.1, "fat_g": 14.2,
                   "fiber_g": 9.8, "sugar_g": 5.1, "sodium_mg": 620 },
  "total": { "calories": 2472 },
  "components": [ { "id": "…", "quantity": 2, "calories": 330,
                    "food": { "id": "…", "name": "Carne picada", "brand": null,
                              "serving_size_amount": 100, "serving_size_unit": "g" } } ] }
```

El listado trae `{id, name, total_servings, component_count, per_serving:{calories,
protein_g, carbs_g, fat_g}}`.

### Atajos de registro

| Método | Ruta | Cuerpo |
|---|---|---|
| POST | `/api/v1/logs/recipe` | `{log_date, meal_type, recipe_id, servings}` |
| PATCH | `/api/v1/logs/recipe/:groupId` | `{servings}` |
| DELETE | `/api/v1/logs/recipe/:groupId` | — |
| POST | `/api/v1/logs/quick` | `{log_date, meal_type, name, calories, protein?, carbs?, fat?}` |
| POST | `/api/v1/logs/copy` | `{from_date, to_date, meal_type?, to_meal_type?, replace?}` |

Todos devuelven el payload del día completo, igual que `POST /logs/meal`, así que la
pantalla se actualiza con la misma respuesta.

### Qué construir

- **Vista `#/recetas`**: lista con kcal por porción, alta y edición. El alta reusa el
  buscador de `AddFood` para elegir componentes.
- **En el diario**: botón de receta junto al buscador, con selector de porciones.
- **Quick add**: formulario mínimo, nombre y calorías. Los macros van opcionales y
  plegados: el quick add existe justamente para cuando no los sabés. Si los pedís todos,
  no es un atajo.
- **Copiar**: "copiar de ayer" en un tiempo de comida vacío es el 80% del uso real. La UI
  general de copiar (elegir fecha origen y destino) puede esperar a que alguien la pida.

---

## Fase 3 — Reportes, tendencias y rachas

**Estado del backend: listo y andando.**

| Ruta | Devuelve |
|---|---|
| `GET /api/v1/reports/summary?from=&to=` | `range`, `days_logged`, `averages`, `adherence`, `days[]` |
| `GET /api/v1/reports/weight?from=&to=` | `series[]` (misma forma que `/weight`), `trend` |
| `GET /api/v1/reports/streak?today=` | `current_streak`, `longest_streak`, `last_logged_on` |

`from` y `to` los calculás vos: no hay parámetro `period=week|month` porque el cliente ya
calcula fechas para el diario y conoce su propio inicio de semana. Tope de 366 días.

`today` en `/streak` es **tu día local**, mismo criterio que el `log_date` obligatorio al
loguear comida: el servidor no sabe tu zona horaria y adivinarla le cuesta la racha a
alguien a las 21:00.

```jsonc
// summary
{ "range": { "from": "2026-07-01", "to": "2026-07-31", "days_in_range": 31 },
  "days_logged": 24,
  "averages": { "calories": 2114, "protein_g": 148.2, "carbs_g": 201.6, "fat_g": 71.4,
                "fiber_g": 26.1, "sugar_g": 58.3, "sodium_mg": 2840 },
  "adherence": { "goal_calories": 2100, "days_with_goal": 24, "days_on_target": 17,
                 "pct_on_target": 70.8, "avg_delta_calories": 14 },
  "days": [ { "log_date": "2026-07-01", "calories": 2043, "protein_g": 151.2 } ] }

// weight
{ "series": [ { "logged_on": "2026-07-01", "weight_kg": 84.2, "ema_kg": 84.51 } ],
  "trend": { "points": 22, "start_ema_kg": 85.10, "end_ema_kg": 83.62,
             "change_kg": -1.48, "weekly_rate_kg": -0.33, "goal_weekly_kg": -0.50,
             "target_weight_kg": 78.0, "projected_target_date": "2026-11-19" } }
```

Dos cosas que la UI tiene que decir bien:

- Los promedios son **sobre días logueados**, no sobre días del rango. Mostrá "24 de 31
  días" al lado, que si no el número miente por omisión.
- `projected_target_date` viene `null` cuando el ritmo es cero o apunta al lado contrario
  del objetivo. No lo escondas: decí que a este ritmo no se llega.

### Qué construir

Vista `#/progreso` con selector de rango (semana, mes, 3 meses) usando el control
segmentado de la Fase 0. Barras de calorías por día contra la línea del objetivo,
promedios de macros, adherencia, la sparkline de peso que ya existe con la banda del
objetivo, y la racha.

**Los gráficos en SVG a mano**, como la `Sparkline` de `Weight.tsx`, que ya funciona.
Barras y una línea no justifican una librería de charts con lo que pesa.

---

## Fase 4 — Cuenta y datos personales

**Estado del backend: listo y andando.** Dos cosas que la UI tiene que contemplar:
restablecer la contraseña **cierra las demás sesiones**, así que si el usuario tenía otra
pestaña abierta va a caer al login (el manejo global del 401 ya lo resuelve). Y el link
del mail apunta a `#/reset?token=...`, o sea que falta esa ruta en el hash router.

| Ruta | Nota |
|---|---|
| `POST /api/v1/auth/forgot` | `{email}`. **Siempre 202**, exista o no la cuenta. La UI dice "si el email está registrado, te llega un link", nunca "ese email no existe": sería un oráculo de qué emails hay registrados |
| `POST /api/v1/auth/reset` | `{token, password}`, token del link, un solo uso, vence en 1 hora |
| `GET /api/v1/account/export` | Descarga JSON con todo el historial |
| `DELETE /api/v1/account` | `{password}` (los invitados no mandan nada, no tienen) |

Los invitados no tienen email: `forgot` sobre una cuenta invitada no hace nada. La UI
tiene que empujar a vincular la cuenta, que es lo que resuelve el problema de verdad.

Borrar la cuenta es irreversible: confirmación explícita, escribir algo, no un botón
suelto al lado de otro.

### Unidades

`unit_preference` (`metric` | `imperial`) se expone en `GET/PATCH /profile`.

**El almacenamiento sigue siendo métrico siempre.** La conversión es de presentación y
de entrada: kg ↔ lb, cm ↔ pie/pulgada. Un helper de formato y su inverso en los inputs de
peso y altura. No mandes libras al API.

---

## Orden

**0 → 1 → 2 → 3 → 4.**

La 0 va primero porque define dónde entran las tres vistas nuevas: hacerla después
significa mover el mismo código dos veces. La 1 se puede empezar apenas termine la 0. La
2 y la 3 esperan a que sus endpoints existan, y te aviso cuando estén.

La 4 es independiente de todo y se puede adelantar si preferís tener recuperación de
contraseña antes que reportes.

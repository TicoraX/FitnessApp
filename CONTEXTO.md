# Contexto de FitTrack

Qué es este proyecto, para quién, y las convenciones que gobiernan cómo se
construye. `README.md` responde "cómo lo corro y qué endpoints tiene"; este
archivo responde "qué es y por qué está armado así".

## Qué es y para quién

Seguimiento nutricional y de entrenamiento (dieta, cardio, fuerza, rutinas),
en español, apuntado al mercado colombiano.

Lo usás vos y quizás dos amigos. Eso decide qué queda afuera y no se discute
de nuevo cada vez que aparece la idea: onboarding, telemetría, monetización,
multiidioma, feed social, notificaciones push, cuentas de equipo, panel de
administración. El motivo largo de cada descarte, en `PENDIENTES.md`.

## Arquitectura real

Monorepo, dos apps:

```
apps/api/   NestJS + Prisma + PostgreSQL. Un módulo por dominio en
            apps/api/src/ (auth, foods, logs, nutrition, exercise, recipes,
            reports, routines). Catálogos estáticos (movimientos, MET) viven
            como arrays en código, no en tablas: son datos que no dependen
            del usuario.
apps/web/   Vite + React. Ruteo por hash a mano (useHashRoute), sin router de
            terceros. Gráficos como SVG escritos a mano (ver
            ProgresoView.tsx), sin librería de charts.
```

Estas ausencias son decisiones, no deuda: sin tráfico real, Redis, Typesense,
Kong o una arquitectura de microservicios no aportan nada todavía. Entran el
día que la carga real lo pida, no antes. El detalle de arranque local
(Docker solo para `db`, API y web local con recarga en caliente) está en
`README.md` y en `stack.yaml`.

## La convención de datos que gobierna el schema

Regla única: **el pasado no se reescribe**. Un registro histórico guarda el
valor tal como era ese día (snapshot), no una referencia que se recalcula
contra el estado actual.

Ejemplo canónico: `apps/api/src/nutrition/goal-history.ts`
(`objetivoVigente`) — el objetivo que rige un día viejo se reconstruye con el
que regía ESE día, no con el activo hoy. Mismo patrón en movimientos:
`StrengthEntry` guarda `name` como texto, no una referencia al catálogo, así
que un movimiento borrado del catálogo no rompe el historial de nadie.

Al diseñar algo nuevo que se muestra en un registro histórico, la pregunta es
siempre la misma: ¿esto es historial o estado efímero? Si es historial, se
copia el valor en el momento de crear la fila.

## Mapa de documentos

| Archivo | Para qué | Cuándo leerlo |
|---|---|---|
| `README.md` | Cómo levantar todo, tabla de endpoints, estado por fase | Para correr o integrar contra la API |
| `CONTEXTO.md` (este) | Qué es, para quién, arquitectura y convenciones | Primera vez en el repo |
| `PENDIENTES.md` | Qué se descartó y por qué, historial de PRs | Antes de proponer algo, por si ya se descartó con motivo |
| `AUDITORIA.md` | Hallazgos abiertos de la auditoría de código | Antes de tocar algo que podría estar ya señalado |
| `PLAN-EXPANSION.md` | El plan activo de trabajo, en fases | Al arrancar o retomar una fase |
| `docs/superpowers/specs/*.md` | Specs de features puntuales, uno por diseño aprobado | Antes de tocar la feature que documentan |
| `CLAUDE.md` / `.antigravity/rules.md` | Reglas de UI que rigen siempre (cero emojis) | Se cargan solas en cada sesión de agente |

`estrucura.md` y `PLAN-FRONTEND.md` se borraron: el primero era un blueprint
"enterprise" original que describía una arquitectura que este repo nunca tuvo
(microservicios, Kong, 100k req/s), el segundo era el plan del cliente web ya
cerrado. Ninguno de los dos reflejaba el estado real y competían con
`README.md` y `PLAN-EXPANSION.md` como fuente de verdad.

git add .env.example README.md app components docs lib supabase/migrations supabase/seed.sql supabase/templates/confirmation.html supabase/tests/database tests/e2e# Torneos: guía del proyecto

> **Fuente de verdad del proyecto.** Tiene el plan, el estado de cada fase, las convenciones y el registro de todas las decisiones. La usan como guía las IAs de programación del equipo (Claude Code y GitHub Copilot) y cualquier persona que trabaje en el repo.

## 1. Cómo usar este archivo (instrucciones para IAs)

1. **Leé este archivo completo antes de escribir código.** Si algo del código contradice lo que dice acá, avisá antes de cambiar nada.
2. **Respetá las convenciones (§8) y los patrones existentes (§5).** Reutilizá los helpers listados antes de crear otros nuevos.
3. **Registrá toda decisión nueva** en el registro (§12), con el siguiente número `D-NNN`. Una decisión es cualquier elección de diseño, librería, modelo de datos, regla de negocio o cambio de alcance.
4. **No contradigas una decisión existente en silencio.** Si hay que cambiarla, agregá una entrada nueva que diga "Reemplaza a D-XXX" y marcá la vieja como *(reemplazada por D-YYY)*.
5. **Al cerrar una fase,** actualizá la tabla de estado (§3) y agregá las decisiones que se tomaron en ella.
6. **Next.js 16 no es el que conocés.** Antes de escribir código de Next, leé la guía que corresponda en `node_modules/next/dist/docs/`. Ver también `AGENTS.md`.
7. **Nunca ejecutes nada contra el proyecto de Supabase remoto:** ni `db push`, ni `link`, ni consultas. Las migraciones las corre el usuario (D-006).

---

## 2. Producto

Web app responsive para gestionar torneos deportivos, de 360px a desktop.

**Roles.** El rol depende de la relación con cada torneo: un mismo usuario puede organizar uno y jugar en otro.
- **Organizador:** crea y administra sus torneos: configuración, canchas, franjas horarias, inscripciones, grupos, programación, resultados y playoffs.
- **Participante:** se inscribe en pareja o equipo con el código del torneo, marca su disponibilidad y ve sus partidos, su historial y sus estadísticas.

**Alcance original:** torneos con estados, deportes configurables, franjas horarias y disponibilidad, parejas e inscripciones, fase de grupos con scheduler automático, playoffs con byes y tercer puesto, historial del participante y vistas públicas de solo lectura.

**Cambios de alcance pedidos por el usuario:**
- **Deportes:** por ahora solo pádel, tenis y fútbol 11 (D-004).
- **Compañeros:** se cargan por email. D-044 reemplaza la vinculación automática: el capitán invita por correo y cada integrante acepta desde una cuenta verificada con ese mismo email antes de que el organizador apruebe la pareja.

---

## 3. Estado por fase

Se trabaja por fases. Al cerrar cada una se explica qué se hizo, se reporta la revisión de seguridad y se espera el OK del usuario antes de seguir.

| Fase | Alcance | Estado |
|---|---|---|
| F1 | Fundaciones: scaffold, Supabase SSR, auth (email + Google), layout, estados globales, Vitest | ✅ Hecha (2026-09-30) |
| F2 | Base de datos: 7 migraciones, RLS, RPC de inscripción, seed local, pgTAP, tipos | ✅ Hecha (2026-09-30) |
| F3 | Lógica de dominio pura en `lib/domain` con tests: scoring, round-robin, groups, slots, scheduler, standings, bracket, tournament-status, stats | ✅ Hecha (2026-09-30) |
| F4 | Torneos (organizador): mis torneos, CRUD, config de puntuación, estados, canchas, franjas (individual + lote), link/código | ✅ Hecha (2026-10-01) |
| F5 | Inscripción por código, plantel, disponibilidad mobile-first, aprobación, resumen de disponibilidad | ✅ Hecha (2026-10-01) |
| F6 | Grupos (sorteo/DnD), fixture, scheduler, edición manual, resultados + confirmación, posiciones. RPC: `apply_groups`, `apply_schedule`, `assign_match_slot`, `record_match_result`, `clear_match_result`, `respond_result`, `confirm_match_result` | ✅ Hecha (2026-10-01) |
| F7 | Playoffs: cuadro, byes, 3er puesto, programación, avance automático, bracket responsive. RPC: `apply_bracket` | ✅ Hecha (2026-10-01) |
| F8 | Mi historial (filtros + stats), próximos partidos, página pública `/t/[slug]` con cache por tag | ✅ Hecha (2026-10-01) |
| F9 | CSP con nonce, headers de seguridad, cookies `Secure`, axe en E2E, `robots.ts`, matriz de permisos de funciones (pgTAP), README con deploy | ✅ Hecha (2026-10-01) |

---

## 4. Stack

| Pieza | Versión | Notas |
|---|---|---|
| Next.js | 16.3.7 | App Router, Turbopack, React Compiler desactivado |
| React | 19.2.8 | La versión que fija create-next-app |
| TypeScript | 5.9 | `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch` |
| Tailwind CSS | 4.3 | Configuración CSS-first en `app/globals.css` |
| shadcn/ui | CLI 4.x, preset `radix-nova` | Componentes en `components/ui/`; `cn` viene del paquete `cn` (D-014) |
| @supabase/ssr / supabase-js | 0.12 / 2.117 | Solo la clave pública (anon/publishable) |
| Zod | 4.6 | API v4: `z.email()`, `z.url()`, `{ error }`, `z.flattenError` |
| React Hook Form | 7.89 + @hookform/resolvers 5 | `zodResolver`, sin genéricos explícitos en `useForm` |
| Vitest | 5.0.2 + @vitest/coverage-v8 5.0.2 | Config en `vitest.config.mts`; cobertura mínima 90 % en `lib/domain` |
| sonner | 2 | Toasts sincronizados con el tema (D-043) |
| date-fns + @date-fns/tz | 4 / 1.5 | Se instalan en F4 (D-010) |
| @dnd-kit/react | 0.5 | Se instala en F6 |
| Supabase CLI | 2.118 | Stack local en Docker |

**Particularidades de Next 16 que ya están en el código:**
- **`proxy.ts`:** reemplaza a `middleware.ts`. Exporta `proxy` y `config.matcher`.
- **`error.tsx` y `global-error.tsx`:** reciben `{ error, retry }`. Se usa `retry()`, que vuelve a pedir los datos; `reset()` casi nunca.
- **`PageProps<'/ruta'>` y `LayoutProps<'/ruta'>`:** son tipos globales que genera `next typegen` (lo corre `pnpm typecheck`). `params` y `searchParams` son `Promise`.
- **Lint:** `next lint` ya no existe; el script `lint` corre `eslint` directo.
- **`cookies()` y `headers()`:** son async.

---

## 5. Estructura y patrones

```
app/
  (auth)/            login · registro · recuperar-clave · actualizar-clave · actions.ts (Server Actions de auth)
  (app)/             área privada (layout valida sesión): torneos · proximos · historial · perfil
  t/[slug]/          página pública del torneo (sin login; cliente anónimo + cache por tag)
  auth/callback/     OAuth (PKCE) → exchangeCodeForSession
  auth/confirm/      links de email con token_hash → verifyOtp
  layout.tsx · page.tsx (portada) · error.tsx · global-error.tsx · not-found.tsx
components/
  ui/                shadcn (se pueden editar; ver D-014)
  layout/            AppHeader, MainNav, BottomNav, UserMenu, SkipLink, nav-items
  theme-provider.tsx | preferencia clara/oscura persistida en cookie
  auth/              formularios de auth
  shared/            EmptyState, PageHeader
lib/
  actions/safe-action.ts   helper de Server Actions
  supabase/                server.ts · client.ts · proxy.ts · public.ts (anónimo, sin cookies) · errors.ts ·
                           database.types.ts (generado)
  data/                    lecturas con `server-only` + `cache()`: tournaments · organizer · teams ·
                           competition · history · public
  public-cache.ts          tag e invalidación de la página pública (D-040)
  security/csp.ts          CSP con nonce (la arma proxy.ts, D-041)
  validation/              esquemas Zod compartidos cliente/servidor
  domain/                  lógica pura + tests: scoring · round-robin · groups · slots · scheduler ·
                           standings · bracket · tournament-status · stats · random
  utils/                   redirect.ts · origin.ts · text.ts
  auth.ts · forms.ts · env.ts · config.ts
proxy.ts             CSP con nonce + refresco de sesión + protección de rutas
tests/e2e/           Playwright: flujos por fase, accesibilidad (axe) y CSP; escenarios por API en fixtures.ts
supabase/            config.toml · migrations/ · tests/database/ · seed.sql · templates/
docs/PROYECTO.md     esta guía
```

**Patrones obligatorios**
- **Server Components por defecto.** Client Components solo para interactividad: formularios, menús, DnD, selector de disponibilidad.
- **Server Actions:** siempre con `createAction(schema, handler)` (requiere sesión; el handler recibe `{ supabase, userId }`) o `createPublicAction` de `lib/actions/safe-action.ts`.
  - Validan con Zod.
  - Nunca devuelven errores crudos: usan `dbErrorMessage(error)` y `authErrorMessage(error)` de `lib/supabase/errors.ts`.
  - Devuelven `ActionResult<T>`: `{ ok: true, data, message? } | { ok: false, error, fieldErrors? }`.
  - Si redirigen con `redirect()`, no lo atrapan: el helper usa `unstable_rethrow`.
- **Formularios:**
  - React Hook Form + `zodResolver(schema)`, con el mismo esquema que la Server Action (vive en `lib/validation/`).
  - En el submit: `startTransition(async () => { const r = await action(values); ... })`.
  - Errores por campo con `applyServerErrors(form.setError, r.fieldErrors)` de `lib/forms.ts`, y toast con `sonner`.
  - Campos con los componentes `Field*` de shadcn y `Controller`.
- **Sesión:**
  - En servidor, `getCurrentUser()` de `lib/auth.ts`: usa `getClaims()` y está memoizado por request. Nunca uses `getSession()` en el servidor.
  - Rutas nuevas privadas: agregalas a `PROTECTED_PREFIXES` en `lib/supabase/proxy.ts`.
- **Redirects con `next`:** siempre pasan por `getSafeRedirectPath()` de `lib/utils/redirect.ts` (anti open redirect).
- **URLs absolutas** (OAuth, emails): se arman con `getRequestOrigin()` de `lib/utils/origin.ts`.
- **Clientes Supabase:**
  - `createClient()` de `lib/supabase/server.ts` en el servidor: uno por request.
  - `lib/supabase/client.ts` en el browser.
  - Las variables de entorno se leen desde `lib/env.ts` (validado con Zod).
- **Estados de UI:** cada segmento tiene `loading.tsx` (skeleton), maneja errores y usa `EmptyState` cuando no hay datos. Los encabezados de página van con `PageHeader`: un solo `h1` por pantalla. Excepción: `/t/[slug]` no tiene `loading.tsx` (D-040).
- **Tema:** el `ThemeProvider` raíz inicializa el tema desde la cookie `theme`; el selector del header privado lo cambia sin recargar y lo persiste para todas las rutas. El tema inicial es claro (D-043).
- **Accesibilidad:** las regiones con scroll horizontal (tablas anchas, cuadro) llevan `role="region"`, `aria-label` y `tabIndex={0}`. Toda pantalla nueva se suma a `tests/e2e/a11y-security.spec.ts` (axe WCAG 2.1 AA, D-042).
- **Scripts de terceros:** con la CSP con nonce, cualquier `<Script>` externo necesita `nonce={(await headers()).get("x-nonce")}` (lo pone `proxy.ts`) y su dominio en `lib/security/csp.ts`.

---

## 6. Base de datos y seguridad

**Tablas (schema `public`)**
| Tabla | Descripción |
|---|---|
| `profiles` | Nombre y avatar; se crea con un trigger sobre `auth.users`. **No guarda el email.** |
| `sports` | Catálogo de solo lectura: `padel`, `tenis` (2 integrantes, sets) y `futbol-11` (11, goles). Cada fila trae las configs por defecto. |
| `tournaments` | Configuración y `status`: `draft` → `registration_open` → `group_stage` → `playoffs` → `finished`. `is_test` marca torneos privados de prueba, excluidos de toda lectura pública. |
| `tournament_invites` | Código de inscripción (10 caracteres, sin O/0/I/1). Solo lo lee el organizador. |
| `courts` / `time_slots` | Canchas/sedes y franjas horarias (`timestamptz`; una franja sin cancha sirve para cualquiera). |
| `teams` / `team_members` / `team_availability` | La inscripción es el equipo. En inscripciones de participantes, los integrantes van por email y aceptación explícita; el organizador también puede cargar nombres sin email y su disponibilidad. `test_generated` marca parejas ficticias y `organizer_registered` inscripciones manuales. |
| `tournament_groups` / `group_teams` | Grupos y su composición. |
| `matches` | Partidos de grupos y playoffs: programación (`slot_id`, `court_id`, horarios copiados) y resultado. |
| `match_confirmations` | Confirmación u objeción del resultado por parte de los equipos. |
| `v_my_matches` (vista) | Partidos del usuario actual con resultado desde su lado (`security_invoker`). |

**Reglas de seguridad**
- **RLS y privilegios:** RLS está habilitado en todas las tablas y los privilegios se dan explícitamente (`revoke all` + `grant` por tabla y columna). La API de PostgREST es pública: **la barrera real es la base, no la app.**
- **Anónimo:** solo ve torneos publicados (`status <> 'draft'`) y sus equipos aprobados. Nunca ve emails, códigos ni disponibilidad.
- **Participantes:** escriben solo vía RPC (`register_team`, `update_team_roster`, `withdraw_team`, `leave_team`, `set_team_availability`), que validan estado, pertenencia y cupo. El organizador inscribe sin email por `create_organizer_team`, que valida rol, torneo, plantel, franjas y cupo, y deja el equipo aprobado.
- **Organizador:** escribe canchas, franjas, grupos y partidos por RLS. `status` y campeón se cambian solo vía `set_tournament_status`; la aprobación va por `review_registration`.
- **Helpers de RLS** (`is_tournament_organizer`, `is_tournament_published`, `is_tournament_participant`, `is_team_member`, `can_read_tournament`, `can_view_profile`): viven en el **schema `private`**, que la API no expone. Son `SECURITY DEFINER` con `search_path = ''`.
- **RPC:** son `SECURITY DEFINER` con `search_path = ''` y nombres completamente calificados.
  - Errores de negocio: `errcode 'P0001'` con mensaje en español para mostrar al usuario.
  - Permisos: `errcode '42501'`.
- **Integridad:**
  - Todas las referencias internas usan FKs compuestas `(id, tournament_id)`.
  - Constraint `EXCLUDE` diferido: una cancha no puede tener dos partidos superpuestos.
  - Constraint trigger diferido: un equipo no puede tener dos partidos superpuestos.
- **Nunca se usa la service role key** en la app.
- **Migraciones** (D-006): las ejecuta el usuario. Mientras no las haya corrido en el remoto se pueden editar; después son inmutables y cada cambio va en una migración nueva con timestamp posterior.

---

## 7. Contratos de datos (JSON)

La base valida solo la forma mínima (objeto y `type`). El detalle lo validan los esquemas Zod de `lib/domain`.

```jsonc
// tournaments.scoring_config: sets (pádel, tenis)
{ "type": "sets", "bestOf": 3, "gamesPerSet": 6, "tiebreak": true,
  "decidingSet": "super_tiebreak", "superTiebreakPoints": 11, "superTiebreakUntil": "quarterfinals" }
// bestOf: 1|3|5 · decidingSet: "full" | "super_tiebreak" · superTiebreakUntil: "all"|"semifinals"|"quarterfinals"|"groups"

// tournaments.scoring_config: goals (fútbol)
{ "type": "goals", "playoffTiebreak": "penalties" }

// tournaments.standings_config
{ "points": { "win": 3, "draw": 1, "loss": 0 },
  "tiebreakers": ["points", "head_to_head", "set_diff", "game_diff", "games_won"] }
// criterios sets:  points, wins, head_to_head, set_diff, game_diff, sets_won, games_won
// criterios goals: points, wins, head_to_head, goal_diff, goals_for
// último recurso: sorteo determinístico con tournament_groups.tiebreak_seed

// tournaments.playoff_config
{ "qualifiersPerGroup": 2, "thirdPlace": false }

// matches.result: sets (el super tie-break va como último set, en puntos)
{ "type": "sets", "sets": [{ "home": 6, "away": 4 }, { "home": 3, "away": 6 }, { "home": 10, "away": 8 }] }

// matches.result: goals (penales solo en playoffs con empate)
{ "type": "goals", "home": 2, "away": 2, "penalties": { "home": 4, "away": 3 } }
```

**Reglas de resultado:**
- `winner_team_id` o `is_draw` definen si hay resultado (`result_status` no es null).
- El W.O. se guarda con `is_walkover = true` y el marcador ganador mínimo (D-011).
- Los empates solo existen en grupos.

---

## 8. Convenciones

- **Idioma:**
  - Textos de UI en español rioplatense ("Ingresá", "tenés").
  - Identificadores en inglés.
  - Comentarios en español, explicando el porqué.
- **Mobile-first desde 360px:**
  - Inputs y botones de 40px de alto en mobile (`h-10 md:h-8`).
  - Barra de navegación inferior en mobile y navegación superior en desktop.
  - Tablas y cuadros con scroll horizontal.
- **Accesibilidad:**
  - Labels asociados y `aria-invalid`.
  - Errores de campo con `role="alert"` (lo hace `FieldError`).
  - Íconos decorativos con `aria-hidden`.
  - `SkipLink` en los layouts.
  - Foco visible.
  - Un solo `h1` por pantalla.
- **Seguridad de la UI:**
  - Nunca se muestra `error.message` de errores de servidor, solo `digest`.
  - Los parámetros de URL que llegan a la UI se mapean a mensajes fijos.
- **Fechas:** en la base todo es `timestamptz`; se muestran con la zona horaria del torneo (`tournaments.timezone`).
- **Tests:**
  - Unitarios en `lib/**/*.test.ts` (Vitest, entorno node).
  - SQL en `supabase/tests/database/*.test.sql` (pgTAP). Cada test SQL arranca con `delete from public.tournaments;` para aislarse del seed.
- **Dependencias:** cada una nueva se verifica (mantenimiento, `pnpm audit`, procedencia si es muy reciente) y se registra en el log.

---

## 9. Comandos

| Comando | Uso |
|---|---|
| `pnpm dev` | App en http://localhost:3000 (usa `.env.local`) |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` | Verificación estándar de cada cambio |
| `pnpm test:coverage` | Tests + cobertura de `lib/domain` (falla por debajo del 90 %) |
| `supabase start -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,studio,postgres-meta` | Stack local mínimo |
| `supabase db reset` | Recrea la base local: migraciones + `seed.sql` |
| `supabase test db` | Tests pgTAP |
| `supabase db lint --local --level warning --schema public,private` | Valida cuerpos plpgsql |
| `supabase db advisors --local --type all --level warn` | Linter de seguridad y performance de Supabase |
| `pnpm db:types` | Regenera `lib/supabase/database.types.ts` |
| `pnpm test:e2e` | E2E con Playwright contra `pnpm dev` (requiere Supabase local con el seed) |
| `E2E_BASE_URL=http://localhost:3100 pnpm test:e2e` | E2E contra un build ya levantado (`pnpm build && pnpm start -p 3100`): valida la cache real |

**Datos demo (solo local):**
- Usuarios `organizador@demo.test`, `ana@demo.test`, `bruno@demo.test`, `carla@demo.test`, etc., todos con contraseña `demo1234`.
- Torneo de pádel con inscripción abierta, código `DEMQ2PADEL`.
- Mailpit en http://127.0.0.1:54324.

---

## 10. Flujo de trabajo

- **Planificación:** planificar antes de codear. Los cambios que tocan varios archivos o cambian comportamiento necesitan la aprobación del usuario.
- **Revisión de seguridad después de cada cambio:** validación de input, inyección, authn/authz en endpoints y RPC nuevos, secretos, exposición de datos, permisos y dependencias. Se reporta "sin hallazgos" o la lista concreta.
- **Git y remoto:**
  - Sin commits salvo pedido explícito. Hoy el proyecto no es repo git.
  - No tocar el Supabase remoto ni sus claves.
- **Verificación de cada fase:** typecheck, lint, test y build. Si hay cambios de base: `db reset`, `test db`, lint, advisors y `db:types`. Después, smoke test con `pnpm dev`.

---

## 11. Riesgos y pendientes conocidos

| Tema | Detalle | Cuándo |
|---|---|---|
| Rate limit de Auth por IP | El login corre en Server Actions, así que Supabase ve la IP del servidor. Si aparecen 429 en producción, ajustar Auth → Rate Limits. | Seguimiento en producción |
| Estilos inline permitidos por la CSP | `style-src 'unsafe-inline'`: Radix, sonner y dnd-kit escriben estilos inline. Los scripts sí quedan restringidos por nonce. | Aceptado (D-041) |
| Utilitarias internas en `public` | `require_user`, `generate_code`, `normalize_*`, etc. no se movieron a `private` (habría que recrear todas las RPC que las llaman). Tienen `EXECUTE` revocado y `07_function_privileges` lo verifica. | Aceptado (D-042) |
| Cache de la página pública | `unstable_cache` está reemplazado por `use cache` en Next 16. Migrar cuando se habiliten Cache Components. | Futuro (D-040) |
| Enumeración de emails | Quien tiene el código de un torneo puede saber si un email ya está inscripto en ese torneo. Es inherente a D-005. | Aceptado |
| Entrega de invitaciones | Resend exige remitente de un dominio verificado para entregar a terceros. `onboarding@resend.dev` solo permite pruebas al email dueño de la cuenta. | Configurar antes de producción (D-044) |
| "Confirm email" en el remoto | Debe estar activo para que la app permita aceptar invitaciones solo con un email verificado. | Config del usuario |
| Entorno local | La red es lenta y pnpm 11 se colgó bajando tarballs grandes. Postgres local fijado en `supabase/.temp/postgres-version` (17.6.1.063). | Solo local |

---

## 12. Registro de decisiones

Formato: `D-NNN — Título (fecha · fase)`, seguido de **Decisión / Motivo / Cómo aplicar**. Las entradas nuevas van al final.

### D-001 — Stack y versiones (2026-09-29 · F1)
- **Decisión:** Next 16.3.7 + React 19 + TS estricto + Tailwind 4 + shadcn/ui + Supabase (`@supabase/ssr`) + Zod 4 + RHF + Vitest, en las últimas estables.
- **Motivo:** es lo que pidió el usuario. `next@16.3.7` tenía menos de 24 h de publicado (pnpm lo marca con `minimumReleaseAge`); se verificó que su procedencia SLSA sale del workflow oficial de `vercel/next.js` con el tag `v16.3.7`.
- **Cómo aplicar:** las excepciones de `minimumReleaseAgeExclude` en `pnpm-workspace.yaml` son solo para esas versiones. Cualquier otra dependencia muy reciente se verifica igual antes de usarla.

### D-002 — pnpm, sin git (2026-09-29 · F1)
- **Decisión:** usar pnpm; `create-next-app --disable-git`; el paquete se llama `torneos` (el nombre de la carpeta, "Manu", no es válido para npm).
- **Motivo:** pnpm es el que usa el usuario. Los commits solo se hacen si él los pide.
- **Cómo aplicar:** no inicializar git ni commitear sin pedido explícito.

### D-003 — Fases con confirmación (2026-09-29 · todas)
- **Decisión:** el trabajo se divide en F1–F9 (§3). Al cerrar cada fase se reporta y se espera el OK del usuario.
- **Motivo:** es lo que pidió el usuario. La excepción del 2026-09-30 (F1 → F2 sin pausa) fue a pedido de él.
- **Cómo aplicar:** no arrancar una fase sin aprobación.

### D-004 — Modelo genérico de equipos (2026-09-29 · F2)
- **Decisión:** `teams` + `team_members`, con tamaño mínimo y máximo por deporte. Deportes iniciales: pádel y tenis (2 integrantes, sets) y fútbol 11 (mínimo = máximo = 11, goles).
- **Motivo:** el usuario quiere empezar con esos tres y ampliar después. Un modelo de N integrantes evita rehacer el esquema.
- **Cómo aplicar:** la UI dice "pareja" si el tamaño es 2 y "equipo" en los demás casos. Un deporte nuevo = una fila en `sports` (por migración), más un validador si trae otro sistema de puntuación.

### D-005 — Compañeros por email, sin invitación (2026-09-29 · F2) *(reemplazada por D-044)*
- **Decisión:** quien inscribe carga los emails de sus compañeros y queda como capitán.
  - Si el email tiene una cuenta verificada, se vinculaba en el acto.
  - Si no, quedaba pendiente hasta verificar el email.
  - No se mandaba ningún mail.
- **Motivo:** es lo que pidió el usuario ("no invito compañeros, solo los vinculo como mi pareja por su mail").
- **Cómo aplicar:**
  - Cualquier integrante puede salirse con `leave_team` mientras la inscripción esté abierta; el equipo vuelve a quedar pendiente.
  - El capitán da de baja la inscripción con `withdraw_team`, que borra el equipo.
  - Cambiar el plantel vuelve la inscripción a `pending`.
  - Reemplazada por D-044: desde esa decisión cada integrante debe aceptar una invitación expresa.

### D-006 — Las migraciones las ejecuta el usuario (2026-09-29 · F2)
- **Decisión:** se entregan archivos en `supabase/migrations/`. Nunca se conecta nada al remoto. La validación es local con Docker.
- **Motivo:** es lo que pidió el usuario ("dame las migraciones y yo las ejecuto").
- **Cómo aplicar:** validar cada migración con `db reset` + `test db` + lint + advisors. Una vez que el usuario confirma que las corrió, son inmutables.

### D-007 — Código de inscripción en tabla aparte (2026-09-29 · F2)
- **Decisión:** la inscripción a un torneo requiere el código. El código vive en `tournament_invites` (solo lo lee el organizador) y se resuelve con la RPC `resolve_invite_code`.
- **Motivo:** la fila de `tournaments` es pública cuando el torneo está publicado; si el código estuviera ahí, sería legible por cualquiera.
- **Cómo aplicar:** el código se genera por trigger (10 caracteres, 50 bits) y se regenera con `rotate_invite_code`. En los códigos, la entrada del usuario se normaliza: mayúsculas y sin espacios ni guiones.

### D-008 — Qué es público (2026-09-29 · F2)
- **Decisión:** "publicado" = `status <> 'draft'`. En lo público solo aparecen los equipos `approved`, por su nombre.
- **Motivo:** proteger los datos personales de las inscripciones pendientes y de los emails.
- **Cómo aplicar:** las vistas públicas nunca consultan `team_members` ni `profiles`: usan `teams.name`.

### D-009 — Borrar torneos solo antes de empezar (2026-09-29 · F2)
- **Decisión:** un torneo solo se puede borrar en `draft` o `registration_open` (lo aplica la política de RLS).
- **Motivo:** después de empezar, el torneo es parte del historial de los participantes.
- **Cómo aplicar:** en la UI, ocultar o deshabilitar "Eliminar" en los demás estados.

### D-010 — Zona horaria por torneo (2026-09-29 · F2)
- **Decisión:** `tournaments.timezone` (default `America/Argentina/Buenos_Aires`, validada con `pg_timezone_names`). Las franjas se guardan en `timestamptz`.
- **Motivo:** el servidor puede correr en UTC; mostrar la hora del servidor daría horarios mal.
- **Cómo aplicar:** formatear y parsear con `@date-fns/tz` (`TZDate`) usando la zona del torneo. Se instala en F4.

### D-011 — W.O. (2026-09-29 · F3/F6)
- **Decisión:** el W.O. es un tipo de resultado: `is_walkover = true` y el marcador ganador mínimo (6-0 6-0 en sets, 3-0 en goles).
- **Motivo:** en los torneos amateurs pasa todo el tiempo; hace falta que cuente en la tabla.
- **Cómo aplicar:** el perdedor por W.O. suma los puntos de derrota.

### D-012 — Flujo de autenticación (2026-09-29 · F1)
- **Decisión:**
  - Email/contraseña y Google por Server Actions.
  - `/auth/callback` para OAuth (PKCE).
  - `/auth/confirm` con `token_hash` + `verifyOtp` para los links de email, con templates propios en `supabase/templates/`.
  - Mensajes genéricos en registro y recuperación, para no permitir enumerar usuarios.
- **Motivo:** los links de email tienen que funcionar aunque se abran en otro navegador, y no hay que revelar si una cuenta existe.
- **Cómo aplicar:** los templates se pegan a mano en el dashboard remoto (ver README). `next` siempre pasa por `getSafeRedirectPath`.

### D-013 — Next 16: proxy y retry (2026-09-30 · F1)
- **Decisión:** usar `proxy.ts` (no `middleware.ts`) y `retry` en los error boundaries.
- **Motivo:** son las APIs de Next 16 según la documentación incluida en el paquete.
- **Cómo aplicar:** ante la duda, consultar `node_modules/next/dist/docs/`.

### D-014 — shadcn radix-nova, paquete `cn`, solo tema claro (2026-09-30 · F1) *(reemplazada parcialmente por D-043)*
- **Decisión:**
  - Preset `radix-nova` (Radix, Lucide, Geist).
  - `cn` viene del paquete oficial `cn` (repo `shadcn-ui/cn`, reemplaza a clsx + tailwind-merge).
  - Se sacó `next-themes`; el tema claro fijo inicial fue reemplazado por D-048 con soporte para tema claro, oscuro y sistema.
  - `shadcn` va como devDependency.
  - En mobile, inputs y botones miden 40px.
- **Motivo:** menos dependencias y touch targets cómodos en mobile.
- **Cómo aplicar:** los componentes de `components/ui/` se pueden editar. Al agregar componentes nuevos con `pnpm dlx shadcn@latest add`, revisar que no reintroduzcan `next-themes` y respetar los tamaños mobile.

### D-015 — Helper de Server Actions (2026-09-30 · F1)
- **Decisión:** usar `createAction` y `createPublicAction` con `ActionResult` tipado. No se agrega `next-safe-action` ni ninguna librería similar.
- **Motivo:** hacía falta un patrón único (Zod, sesión verificada, errores traducidos) sin sumar dependencias.
- **Cómo aplicar:** ver §5.

### D-016 — Integridad de programación en la base (2026-09-30 · F2)
- **Decisión:**
  - `matches.starts_at/ends_at` se copian de la franja por trigger (`matches_sync_schedule`). Si la franja cambia, se propaga a sus partidos; si se borra, el partido queda "sin horario".
  - Una cancha no puede tener dos partidos superpuestos: lo garantiza un `EXCLUDE` diferido.
  - Un equipo no puede tener dos partidos superpuestos: lo garantiza un constraint trigger diferido.
- **Motivo:** ni un bug ni una llamada directa a la API pueden generar choques. Al ser diferidos, se pueden intercambiar horarios dentro de una misma transacción.
- **Cómo aplicar:** las RPC de programación (F6) hacen todos los cambios en una sola transacción. Errores esperables: `23P01` para cancha, `P0001` para equipo.

### D-017 — Helpers de RLS en el schema `private` (2026-09-30 · F2)
- **Decisión:** los helpers de autorización viven en `private` (con `usage` para anon/authenticated); las RPC, en `public`.
- **Motivo:** en `public` cualquiera podía invocarlos por `/rpc` y obtener información de pertenencia.
- **Cómo aplicar:** todo helper nuevo que usen las políticas va a `private`. Las RPC de escritura revocan `execute` a `public`/`anon`.

### D-018 — Transiciones de estado (2026-09-30 · F2)
- **Decisión:** las reglas viven en `set_tournament_status`:
  - `draft` → `registration_open` requiere al menos 1 franja.
  - `registration_open` → `draft`, solo si no hay inscripciones.
  - `registration_open` → `group_stage` requiere ≥ 2 aprobados y congela planteles y disponibilidad.
  - `group_stage` → `playoffs` o `finished` requiere todos los resultados de grupo cargados.
  - `playoffs` → `finished` requiere la final jugada; el campeón sale de la final.
  - En `group_stage` → `finished` (sin playoffs), la app calcula el campeón y lo pasa como parámetro.
- **Motivo:** un solo lugar de verdad; la app no puede saltear pasos.
- **Cómo aplicar:** `lib/domain/tournament-status` (F3) replica las mismas reglas para la UI, y los mensajes tienen que coincidir.

### D-019 — Cupo y plantel (2026-09-30 · F2)
- **Decisión:**
  - Se puede inscribir mientras los aprobados sean menos que `max_teams`; las inscripciones pendientes de más funcionan como lista de espera.
  - Aprobar exige el plantel completo y cupo disponible.
  - `max_teams` no puede quedar por debajo de los aprobados.
  - Hay locks `FOR UPDATE` sobre el torneo para evitar carreras.
- **Motivo:** el organizador decide quién entra, sin superar el cupo.
- **Cómo aplicar:** la UI muestra "X de N aprobados" y deshabilita aprobar cuando se llega al cupo.

### D-020 — Seed y aislamiento de tests (2026-09-30 · F2)
- **Decisión:**
  - `supabase/seed.sql` crea usuarios demo (`demo1234`) y un torneo usando las mismas RPC que la app. Es solo para local.
  - Los tests pgTAP arrancan con `delete from public.tournaments` dentro de la transacción.
- **Motivo:** datos realistas para probar, y tests deterministas aunque exista el seed.
- **Cómo aplicar:** no correr el seed en el remoto. Los tests nuevos siguen el mismo patrón (`set local role` + `set local request.jwt.claims`).

### D-021 — Entorno local de Supabase (2026-09-30 · F1/F2)
- **Decisión:**
  - La imagen de Postgres queda fijada en 17.6.1.063 (`supabase/.temp/postgres-version`), que ya estaba cacheada.
  - Se excluyen los servicios que no se usan.
  - `.env.local` apunta al stack local, con la publishable key de demo (no es secreta).
- **Motivo:** la red es lenta; la imagen nueva pesa 1,3 GB extra.
- **Cómo aplicar:** para usar el proyecto remoto, cambiar `.env.local` por las claves públicas del proyecto.

### D-022 — Contratos JSON de configuración y resultados (2026-09-30 · F2/F3)
- **Decisión:** las formas de `scoring_config`, `standings_config`, `playoff_config` y `matches.result` son las de §7.
- **Motivo:** la base y la app tienen que usar el mismo contrato; las configs por defecto viven en `sports`.
- **Cómo aplicar:** los esquemas Zod de `lib/domain` son la validación estricta. Cambiar un contrato requiere migrar datos y registrar la decisión acá.

### D-023 — Franjas en hora local, sin librería de zonas en el dominio (2026-09-30 · F3)
- **Decisión:** `lib/domain/slots.ts` genera franjas como hora de reloj local (`YYYY-MM-DD` + `HH:mm`). La conversión a `timestamptz` con la zona del torneo se hace al persistir.
- **Motivo:** el dominio queda puro y testeable sin depender de la zona horaria del proceso.
- **Cómo aplicar:** en F4, convertir con `@date-fns/tz` (o con Postgres: `(fecha + hora) at time zone tz`) usando `tournaments.timezone`. Máximo 500 franjas por generación.

### D-024 — Totales para la tabla (2026-09-30 · F3)
- **Decisión:**
  - El super tie-break cuenta como un set ganado y como un único game (1-0), no por sus puntos.
  - Los penales no suman goles.
  - El W.O. se computa con el marcador ganador mínimo (`walkoverResult`) y el perdedor suma los puntos de derrota.
- **Motivo:** son las convenciones habituales en torneos amateurs de pádel y fútbol, y evitan que un super tie-break (10-8) infle la diferencia de games.
- **Cómo aplicar:** usar siempre `resultTotals()` de `lib/domain/scoring.ts`.

### D-025 — Semántica de los desempates (2026-09-30 · F3)
- **Decisión:**
  - Los criterios se aplican en orden y cada subgrupo de empatados sigue con los criterios restantes.
  - `head_to_head` se recalcula solo entre los equipos que siguen empatados: es una mini-liga por puntos y resuelve triples empates.
  - Si al final siguen empatados, decide un sorteo determinístico (hash de `tiebreak_seed` + teamId), marcado con `decidedByLottery`.
  - Los criterios que no aplican al deporte se ignoran al calcular y se rechazan al validar (`validateStandingsConfig`).
- **Motivo:** el resultado tiene que ser reproducible y explicable al organizador.
- **Cómo aplicar:** la UI muestra un aviso cuando `decidedByLottery` es true.

### D-026 — Algoritmo del scheduler (2026-09-30 · F3)
- **Decisión:** `scheduleMatches` trabaja con intervalos (no con ids de franja) y restricciones duras de disponibilidad, superposición de equipo/cancha y `notBefore`.
  - Orden MRV + backtracking con cota superior y tope de 50.000 iteraciones.
  - Elige la franja más temprana y, a igual horario, la cancha según el orden del torneo.
  - Si no hay solución completa, devuelve la mejor parcial y los "sin horario" con su motivo (`missing_teams`, `no_common_availability`, `no_capacity`).
  - `checkManualAssignment` bloquea choques y advierte cuando falta disponibilidad.
- **Motivo:** es determinístico, rápido para torneos amateurs (16 parejas, 24 partidos, en milisegundos) y explica por qué un partido no entra.
- **Cómo aplicar:** los partidos fijados a mano (`schedule_locked`) o ya jugados van en `fixed`. Los motivos se muestran con `UNSCHEDULED_REASON_LABELS`.

### D-027 — Siembra y armado del cuadro (2026-09-30 · F3)
- **Decisión:**
  - **Tamaño:** potencia de 2 (hasta 32).
  - **Siembra:** por puesto, después `rating` (rendimiento normalizado, mayor es mejor), después grupo. Los byes van a los mejores sembrados.
  - **Ubicación de los 2° en adelante:** evita cruces del mismo grupo en 1ª ronda (penalidad 1000) y compartir mitad con alguien del mismo grupo (penalidad 1).
  - **3er puesto:** solo si las dos semifinales son partidos reales; si no, se devuelve un aviso.
  - **Avance:** `propagateResult` no permite corregir un resultado si el partido siguiente ya se jugó con otro equipo.
- **Motivo:** reproduce el cruce clásico 1°A vs 2°B y la separación por mitades de los torneos reales.
- **Cómo aplicar:** en F7, calcular `rating` con la tabla (p. ej. `[puntos/PJ, diferencia/PJ]`). La RPC `record_match_result` tiene que aplicar la misma regla de avance.

### D-028 — Cobertura y dependencias de test (2026-09-30 · F3)
- **Decisión:**
  - `@vitest/coverage-v8` fijado en 5.0.2 (igual que Vitest; la 5.0.3 tenía menos de 24 h).
  - `@types/node` pasa a ^24 (Vitest 5 exige ≥ 22).
  - Umbral de cobertura del 90 % en `lib/domain` (`pnpm test:coverage`).
  - `coverage/` excluido de ESLint.
- **Motivo:** el plan pide ≥ 90 % en la lógica de negocio, y la política es no usar versiones recién publicadas sin verificar.
- **Cómo aplicar:** al actualizar Vitest, subir `@vitest/coverage-v8` a la misma versión.

### D-029 — Reglas de edición según el estado del torneo (2026-10-01 · F4)
- **Decisión:**
  - La puntuación solo se edita en `draft` o `registration_open` (ya estaba en F2).
  - La tabla de posiciones y la config de playoffs se bloquean desde `playoffs`.
  - La zona horaria se bloquea en cuanto hay franjas.
  - Las canchas se borran solo antes de empezar y siempre queda al menos una (trigger `courts_keep_one`, que no aplica en el borrado en cascada).
- **Motivo:** cambiar esos datos con el torneo en curso invalidaría resultados, la siembra o la hora local de las franjas.
- **Cómo aplicar:** lo aplica la base (migración `20261001000100_tournament_edit_rules.sql`). La UI deshabilita los campos y muestra el motivo (`FormLocks` en `tournament-form.tsx`).

### D-030 — Slug con sufijo aleatorio (2026-10-01 · F4)
- **Decisión:** `slugWithSuffix(nombre)` = `slugify(nombre)` + 6 caracteres aleatorios (`lib/utils/slug.ts`). Ante un choque (23505) se reintenta una vez.
- **Motivo:** URLs públicas legibles sin consultar disponibilidad, y que no se puedan adivinar a partir del nombre.
- **Cómo aplicar:** el slug no se edita después de creado (no está en los grants de UPDATE).

### D-031 — Franjas en lote idempotentes (2026-10-01 · F4)
- **Decisión:** las franjas se insertan con `upsert(..., { onConflict: "tournament_id,starts_at,ends_at,court_id", ignoreDuplicates: true })`, en una sola sentencia. La conversión de hora local a UTC se hace en el servidor con `localToUtcIso` y la zona del torneo.
- **Motivo:** repetir el generador no duplica franjas y el usuario ve cuántas se crearon y cuántas ya existían.
- **Cómo aplicar:** reusar `insertSlots` de `app/(app)/torneos/[id]/canchas-franjas/actions.ts`.

### D-032 — Capa de lectura `lib/data` (2026-10-01 · F4)
- **Decisión:** las lecturas de los Server Components viven en `lib/data/*.ts`, marcados con `import "server-only"` y envueltos en `cache()`. Si el organizador no corresponde, el panel responde con `notFound()` (`requireOrganizerTournament`).
- **Motivo:** un solo lugar para las consultas con RLS, sin duplicarlas entre páginas y sin que lleguen al bundle del cliente.
- **Cómo aplicar:**
  - Las relaciones ambiguas entre `teams` y `tournaments` se desambiguan con `teams!teams_tournament_id_fkey` y `tournaments!teams_tournament_id_fkey`.
  - Si `notFound()` ocurre dentro de un segmento con `loading.tsx`, el status puede ser 200 (por el streaming); lo que importa es que no se muestren datos.

### D-033 — E2E con Playwright y el Chrome del sistema (2026-10-01 · F4)
- **Decisión:** `@playwright/test` 1.63 con `channel: "chrome"`, specs en `tests/e2e`, `workers: 1` y viewport de 360px por defecto. `pnpm test:e2e` levanta `pnpm dev` y usa Supabase local con el seed.
- **Motivo:** no hay que bajar navegadores (la red es lenta) y cualquier IA puede volver a correr los flujos.
- **Cómo aplicar:**
  - Antes de correrlos: `supabase db reset`.
  - Cada spec crea sus datos con `unique()`.
  - Después de una acción que navega con `router.push`, esperar la URL (`waitForURL`) antes de leer `page.url()`.

### D-034 — Ajustes de UI de shadcn (2026-10-01 · F4)
- **Decisión:**
  - Se sumaron `badge`, `textarea`, `switch`, `checkbox`, `alert-dialog`, `dialog`, `native-select`, `table`, `tabs`, `toggle-group` y `tooltip`. Al agregarlos, se respondió **no** a sobrescribir `button.tsx`.
  - `native-select` y `toggle` llevan altura de 40px en mobile, igual que inputs y botones.
  - Los campos-objeto de configuración (puntuación, tabla, playoffs) se editan como un solo `Controller`, para no depender de rutas anidadas sobre uniones discriminadas.
  - Mensajes de Zod en español como respaldo global (`lib/validation/zod-locale.ts`).
- **Motivo:** mantener las decisiones de D-014 y formularios tipados sin hacks.
- **Cómo aplicar:** correr `pnpm dlx shadcn@latest add <comp>` respondiendo "n" a las sobrescrituras. `ConfirmActionButton` (`components/shared`) es el patrón para acciones destructivas.

### D-035 — Inscripción: código, plantel y disponibilidad (2026-10-01 · F5)
- **Decisión:**
  - **"¿Tenés un código?"** está en `/torneos` (se movió de F4 para no dejar un link roto) y normaliza igual que la base (`normalizeInviteCode`).
  - **`/unirse/[code]`** resuelve con `resolve_invite_code` y contempla cuatro casos: código inválido, ya inscripto, inscripción cerrada y cupo lleno.
  - **Nombre sugerido** para parejas: "Apellido / ".
  - **Fútbol 11:** permite pegar la lista de emails (`parseEmailList`).
  - **`/inscripciones/[teamId]`** es solo para integrantes (404 para el resto). El capitán edita y da de baja; los integrantes se pueden salir.
  - **Disponibilidad:** chips con `role="checkbox"` de 48px de alto, "Todo el día", barra fija con contador y aviso `beforeunload` si hay cambios sin guardar.
  - **Organizador:** las inscripciones se filtran por estado con `?estado=` y "Aprobar" se deshabilita con su motivo (plantel incompleto o cupo lleno). La disponibilidad se resume por franja, por equipo y en una matriz con la columna de nombres fija.
- **Motivo:** cubrir el alcance de F5 sin RPC nuevas: las de F2 ya validan todo.
- **Cómo aplicar:**
  - Las lecturas están en `lib/data/teams.ts`.
  - Los resúmenes son funciones puras en `lib/domain/availability.ts`.
  - La agrupación por día recibe la clave del día desde afuera (depende de la zona horaria).

### D-036 — El fixture se calcula en TS y la RPC lo valida y persiste (2026-10-01 · F6)
- **Decisión:**
  - **Sorteo y fixture:** se calculan en la Server Action (`drawGroups`/`generateRoundRobin`). `apply_groups` recibe el JSON, valida (todos los aprobados una sola vez, grupos de 2+, partidos dentro del grupo y sin repetir) y reemplaza la fase de grupos en una transacción. Solo se puede rearmar mientras no haya resultados.
  - **Programación automática:** `lib/scheduling.ts` (`runAutoSchedule`) arma la entrada del scheduler desde la base y la aplica con `apply_schedule`. Los partidos fijados a mano (`schedule_locked`) o jugados no se mueven. Los constraints diferidos frenan cualquier choque al commit.
  - **Asignación manual:** `assign_match_slot` deja el partido fijado. Si la franja es general, exige elegir cancha.
- **Motivo:** la lógica queda testeable en `lib/domain` sin duplicarla en SQL, y la base sigue siendo la barrera ante llamadas directas a la API.
- **Cómo aplicar:** los pasos de una RPC que valida y persiste un cálculo de la app siguen este patrón (D-037 hace lo mismo con el cuadro).

### D-037 — Resultados, confirmación y avance (2026-10-01 · F6)
- **Decisión:**
  - **Carga:** la Server Action valida el marcador con `evaluateResult` y la config del torneo, o arma el W.O. con `walkoverResult`. `record_match_result` valida la coherencia (ganador del partido, empates solo en grupos) y deja el resultado `provisional` si el torneo exige confirmación (si no, `confirmed`). Además borra las confirmaciones anteriores.
  - **Confirmación de los equipos:** `respond_result` solo lo pueden usar integrantes de los equipos del partido; objetar exige un comentario. Pasa a `confirmed` cuando confirman ambos y a `disputed` si alguno objeta.
  - **Organizador:** `confirm_match_result` da el resultado por bueno.
  - **Tablas:** cuentan todos los resultados cargados, provisionales u objetados incluidos.
  - **Playoffs:** la propagación de ganador y perdedor (`place_team_in_match`) se hizo ya en esta migración. No se corrige un resultado si el partido siguiente ya se jugó con otro equipo.
  - **Borrado:** `clear_match_result` deshace la propagación. En la UI se confirma con un diálogo.
- **Motivo:** el organizador manda, los equipos pueden marcar errores y el cuadro no queda inconsistente.
- **Cómo aplicar:** los comentarios de objeción solo se muestran mientras el resultado está objetado.

### D-038 — Escenarios E2E por API (2026-10-01 · F6)
- **Decisión:** `tests/e2e/fixtures.ts` arma escenarios con supabase-js, usando sesiones reales de los usuarios del seed y las mismas RPC que la app (por ejemplo `groupStageScenario`). Lee `.env.local` con `process.loadEnvFile`.
- **Motivo:** los specs de fases avanzadas son independientes del orden y del estado del torneo demo.
- **Cómo aplicar:** los specs nuevos crean su propio torneo. No mutar el torneo demo del seed, que lo usa `registration.spec.ts`.

### D-039 — Cuadro, programación de rondas y campeón (2026-10-01 · F7)
- **Decisión:**
  - **Generación:** el organizador elige cuántos clasifican por grupo y si hay 3er puesto, con vista previa en vivo (`buildBracket` en el cliente). No se persiste en `playoff_config`, porque esa config se bloquea en playoffs (D-029): su valor es solo el default.
  - **Clasificados:** salen de las tablas finales, con `rating = [pts/PJ, dif/PJ, a favor/PJ]` (`qualifiersFromStandings`).
  - **Persistencia:** `apply_bracket` inserta los partidos, después los enlaza (siguiente y 3er puesto) y marca los byes como ganados y confirmados. Se puede rearmar mientras no haya resultados de playoffs.
  - **Programación:** al generar el cuadro se programa la 1ª ronda. Al cargar un resultado, si el partido siguiente o el del 3er puesto (por los enlaces `next`/`loser_next`) ya tiene sus dos equipos y no tiene horario, se programa solo con `notBefore` = fin de los partidos que lo alimentan.
  - **Campeón:** en `playoffs → finished` lo define la RPC (ganador de la final). En `group_stage → finished` con un único grupo, la acción lo calcula con la tabla. El cliente nunca manda el campeón.
  - **Vista:** `BracketView` (`components/bracket`) es de presentación, sin hooks: sirve en el servidor y en el cliente, también para la página pública.
- **Motivo:** reproduce el flujo real de un torneo (cuadro → avance → campeón) sin pasos manuales evitables.
- **Cómo aplicar:** la búsqueda del partido siguiente usa los enlaces, no los equipos. Un error anterior (buscar por el ganador) dejaba sin programar el 3er puesto.

### D-040 — Página pública, historial y próximos (2026-10-01 · F8)
- **Decisión:**
  - **Cliente anónimo:** `/t/[slug]` lee con `createPublicClient()` (`lib/supabase/public.ts`), sin cookies. Siempre consulta como `anon`, así que RLS solo deja ver torneos publicados y equipos aprobados, aunque quien navegue tenga sesión (un organizador no ve su borrador ahí: da 404).
  - **Cache:** `slug → id` va sin cache (consulta liviana; si el torneo vuelve a borrador, deja de verse al instante). Los datos pesados van con `unstable_cache` por id, tag `public-tournament:{id}` y `revalidate: 60` como red de seguridad.
  - **Invalidación:** `refreshPublicTournament(id)` (`updateTag`) en todas las Server Actions que cambian algo visible: estado y configuración, canchas y franjas, inscripciones (aprobar, plantel, baja, salir), grupos, programación, resultados y cuadro. `updateTag` solo funciona en Server Actions; fuera de ellas habría que usar `revalidateTag(tag, { expire: 0 })`.
  - **Por qué `unstable_cache`:** en Next 16 está reemplazado por `use cache`, pero eso exige habilitar Cache Components (cambia el modelo de render de toda la app). Se migra junto con ese cambio.
  - **Vistas:** pestañas como links `?vista=grupos|fixture|cuadro` (URL compartible, sin JS); por defecto, la etapa en curso. Antes de los grupos se muestran el estado de la inscripción y los equipos aprobados. Sin `loading.tsx` en `/t/[slug]`: con un Suspense arriba, `notFound()` respondería 200.
  - **Historial:** `v_my_matches` + `getMyMatches` (`lib/data/history.ts`). Los filtros van en la URL (`torneo`, `deporte`, `resultado=ganados|perdidos|empates`), con un formulario GET validado con Zod (lo inválido se ignora). Las estadísticas respetan torneo y deporte, pero no el filtro de resultado. Títulos = torneos con `champion_team_id` en mis equipos.
  - **Próximos:** partidos sin resultado de torneos en `group_stage`/`playoffs`, agrupados por día en la zona de cada torneo (`groupByLocalDay`) y con los "sin horario" al final.
- **Motivo:** página pública rápida y cacheable sin riesgo de mezclar datos de usuarios, y vistas personales siempre frescas (con RLS, sin cache).
- **Cómo aplicar:**
  - Nunca cachear con `unstable_cache` datos leídos con el cliente con sesión.
  - Toda Server Action nueva que cambie algo visible en la página pública tiene que llamar a `refreshPublicTournament`.
  - El E2E `public-history.spec.ts` valida la invalidación. Para verificar la cache real, correrlo contra un build (`E2E_BASE_URL`).

### D-041 — CSP con nonce, headers y cookies `Secure` (2026-10-01 · F9)
- **Decisión:**
  - **CSP por request en `proxy.ts`:** `buildCsp` (`lib/security/csp.ts`) con nonce de 128 bits. Scripts solo con nonce + `'strict-dynamic'` (`'unsafe-eval'` solo en desarrollo). Estilos con `'unsafe-inline'`. `connect-src` al proyecto de Supabase (https/wss). Imágenes de `*.googleusercontent.com` (avatares). `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` y `upgrade-insecure-requests` (solo en producción). El header va en el request (Next toma el nonce de ahí) y en la respuesta.
  - **Render dinámico en toda la app:** `await connection()` en el layout raíz. Una página estática saldría sin nonce y sus scripts quedarían bloqueados.
  - **Headers fijos en `next.config.ts`:** HSTS (2 años, `includeSubDomains`, sin `preload`), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` y `Permissions-Policy` restrictiva (cámara, micrófono, geolocalización, pagos, USB, topics). `poweredByHeader: false`.
  - **Cookies de sesión:** `SESSION_COOKIE_OPTIONS` (`secure` en producción) en los tres clientes (proxy, servidor y browser). No pueden ser HttpOnly porque el cliente del browser de Supabase las lee.
  - **Contraste:** `--muted-foreground` pasa de `oklch(0.556)` a `oklch(0.5)` para llegar a 4.5:1 también sobre `--muted`.
- **Motivo:** cerrar XSS por scripts inyectados y clickjacking, y que la sesión nunca viaje por http, sin romper Radix ni sonner.
- **Cómo aplicar:**
  - No agregar scripts inline sin nonce ni orígenes nuevos sin pasar por `buildCsp` (tiene tests).
  - El E2E `a11y-security.spec.ts` falla si el navegador reporta violaciones de CSP en consola.
  - Validar con `pnpm build && pnpm start` (en dev la política es más laxa).

### D-042 — Accesibilidad con axe y matriz de permisos de funciones (2026-10-01 · F9)
- **Decisión:**
  - **Axe en E2E:** `@axe-core/playwright` 4.13.0 (dev; Deque, mantenido, una sola dependencia: `axe-core`). Revisa WCAG 2.1 A/AA en 360px en todas las pantallas (públicas, participante y organizador) y en los diálogos de resultado y de programación. Antes de analizar espera a que terminen las animaciones finitas (el fade de entrada alteraba el contraste medido).
  - **`robots.ts`:** solo se indexan `/` y `/t/`. El área privada además lleva `noindex`.
  - **Funciones:** no se mueven a `private` las utilitarias que quedaron en `public`. Habría que recrear todas las RPC que las invocan por nombre calificado, con riesgo de regresión en migraciones ya aplicadas en el remoto. En su lugar, el pgTAP `07_function_privileges` fija la matriz: `anon` solo ejecuta `resolve_invite_code`; `authenticated`, exactamente las RPC de la app listadas en ese test; ninguna utilitaria interna es ejecutable; toda función `SECURITY DEFINER` tiene `search_path` fijo.
- **Motivo:** detectar regresiones de accesibilidad y de exposición de funciones de forma automática, sin tocar migraciones existentes.
- **Cómo aplicar:**
  - Una RPC nueva implica actualizar la lista de `07_function_privileges` (el test falla a propósito).
  - Una pantalla nueva se suma a `a11y-security.spec.ts`.

<<<<<<< HEAD
### D-043 — Tema claro/oscuro persistido (2026-10-02 · mantenimiento)
- **Decisión:** agregar un selector de tema en el header privado. El tema inicial es claro; la preferencia elegida se guarda en la cookie `theme` por un año y aplica a toda la web, incluidas las páginas públicas. El `ThemeProvider` sincroniza la clase `.dark` en el documento y el `Toaster`; no se agrega `next-themes`.
- **Motivo:** las variables y utilidades CSS oscuras ya existían, pero no había control que activara `.dark` y las notificaciones estaban fijadas a claro.
- **Cómo aplicar:** el layout raíz lee `theme` con `cookies()` de Next.js 16 antes de renderizar, evitando un destello de tema. El toggle solo cambia entre `light` y `dark`; cookies inválidas se interpretan como `light`.

### D-044 — Invitaciones de compañeros con aceptación explícita (2026-10-02 · mantenimiento)
- **Decisión:**
  - El capitán envía una invitación por Resend a cada integrante no vinculado; el token aleatorio de 256 bits se guarda únicamente como SHA-256, vence a los 7 días y se invalida al aceptarse o reenviarse. La RPC limita reenvíos a uno por minuto.
  - La aceptación requiere sesión y email verificado que coincida exactamente con el destinatario. No se vincula a nadie por el solo hecho de registrarse o confirmar email.
  - El organizador no puede aprobar la pareja mientras haya integrantes sin aceptar. El capitán puede reenviar desde su inscripción.
  - Resend se llama desde el servidor, no se agrega SDK y no se usa service role. Se configura con `RESEND_API_KEY` y `RESEND_FROM_EMAIL`; el dominio del remitente debe estar verificado. `onboarding@resend.dev` solo sirve para pruebas dirigidas al propietario de la cuenta Resend.
  - Para que cuentas nuevas vuelvan a la aceptación aun si confirman desde otro dispositivo, el template `confirmation.html` conserva el destino de retorno validado por `/auth/confirm`.
- **Motivo:** una inscripción de pareja debe contar con el consentimiento del compañero y avisarle de forma confiable que tiene que aceptar.
- **Cómo aplicar:**
  - Aplicar `20261002000100_team_invitations.sql` como migración nueva; las migraciones previas no se editan.
  - Configurar ambas variables de Resend luego de verificar el dominio. Sin ellas se puede inscribir, pero el capitán debe completar la configuración y reenviar.
  - Actualizar el template remoto Confirm signup copiando `supabase/templates/confirmation.html`.
  - El pgTAP valida permisos, aceptación de un solo uso, coincidencia de email y el bloqueo de aprobación si falta una aceptación.

### D-045 — Inscripción individual y relleno de pruebas local (2026-10-03 · mantenimiento) *(reemplazada por D-046)*
- **Decisión:**
  - En deportes de parejas, una persona puede anotarse individualmente solo después de aceptar explícitamente participar de un sorteo. Las inscripciones quedan en espera, sin crear una pareja ni vincularlas a otra persona hasta que el organizador ejecute el sorteo.
  - El organizador sortea al azar las personas disponibles desde Inscripciones. Se crean equipos pendientes de aprobación; si queda una persona impar, no se puede cerrar la inscripción hasta que se empareje o cancele su espera.
  - En desarrollo local, el organizador puede completar los cupos con equipos ficticios aprobados y marcados como datos de prueba. La acción exige una identidad de Supabase local en la RPC, además de la protección de la Server Action; no se habilita en producción.
  - Los equipos ficticios reciben disponibilidad en todas las franjas para que también se puedan probar la programación automática y los partidos.
  - Los equipos de prueba no tienen integrantes reales ni invitaciones. Los grupos, fixture y cuadro se generan con los flujos existentes.
- **Motivo:** permitir probar el recorrido completo sin crear manualmente muchas cuentas o parejas, y conservar el consentimiento de quien se anota individualmente.
- **Cómo aplicar:**
  - Reemplazada por D-046 antes de aplicar la migración.

### D-046 — Torneos privados de prueba con parejas ficticias (2026-10-03 · mantenimiento)
- **Decisión:** reemplaza a D-045.
  - Al crear un torneo, el organizador puede marcarlo como **privado de prueba**. La marca se asigna atómicamente y no puede activarse sobre un torneo real existente.
  - Los torneos de prueba no aparecen en páginas públicas ni se pueden resolver por código de inscripción. Las RPC y el trigger también bloquean inscripciones reales aunque alguien conozca el código o invoque la API directamente.
  - En Inscripciones, el organizador puede generar parejas ficticias hasta completar el cupo. Quedan aprobadas, tienen disponibilidad en todas las franjas, y se identifican como datos de prueba. Solo se pueden generar en torneos creados con ese modo.
  - Se pueden usar los flujos existentes de grupos, fixture, programación, resultados y playoffs; los datos siguen ocultos a participantes y visitantes.
- **Motivo:** probar el recorrido completo en el proyecto Supabase alojado sin agregar datos inventados a torneos reales ni exponerlos públicamente.
- **Cómo aplicar:**
  - Aplicar `20261003000100_private_test_tournaments.sql` luego de `20261002000100_team_invitations.sql`, que todavía debe aplicarse primero en la base alojada.
  - Crear un torneo nuevo y activar **Crear como torneo privado de prueba**. Los torneos reales existentes no se modifican.
  - En su página de Inscripciones, usar **Completar cupos con parejas ficticias**. Luego seguir con el sorteo de grupos y la generación del fixture/cuadro.
  - El pgTAP `08_test_tournaments` verifica el aislamiento público, el bloqueo de inscripciones reales y la creación/disponibilidad de las parejas ficticias.

### D-047 — Inscripción manual por el organizador (2026-10-03 · mantenimiento)
- **Decisión:**
  - Durante la inscripción abierta, el organizador puede inscribir y aprobar una pareja/equipo ingresando su nombre, los nombres del plantel y las franjas disponibles, sin emails ni cuentas.
  - Los miembros sin cuenta se representan con `team_members.email = null` y `display_name`; el equipo queda marcado `organizer_registered`. No se los invita ni se los vincula automáticamente si luego crean una cuenta.
  - La RPC `create_organizer_team` valida en la base el organizador, estado, tamaño del plantel, franjas del mismo torneo, nombre único y cupo. También funciona en torneos privados de prueba, que siguen excluidos de lecturas públicas.
  - El canal normal de inscripción por código mantiene las invitaciones explícitas de D-044. Los equipos manuales guardan las franjas elegidas y no se consideran ficticios.
- **Motivo:** permitir al organizador anotar participantes de forma presencial o asistida sin crear cuentas ni inventar emails, manteniendo la disponibilidad real para el scheduler.
- **Cómo aplicar:**
  - Aplicar `20261003000200_organizer_team_registration.sql` como migración nueva; no editar migraciones aplicadas.
  - El formulario aparece en Inscripciones mientras el torneo esté abierto. Para cada pareja/equipo se cargan todos los nombres y al menos una franja.
  - El pgTAP `09_organizer_registration` valida permisos, aprobación, nombres, ausencia de emails y persistencia de disponibilidad.

### D-048 — Soporte completo para tema claro, oscuro y del sistema (2026-10-05)
- **Decisión:**
  - Soporte completo para alternar entre tema `"light"` (claro), `"dark"` (oscuro) y `"system"` (según el sistema operativo).
  - Proveedor `ThemeProvider` (`components/theme/theme-provider.tsx`) con sincronización bidireccional en cookie `theme` (1 año) y `localStorage`.
  - Script en `<head>` con `nonce` (compatible con CSP / D-041) para evitar parpadeos (FOUC) antes de la hidratación.
  - Componentes de interfaz:
    - `ThemeToggle` (`components/theme/theme-toggle.tsx`): botón desplegable con menú para elegir Claro, Oscuro o Sistema. Se sumó a `AppHeader`, al header de torneos públicos (`/t/[slug]`), al header de autenticación y a la portada (`/`).
    - `ThemeSelector` (`components/theme/theme-selector.tsx`): botones de selección de tema en `/perfil` (Mi perfil) dentro de una tarjeta dedicada a Apariencia.
  - `Toaster` (`components/ui/sonner.tsx`) adaptado para que las notificaciones respeten el tema activo.
- **Motivo:** pedido explícito del usuario para poder visualizar la app en modo oscuro o claro según su preferencia.
- **Cómo aplicar:** todos los componentes usan las variables de color semánticas de Tailwind / Radix Nova (`globals.css`), cuyas definiciones para `.dark` ya están configuradas. Reemplaza la restricción previa de solo tema claro de D-014.

### D-049 — Super tie-break configurable en puntos y por fase (2026-10-05)
- **Decisión:**
  - **Puntos configurables (`superTiebreakPoints`):** pasa de estar restringido a 7 o 10 a ser un número configurable entre 5 y 30 (`z.number().int().min(5).max(30)`), con **11 como valor predeterminado** para pádel y tenis.
  - **Fase hasta donde aplica (`superTiebreakUntil`):** nuevo enum `["all", "semifinals", "quarterfinals", "groups"]` con etiqueta legible y valor predeterminado `"quarterfinals"` (hasta cuartos de final, estándar en torneos de pádel).
  - **Evaluación contextual de partidos (`evaluateResult`, `isSuperTiebreakMatch`, `isSuperTiebreakSet`):**
    - Admite `MatchStageContext` (`{ stage, round?, totalRounds?, isThirdPlace? }`) o simplemente `MatchStage` conservando retrocompatibilidad.
    - Si `superTiebreakUntil === "quarterfinals"`: en fase de grupos y en playoffs hasta cuartos (`totalRounds - round >= 2`) el 3er set es super tie-break; a partir de semifinales (`totalRounds - round <= 1`) o en partido de 3er puesto se exige 3er set normal completo al mejor de 6 games.
    - Si `superTiebreakUntil === "semifinals"`: semifinales y rondas previas usan super tie-break; la final y el 3er puesto son set completo.
    - Si `superTiebreakUntil === "groups"`: playoffs completos se juegan a sets normales.
    - Si `superTiebreakUntil === "all"`: todo el torneo usa super tie-break como 3er set.
  - **Componentes y acciones actualizadas:**
    - `components/tournaments/config-fields.tsx`: input numérico para puntos y selector descriptivo para la fase límite.
    - `components/matches/result-dialog.tsx`: calcula si el partido/set en cuestión es super tie-break o set regular y ajusta títulos y badges de ayuda contextuales.
    - `components/matches/matches-board.tsx`: pasa la información de ronda, cantidad de rondas de playoff y 3er puesto al diálogo de resultado.
    - `app/(app)/torneos/[id]/partidos/actions.ts`: consulta la ronda y total de rondas al cargar resultados para evaluar correctamente el formato según la fase.
  - **Migración de base de datos:** `supabase/migrations/20261005000100_supertiebreak_config.sql` actualiza los deportes del catálogo (`public.sports`) con los nuevos defaults.
- **Motivo:** requerimiento de torneos reales de pádel donde habitualmente se juega a super tie-break a 11 puntos hasta cuartos de final, pasando a 3 sets normales a partir de semifinales.
- **Cómo aplicar:** siempre pasar el contexto de etapa (`round`, `totalRounds`, `isThirdPlace`) al evaluar resultados o renderizar campos de sets en torneos con formato `super_tiebreak`.

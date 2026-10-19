# Torneos: guía del proyecto

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
  shared/            EmptyState, PageHeader, CollapsibleSection (D-052)
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

### D-035 — Inscripción: código, plantel y disponibilidad (2026-10-01 · F5) *(modificada en UI por D-059)*
- **Decisión:**
  - **"¿Tenés un código?"** está en `/torneos` (se movió de F4 para no dejar un link roto) y normaliza igual que la base (`normalizeInviteCode`).
  - **`/unirse/[code]`** resuelve con `resolve_invite_code` y contempla cuatro casos: código inválido, ya inscripto, inscripción cerrada y cupo lleno.
  - **Nombre sugerido** para parejas: "Apellido / ".
  - **Fútbol 11:** permite pegar la lista de emails (`parseEmailList`).
  - **`/inscripciones/[teamId]`** es solo para integrantes (404 para el resto). El capitán edita y da de baja; los integrantes se pueden salir.
  - **Disponibilidad:** chips con `role="checkbox"` de 48px de alto, "Todo el día", barra fija con contador y aviso `beforeunload` si hay cambios sin guardar. Modificada por D-059 para agrupar en tarjetas de franjas continuas completas.
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

### D-050 — Circuitos y torneos por fechas con ranking individual acumulado (2026-10-06)
- **Decisión:**
  - Nueva entidad `public.circuits` que permite agrupar torneos ("fechas") en un circuito o torneo anual y consolidar un ranking individual acumulado.
  - El organizador define una escala de puntuación personalizable por ronda alcanzada (`points_config`: Campeón, Subcampeón, Semifinales, Cuartos, Octavos, 16avos y Grupos).
  - Cada fecha es un torneo con fixture, grupos y playoffs que se vincula al circuito mediante `circuit_id` y `circuit_order`.
  - El ranking general consolida los puntos individuales de cada jugador (identificado por usuario o nombre), permitiendo que compitan con parejas distintas en cada fecha.
  - Los puntos se calculan automáticamente a partir de la fase eliminatoria máxima alcanzada por su equipo en cada fecha.
  - La tabla general ordena por puntos totales, títulos ganados, fechas jugadas y orden alfabético.
- **Motivo:** soporte para circuitos anuales y ligas multifecha donde los jugadores rotan de compañero pero acumulan puntos en una tabla general.
- **Cómo aplicar:**
  - Aplicar `20261006000100_circuits.sql` en la base de datos Supabase.
  - El organizador gestiona sus circuitos desde la nueva sección **Circuitos** o desde el acceso directo en **Mis torneos**.

### D-051 — Simulación de resultados para torneos privados de prueba (2026-10-06)
- **Decisión:**
  - En torneos creados con el modo privado de prueba (`is_test = true`), el organizador puede simular resultados automáticamente con un solo clic.
  - La función `generateSimulatedMatchResult` (`lib/domain/scoring.ts`) genera marcadores válidos y realistas según el sistema de puntuación del torneo (sets con games o super tie-break; o goles de fútbol).
  - En fase de grupos: la acción `simulateTournamentResults` simula los partidos pendientes y actualiza la tabla de posiciones del grupo.
  - En playoffs: simula iterativamente ronda por ronda, propagando los ganadores en el cuadro hasta completar la final y coronar al campeón.
  - Se restringe estrictamente a torneos privados de prueba en el backend; en torneos reales no se permite simulación para preservar la integridad de los resultados oficiales.
- **Motivo:** agilizar enormemente las pruebas del organizador (fixture, clasificaciones a playoffs, cuadro y acumulación de rankings en circuitos) sin necesidad de cargar decenas de resultados a mano.
- **Cómo aplicar:** en la pantalla de Partidos o Cuadro de un torneo privado de prueba, usar el botón **Simular resultados** / **Simular playoffs completos**.

### D-052 — Panel del organizador con secciones plegables (2026-10-06 · mantenimiento, piloto)
- **Decisión:**
  - Se suma `CollapsibleSection` (`components/shared/collapsible-section.tsx`), basada en `<details>` nativo, sin dependencias nuevas. Plegada muestra título y un resumen de una línea; el contenido sigue montado, así que los formularios no pierden valores. `forceOpen` la abre si un campo de adentro tiene error.
  - **Resumen del torneo:** el estado y los pasos que faltan (`NextSteps`, que solo informa; las reglas siguen en `checkTransition` y en la base) van siempre visibles. Las cuatro tarjetas de números pasan a una línea. El link y código de inscripción va plegado salvo con la inscripción abierta, y "Eliminar torneo" queda en "Más opciones".
  - **Configuración (solo edición):** "Datos del torneo" queda abierto; "Puntuación", "Tabla de posiciones" y "Playoffs" van plegados con su resumen (`config-summary.ts`). En el alta siguen abiertos.
  - `InviteCard` ya no dibuja su propia tarjeta ni título: los aporta la sección que la contiene. `StatusCard` acepta `children`.
  - No cambia ninguna ruta, regla de negocio, Server Action ni la base.
- **Motivo:** la pantalla mostraba demasiada información a la vez. El objetivo es una app visualmente simple sin perder funciones: todo sigue accesible, solo que hay que desplegarlo.
- **Cómo aplicar:**
  - Un campo dentro de una sección plegada no es visible: los E2E deben abrirla antes (`page.locator("summary", { hasText: "..." }).click()`).
  - Los links de `NextSteps` no se usan a propósito: un link con "Canchas y franjas" en su nombre chocaría con la pestaña homónima en los locators de Playwright.
  - Pendiente (siguientes tandas): Canchas y franjas, Disponibilidad, Inscripciones, Cuadro y agrupar las pestañas por etapa.

### D-053 — Progreso del torneo y navegación agrupada (2026-10-06 · mantenimiento, tanda 1)
- **Decisión:**
  - `TournamentProgress` (`components/tournaments/tournament-progress.tsx`): stepper de 5 etapas (Preparación, Inscripción, Grupos, Playoffs, Final) en el encabezado del panel. Es solo de presentación; el estado lo sigue cambiando `set_tournament_status`. En 360px solo la etapa actual muestra texto; las demás lo conservan para lectores de pantalla.
  - `TournamentNav` pasa de 8 pestañas planas a 5 principales: Resumen, Configuración, Canchas y franjas, **Inscripciones** (sub-secciones Equipos y Disponibilidad) y **Competencia** (Grupos, Partidos y Cuadro). Las rutas no cambian. Las sub-secciones se ven como una segunda barra cuando el grupo está activo.
  - Las pestañas llevan un contador de pendientes (inscripciones pendientes con la inscripción abierta; partidos de grupo sin resultado en `group_stage`).
- **Motivo:** menos elementos a la vista y una sensación clara de avance, sin quitar funciones (continúa D-052).
- **Cómo aplicar:**
  - El primer sub-link de "Inscripciones" se llama "Equipos" para no repetir el nombre del grupo en los locators de Playwright.
  - Desde el Resumen, para llegar a Grupos, Partidos o Cuadro hay que pasar por "Competencia"; los E2E que busquen esos links por nombre deben entrar antes al grupo.
  - Pendiente: tandas 2 a 4 (Canchas y franjas, Disponibilidad, Inscripciones, Competencia y pulido visual).

### D-054 — Asistente de creación de torneos en 4 pasos (2026-10-06 · mantenimiento)
- **Decisión:**
  - El alta (`/torneos/nuevo`) pasa a `TournamentWizard`: **Lo básico** (nombre, deporte, descripción) → **Fechas y cupo** (fechas, zona horaria, cupo, canchas) → **Reglas** (confirmación de resultados, puntuación, tabla y playoffs) → **Revisar y crear** (resumen con "Editar" por fila y el switch de torneo privado de prueba).
  - Un solo formulario de React Hook Form con el mismo esquema Zod y la misma Server Action (`createTournament`). Cada paso valida solo sus campos (`form.trigger`); Enter equivale a "Continuar"; si el envío final falla por un campo de un paso anterior, se vuelve a ese paso.
  - En "Reglas" se dejan los valores recomendados del deporte y los tres bloques van plegados con su resumen (D-052): quien no quiere tocar nada avanza con un clic.
  - Navegación: Cancelar (paso 1), Volver, Continuar y Crear torneo; los pasos completados del indicador (`WizardSteps`, en `components/shared`) son clicables. Al cambiar de paso el foco va al título.
  - Se extrajeron `tournament-fields.tsx` (campos comunes) y `rules-sections.tsx` (puntuación, tabla, playoffs) para compartirlos con la edición; `TournamentForm` queda solo para editar.
- **Motivo:** el alta mostraba ~20 campos juntos. Guiar por pasos, con progreso y revisión final, evita que el usuario se pierda sin quitar ninguna opción.
- **Cómo aplicar:**
  - Los E2E que crean torneos avanzan con "Continuar" (la puntuación se abre con `summary` antes de editarla).
  - No hay borrador a medio crear: si se abandona el asistente, se pierde lo cargado; el torneo se crea recién al final.

### D-055 — Guía de fase en el Resumen del torneo (2026-10-06 · mantenimiento, tanda 2)
- **Decisión:**
  - `PhaseGuide` reemplaza a `StatusCard` y `NextSteps` (se eliminaron) en el Resumen. Una sola tarjeta muestra "Fase N de 5", el título de la fase, una **barra de progreso** (`role="progressbar"`), la checklist de pasos y la acción que hace avanzar el torneo con sus diálogos de confirmación y motivos de bloqueo de siempre.
  - Cada paso pendiente lleva un botón "Ir a…" a la pantalla donde se resuelve; los hechos se marcan con check. No se duplican acciones del torneo en el Resumen: solo se navega a la pestaña correspondiente.
  - El modelo es puro (`phase-guide-model.ts`, `buildPhaseGuide`): pasos por fase y progreso. El progreso es lo más concreto disponible: aprobadas/cupo en inscripción, partidos jugados/total en grupos y playoffs, y pasos hechos en preparación. Las reglas de cada transición siguen en `checkTransition` y en la base.
  - `getTournamentCounts` suma `unscheduledGroupMatches`, `playoffMatches` y `pendingPlayoffMatches`.
  - El stepper del encabezado muestra el progreso junto a la fase actual ("Grupos 12/24") y la pestaña de la fase actual lleva un punto de "recomendada". Ninguna pestaña se oculta.
  - La línea de números del Resumen se eliminó: cada dato vive en el detalle de su paso.
- **Motivo:** el seguimiento tiene que ser tan guiado como la creación (D-054): dónde estoy, qué completé, qué falta y cuál es el siguiente paso.
- **Cómo aplicar:**
  - Los textos de acción de los pasos no repiten el nombre de ninguna pestaña ("Ir a equipos", "Ir a franjas"): Playwright busca links por subcadena y chocaría con las pestañas.
  - Un paso nuevo en una fase se agrega en `stepsFor`; lo demás se arma solo.
  - Pendiente: tandas de Canchas y franjas, Disponibilidad, Inscripciones y Competencia (D-052/D-053), y el pulido visual.

### D-056 — Identidad visual: logo de la copa con fondo dorado, silueta negra y destello brillante (2026-10-06)
- **Decisión:**
  - Se crea el componente reutilizable `TrophyLogo` (`components/brand/trophy-logo.tsx`) para la identidad visual de la marca junto al texto "Torneos".
  - Fondo: placa dorada con gradiente metálico pulido (`#FDE68A` -> `#F59E0B` -> `#D97706`), anillo exterior ámbar y sombra suave.
  - Copa: silueta negra contrastante (`text-zinc-950`).
  - Animación: haz de luz blanco diagonal (`animate-trophy-shine`) que recorre la copa periódicamente cada 3.2s, con soporte para `prefers-reduced-motion`.
  - Integrado de forma unificada en `AppHeader`, `AuthLayout`, `PublicLayout` y `HomePage`.
- **Motivo:** elevar la presencia visual y estética premium del logotipo en toda la plataforma.

### D-057 — Etiquetas visuales de deporte con emoji identificatorio (2026-10-06)
- **Decisión:**
  - Se crea el componente `SportBadge` (`components/tournaments/sport-badge.tsx`) para mostrar el deporte como una insignia destacada con su emoji correspondiente (🎾 para pádel y tenis, ⚽ para fútbol, 🏀 para básquetbol, 🏐 para vóley, 🏑 para hockey, etc.).
  - Estilos temáticos sutiles por deporte con buen contraste tanto en tema claro como oscuro (dark mode).
  - Integrado en las tarjetas de torneos del organizador y del jugador (`OrganizedTournamentCard`, `ParticipationCard`), encabezado del panel de administración (`/torneos/[id]`), vista pública del torneo (`/t/[slug]`), detalle de inscripción (`/inscripciones/[teamId]`) y tarjetas/detalle de circuitos.
- **Motivo:** reemplazar el texto plano secundario por una etiqueta visual distintiva análoga a las etiquetas de estado del torneo.

### D-058 — Simplificación de navegación superior y acceso a Perfil (2026-10-07)
- **Decisión:**
  - Se elimina el enlace redundante "Torneos" de la barra de navegación principal (`MainNav`), ya que el isotipo/logotipo de la marca ya dirige a la vista principal de torneos.
  - Se remueve la pestaña directa "Perfil" tanto del menú principal de escritorio como de la barra inferior mobile (`BottomNav`). El acceso a Perfil queda centralizado y accesible exclusivamente a través del menú de usuario (`UserMenu` / avatar con foto).
- **Motivo:** reducir la redundancia visual en la barra de navegación y alinear el acceso al perfil con los estándares de diseño modernos.
- **Cómo aplicar:** `nav-items.ts` centraliza los ítems de navegación excluyendo perfil; `user-menu.tsx` mantiene el link directo a `/perfil`.

### D-059 — Disponibilidad y franjas en intervalos completos continuos (2026-10-07)
- **Decisión:**
  - **Agrupación en el dominio:** `lib/domain/availability.ts` incorpora `groupDaySlotsIntoWindows` y `groupSlotsIntoDayWindows` (con tolerancia entre turnos de hasta 45 min). Agrupa los turnos individuales de juego en intervalos o franjas completas continuas (ej. 09:00 a 15:00 o 18:00 a 22:00).
  - **Selección de disponibilidad:** en `AvailabilityPicker` y `OrganizerRegistrationForm`, los participantes y el organizador seleccionan franjas horarias como bloques completos en lugar de intervalos específicos de 1 hora. Marcar una franja asocia automáticamente todos sus turnos internos atómicos en la base de datos (`team_availability`), asegurando que el programador automático (`scheduleMatches` / `runAutoSchedule`) mantenga los datos exactos para agendar partidos sin solapamientos.
  - **Visualización y reportes:** la página de disponibilidad (`/torneos/[id]/disponibilidad`) resume y totaliza los cruces por franja completa en lugar de turnos fragmentados.
  - **Gestor de franjas del organizador:** `SlotsManager` agrupa los turnos por franja con botón para borrar el intervalo completo en un clic, permitiendo desplegar los turnos individuales de juego mediante un acordeón para inspección o ajuste puntual.
- **Motivo:** simplificar la experiencia de usuario de los jugadores al declarar disponibilidad, permitiéndoles marcar ventanas horarias reales sin tener que seleccionar decenas de botones de una hora.
- **Cómo aplicar:** la base de datos conserva `time_slots` por turno de partido; toda la agregación y desagregación ocurre de forma transparente en el dominio y en la UI.

### D-060 — Cuadro proyectado automático y carga de resultados in-situ (2026-10-07)
- **Decisión:**
  - **Cuadro proyectado automático:**
    - Apenas se crean los grupos (`groups.length >= 2`), el cuadro de playoffs se vuelve inmediatamente visible tanto en el panel de administración (`/torneos/[id]/cuadro`) como en la vista pública (`/t/[slug]`), eliminando la necesidad de que el organizador deba generar o configurar el cuadro manualmente.
    - Se muestran los cruces predeterminados con etiquetas de siembra (ej. `[1A]` vs `[2F]`). A medida que se disputan los partidos de la fase de grupos, `buildProjectedBracket` y `buildTeamSeedMap` (`lib/competition-view.ts`) calculan y proyectan en tiempo real los nombres de las parejas según la tabla de posiciones en vivo (marcando el badge `prov.` mientras la fase de grupos siga en curso).
    - Al pasar el torneo a la etapa `playoffs` (`changeTournamentStatus`), la función de servidor `ensurePlayoffBracket` persiste automáticamente el cuadro oficial mediante la RPC `apply_bracket` y agenda la primera ronda en las canchas disponibles.
  - **Carga de resultados in-situ en el cuadro:**
    - `BracketView` (`components/bracket/bracket-view.tsx`) pasa a ser Client Component y soporta carga de marcadores en tiempo real.
    - Cada tarjeta de partido de playoff jugable (`canScore`) incorpora un botón de acción directa ("Cargar resultado" o "Editar").
    - Al hacer clic, se abre inmediatamente el modal `ResultDialog` en el lugar exacto del cuadro, eliminando la necesidad de bajar o hacer scroll hacia la lista de partidos.
    - La carga valida el formato (sets, super tie-break o goles), guarda mediante la Server Action `saveMatchResult`, propaga el ganador a la siguiente ronda (y perdedor al 3er puesto si aplica) y refresca el árbol del cuadro en el momento.
    - En `/torneos/[id]/cuadro`, la tabla de partidos (`MatchesBoard`) se presenta dentro de una sección desplegable (`CollapsibleSection`) al pie de página, manteniéndose disponible para asignar horarios y canchas sin interferir con la experiencia del cuadro.
- **Motivo:** simplificar radicalmente la gestión del torneo, eliminando pasos manuales de generación de playoffs y evitando el desplazamiento innecesario para cargar resultados de las llaves eliminatorias.
- **Cómo aplicar:** `BracketView` recibe `tournamentId`, `scoring` y `canEdit`; `ensurePlayoffBracket` es idempotente y garantiza que el cuadro exista en la base al entrar en playoffs.

### D-061 — Afiche o portada informativa del torneo con visor ampliado (2026-10-07)
- **Decisión:**
  - **Columna y almacenamiento:**
    - Se agrega `banner_url text check (banner_url is null or (banner_url ~ '^https?://' and char_length(banner_url) <= 2048))` a `public.tournaments` con permiso de actualización para usuarios autenticados (`grant update (banner_url)`).
    - Se crea el bucket `tournament-media` en Supabase Storage con límite de 5 MB por archivo y tipos permitidos (`image/png`, `image/jpeg`, `image/webp`, `image/gif`).
    - Políticas RLS en `storage.objects`: lectura pública universal y subida/actualización/eliminación para organizadores autenticados.
    - Se habilita `supabase.origin` en la directiva `img-src` de CSP (`lib/security/csp.ts`) para permitir la carga segura de imágenes desde Supabase Storage.
  - **Experiencia de usuario y visor lightbox:**
    - En la vista pública del torneo (`/t/[slug]`), el afiche se ubica como banner destacado debajo del encabezado (`TournamentBanner`). Cuenta con adaptación visual que previene cortes indeseados de texto y auspiciantes.
    - Al hacer clic o presionar la imagen, se abre un visor modal (`Dialog`) en alta resolución y pantalla completa, con botón para abrir la imagen original y opción de guardarla.
    - En el panel del organizador (`/torneos/[id]`), se incluye `TournamentBannerManager` dentro de una sección plegable (`CollapsibleSection`). Permite arrastrar o seleccionar archivos PNG, JPG o WEBP, previsualizar la imagen y cambiarla o eliminarla con confirmación (`ConfirmActionButton`).
    - La acción de servidor `updateTournamentBanner` actualiza la URL y purga de inmediato la caché pública con `refreshPublicTournament`.
- **Motivo:** permitir al organizador exhibir afiches promocionales, cronogramas gráficos o imágenes informativas con sponsors, ofreciendo a los participantes la posibilidad de ver el contenido en tamaño grande con un solo toque.
- **Cómo aplicar:** aplicar migración `20261008000100_tournament_banner.sql`; `TournamentBanner` se monta de forma condicional si `tournament.bannerUrl` no es nulo.

### D-062 — Vista enriquecida de invitación por email con afiche, datos del torneo y del compañero (2026-10-07)
- **Decisión:**
  - **Resolución segura de invitaciones (`public.resolve_team_invitation`):**
    - Se crea la función RPC `public.resolve_team_invitation(p_token_hash text)` en `supabase/migrations/20261008000200_resolve_team_invitation.sql` con `security definer`.
    - Resuelve y expone los metadatos de la invitación a partir del hash SHA-256 del token: email del destinatario, nombre del equipo, nombre del compañero/capitán (`profiles.full_name` con fallback a email), nombre del torneo, slug, deporte, fechas, descripción, `banner_url`, estado del torneo y si está expirada.
    - Otorga privilegios de ejecución a `anon, authenticated` (`07_function_privileges`), permitiendo que el jugador invitado pueda conocer los detalles del evento antes de iniciar sesión o registrarse.
  - **Pantalla `/invitacion/aceptar` enriquecida:**
    - **Afiche oficial con lightbox:** si el organizador subió un flyer (`banner_url`), se despliega en la parte superior mediante `<TournamentBanner>` con visor modal a pantalla completa en alta definición.
    - **Metadatos del torneo:** badges de deporte y estado, título, rango de fechas, descripción del organizador y enlace a la vista pública del torneo.
    - **Tarjeta del compañero que invita:** destaca con claridad quién envió la invitación y el nombre de la pareja/equipo a conformar (ej. *"Lucas Gómez te invitó a formar parte del equipo Gómez / Martínez"*).
    - **Flujo de confirmación y seguridad:**
      - Si el usuario tiene sesión activa con el email destinatario: botón prominente `AcceptTeamInvitationButton` para confirmar y acceder directo al equipo (`/inscripciones/[teamId]`).
      - Si no está logueado: opciones de "Iniciar sesión para aceptar" y "Crear cuenta con este email" conservando el parámetro `next`.
      - Si está conectado con otro correo: advertencia visual clara indicando que la invitación fue enviada a otra dirección, con opción de cambiar de cuenta.
      - Si el link caducó o ya fue aceptado: estados amigables que guían al usuario sin errores crípticos.
- **Motivo:** brindar una experiencia transparente y profesional al integrante invitado cuando abre el enlace desde su correo, mostrándole toda la información del torneo, su afiche y su compañero antes de solicitarle aceptar.
- **Cómo aplicar:** aplicar la migración `20261008000200_resolve_team_invitation.sql` en Supabase; la pantalla `/invitacion/aceptar` detecta automáticamente el token de la URL y resuelve la invitación.

### D-063 — Sorteo de grupos considerando la disponibilidad horaria de las parejas (2026-10-08)
- **Decisión:**
  - **Sorteo inteligente en el dominio (`drawGroups` en `lib/domain/groups.ts`):**
    - La función `drawGroups` acepta opcionalmente la disponibilidad de los equipos (`availability?: Readonly<Record<string, readonly string[]>>`).
    - Al sortear los grupos, detecta incompatibilidades horarias: si dos parejas indicaron disponibilidad pero no comparten ninguna franja horaria en común (intersección vacía de `slotIds`), se consideran incompatibles y el algoritmo evita que queden en el mismo grupo.
    - El algoritmo optimiza mediante asignación voraz aleatorizada con múltiples intentos (`RESTARTS = 40`) y búsqueda local de intercambios 2-opt, minimizando a 0 los cruces sin franja común y maximizando el solapamiento de horarios entre las parejas de cada grupo.
    - Se mantiene el tamaño balanceado de los grupos (difieren a lo sumo en 1 equipo) y la reproducibilidad determinística mediante el generador pseudoaleatorio con semilla (`createRng(seed)`).
    - Si no se pasa disponibilidad o los equipos no cargaron franjas, se mantiene el sorteo aleatorio clásico sin interrupciones.
  - **Detección y alerta de cruces (`getGroupAvailabilityConflicts` en `lib/domain/groups.ts`):**
    - Evalúa las parejas de cada grupo y reporta cruces entre equipos que no comparten ninguna franja horaria disponible.
  - **Integración en la interfaz de usuario (`GroupBuilder` y `/torneos/[id]/grupos`):**
    - `GroupsPage` carga las franjas horarias y disponibilidad de los equipos mediante `getSchedulingData(tournament.id)` y las suministra a `<GroupBuilder>`.
    - Al presionar "Sortear" o cambiar la cantidad de grupos, se ejecuta el sorteo considerando las franjas cargadas por las parejas.
### D-064 — Torneos Integrados: Múltiples Categorías con Programación Cruzada de Canchas (2026-10-08)
- **Decisión:**
  - **Concepto de Torneo Integrado:**
    - Un torneo puede contener múltiples categorías (ej. "+10 Caballeros", "6ta Caballeros", "8va Damas"), compartiendo las mismas canchas e instalaciones durante las mismas fechas.
    - Todas las categorías comparten el mismo pool de canchas (`courts`) y franjas horarias (`time_slots`).
    - Los partidos de distintas categorías se alternan y combinan en las mismas canchas (ej. Cancha 1 a las 10:00 recibe un cruce de 6ta Caballeros y a las 11:00 un cruce de 4ta Femenino) sin colisiones de horario ni de cancha.
  - **Modelo de Datos y Restricciones (`20261008000300_integrated_tournament_categories.sql`):**
    - Tabla `tournament_categories`: `(id, tournament_id, name, position, status, max_teams, scoring_config, standings_config, playoff_config, champion_team_id)`.
    - Columna `category_id` agregada con `references tournament_categories(id)` en `teams`, `tournament_groups` y `matches`.
    - Restricción por jugador: se mantiene la restricción de que cada jugador solo puede inscribirse en una única categoría dentro del mismo torneo (`unique (tournament_id, email)`).
    - Retrocompatibilidad absoluta: `category_id` es nullable; torneos sin categorías funcionan exactamente igual que antes.
    - RPCs `register_team`, `apply_groups`, `apply_bracket` y nueva RPC `set_category_status` para transición de estados por categoría.
  - **Inscripción Unificada:**
    - El torneo cuenta con un único link y código de invitación unificado (`/unirse/[code]`).
    - Al inscribirse, el capitán elige la categoría correspondiente.
    - El organizador puede inscribir parejas manualmente indicando la categoría y filtrar las inscripciones aprobadas/pendientes por categoría.
  - **Administración y Ciclo de Vida Independiente (`/torneos/[id]/categorias`):**
    - Pestaña "Categorías" en el menú del organizador con gestión completa (CRUD y presets habituales de pádel).
    - Cada categoría avanza de fase de forma independiente (ej. 6ta Caballeros puede estar en playoffs mientras 8va Damas está en grupos).
  - **Sorteos y Tablas Independientes (`/torneos/[id]/grupos` y `/torneos/[id]/cuadro`):**
    - Píldoras de selección de categoría (`<CategoryTabs>`).
    - Cada categoría sortea sus grupos aplicando el algoritmo consciente de disponibilidad horaria (D-063) y calcula sus posiciones de forma aislada.
    - Cada categoría proyecta y juega su cuadro de playoffs con su propio campeón.
  - **Tablero de Partidos y Fixture Público con Visualización Cruzada:**
    - El tablero del organizador (`/torneos/[id]/partidos`) y el fixture público (`/t/[slug]`) muestran todos los partidos asignados a las canchas con badges de categoría (ej. `[6TA CAB]`, `[4TA FEM]`).
    - Se ofrece un filtro por categoría que permite alternar entre la vista global de las canchas del club y el cronograma de una categoría específica.
- **Motivo:** permitir organizar eventos multizona y multicategoría habituales en circuitos de pádel manteniendo una única fecha, sede y programación física de canchas.
- **Cómo aplicar:** ejecutar la migración `20261008000300_integrated_tournament_categories.sql` en Supabase; los torneos existentes continúan funcionando sin cambios y los nuevos pueden habilitar categorías desde la pestaña "Categorías".

### D-065 — Auto-aprobación de parejas inscriptas por el organizador y aprobación directa (2026-10-08)
- **Decisión:**
  - **Auto-aprobación por organizador:** cuando quien inscribe una pareja es el organizador del torneo (tanto desde el formulario de la pestaña Inscripciones como desde el link de inscripción por código `/unirse/[code]`), la pareja se da de alta automáticamente como aprobada (`status = 'approved'`, `organizer_registered = true`), sin quedar en estado pendiente ni requerir pasos adicionales.
  - **Inscripción múltiple del organizador:** el organizador puede anotar múltiples parejas en cualquiera de las categorías del torneo sin ser bloqueado por la regla de inscripción única de jugador.
  - **Asignación atómica de categoría en inscripción manual:** `create_organizer_team` recibe `p_category_id` y lo persiste directamente al crear el equipo en la base de datos, validando el cupo de la categoría.
  - **Aprobación directa en gestión de inscripciones:** en `RegistrationsList` y en la RPC `review_registration`, el organizador puede aprobar manualmente cualquier inscripción pendiente en cualquier momento, sin quedar bloqueado por invitaciones pendientes de compañeros.
- **Motivo:** agilizar la carga del torneo para el organizador y evitar inconsistencias donde parejas inscriptas por la administración quedaban esperando una aprobación que nadie podía ejecutar.
- **Cómo aplicar:** aplicar `20261008000400_auto_approve_organizer_registration.sql` en el SQL Editor de Supabase.

### D-066 — Asignación y migración de parejas a categorías y resiliencia en sorteo (2026-10-08)
- **Decisión:**
  - **Fallback automático para torneos con 1 categoría:** en consultas de competencia y listado de parejas (`getCompetition` y `listTournamentTeams`), si el torneo tiene una única categoría, las parejas sin categoría asignada se asocian automáticamente a ella para que aparezcan de inmediato en el sorteo de grupos y en la pestaña correspondiente.
  - **Gestión de categorías en Inscripciones:** selector desplegable en cada tarjeta de pareja en `RegistrationsList` y banner de asignación masiva para vincular parejas huérfanas con un solo clic.
  - **Resiliencia en el sorteo de grupos:** `GroupBuilder` previene errores de rango si hay menos de 2 parejas, deshabilita el botón de sorteo y muestra alertas claras guiando al organizador.
  - **RPCs y migración en base de datos:** `assign_team_category`, `assign_tournament_teams_category` y actualización de `apply_groups` para auto-asignar parejas en torneos de categoría única.
- **Motivo:** evitar que parejas inscriptas queden invisibles o figuren 0 inscriptos al intentar sortear los grupos.
- **Cómo aplicar:** aplicar `20261008000500_assign_team_category_and_backfill.sql` en el SQL Editor de Supabase.

### D-067 — Responsividad en canchas/franjas y distinción visual en verde para días y franjas seleccionadas (2026-10-12)
- **Decisión:**
  - **Días seleccionados en verde:** en `SlotGenerator` (y `SingleSlotForm`), los chips de días seleccionados para crear las franjas horarias se muestran con fondo y borde verde esmeralda (`bg-emerald-600 text-white border-emerald-600`) y con icono de tilde (`Check`), eliminando la ambigüedad del estado activo anterior (gris sutil) para que sea inmediatamente evidente qué días están incluidos. Se incorpora además el botón de acción rápida "Seleccionar todos" / "Deseleccionar todos".
  - **Franjas disponibles en verde:** en `AvailabilityPicker` y `OrganizerRegistrationForm`, las franjas horarias marcadas como disponibles adoptan el mismo color verde esmeralda para una experiencia unificada y clara.
  - **Responsividad y prevención de solapamientos ("opciones que se pisan"):**
    - En `SlotsManager`, los pares de inputs ("Desde"/"Hasta" y "Duración de cada partido"/"Pausa entre partidos") se configuran con rejilla adaptable `grid-cols-1 sm:grid-cols-2 gap-3` para evitar que los textos largos y selectores se aprieten o desalineen en resoluciones móviles.
    - Las pestañas ("Generar en lote" y "Agregar una") en mobile se expanden como control segmentado a lo ancho (`w-full grid grid-cols-2 sm:w-fit`).
    - En el listado de franjas (`SlotList`), la cabecera de cada franja y sus acciones ("Ver turnos" y borrar) se reorganizan en disposición vertical en mobile y horizontal en pantallas grandes (`flex-col sm:flex-row`), evitando que los badges, horarios y botones de acción colisionen. Dentro de los turnos individuales, los nombres de canchas y horarios cuentan con truncado y envoltura segura.
    - En la vista principal (`/torneos/[id]/canchas-franjas`), se ajusta la rejilla a `grid-cols-1 xl:grid-cols-[2fr_3fr]` y el formulario de canchas (`CourtForm`) a `grid-cols-1 md:grid-cols-[1fr_1fr_auto]` para garantizar espacio adecuado en tablets y notebooks.
- **Motivo:** solucionar problemas de visualización en pantallas móviles/tablets donde los controles se pisaban y clarificar visualmente la selección de días en el alta de franjas.
- **Cómo aplicar:** cambios aplicados directamente en `slots-manager.tsx`, `courts-manager.tsx`, `availability-picker.tsx`, `organizer-registration-form.tsx` y en la página `/torneos/[id]/canchas-franjas/page.tsx`.

### D-068 — Desambiguación de RPC apply_groups y resiliencia en generación de grupos (2026-10-13)
- **Decisión:**
  - En `saveGroups` (`app/(app)/torneos/[id]/grupos/actions.ts`), enviar `p_category_id: categoryId ?? null` explícitamente para evitar el error de ambigüedad de funciones en PostgREST (`PGRST203: Could not choose the best candidate function`) que ocurre cuando coexisten las firmas de 2 y 3 parámetros con valores por defecto. En caso de bases sin la migración de categorías, se incluye reintento automático con la firma original de 2 parámetros.
  - En `lib/supabase/errors.ts`, se mapean los códigos de PostgREST/PostgreSQL (`PGRST203`, `PGRST202`, `42883`, `42703`, `42P01`) con mensajes descriptivos.
  - Migración `20261013100000_fix_rpc_overloads.sql` para eliminar de la base las funciones obsoletas de 2 parámetros.
- **Motivo:** solucionar el error genérico "No pudimos completar la operación. Probá de nuevo." al confirmar el sorteo de grupos y generar los partidos.
- **Cómo aplicar:** cambios ya aplicados en la app. Si se desea limpiar la base en Supabase, ejecutar en el SQL Editor: `drop function if exists public.apply_groups(uuid, jsonb); drop function if exists public.apply_bracket(uuid, jsonb);`.

### D-069 — Asistente de configuración paso a paso con divulgación progresiva (Wizard / Stepper de Preparación) (2026-10-14)
- **Decisión:**
  - **Asistente continuo de configuración inicial (amplía y conecta D-054 y D-064):**
    - Al crear un torneo en `/torneos/nuevo`, el alta persiste la fila en la base de datos y redirige inmediatamente al paso 2: Categorías (`/torneos/[id]/categorias?asistente=1`).
    - Flujo guiado en 4 etapas:
      1. **Datos del torneo (`/torneos/nuevo`):** creación con datos esenciales y reglas recomendadas plegadas (divulgación progresiva).
      2. **Categorías (`/torneos/[id]/categorias`):** el organizador define las divisiones o niveles que competirán (ej. 6ta Caballeros, 8va Damas), o continúa con categoría general única. Botón directo de avance: *"Siguiente paso: Franjas horarias →"*.
      3. **Franjas horarias (`/torneos/[id]/canchas-franjas`):** el organizador verifica las canchas y genera los turnos de juego en lote. Botón directo de avance: *"Siguiente paso: Inscripciones →"*.
      4. **Inscripciones (`/torneos/[id]/inscripciones`):** incluye el componente `OpenRegistrationCard` para abrir la inscripción al público en 1 clic directamente desde la pantalla de inscripciones sin tener que volver al Resumen. Despliega el link y código para compartir (`InviteCard`), permitiendo además anotar parejas de forma manual o de prueba.
  - **Componente Stepper (`TournamentSetupStepper`):**
    - Muestra los 4 pasos secuenciales con numeración, tildes de completado, estado activo y enlaces interactivos para volver a pasos completados.
    - Tarjeta contextual explicativa que reporta el estado actual (ej. cantidad de categorías creadas, franjas horarias listas, estado de inscripción) y los botones para avanzar o volver.
    - Se despliega automáticamente en las páginas de preparación (`categorias`, `canchas-franjas`, `inscripciones` y `resumen`) mientras el torneo esté en borrador o con el parámetro `?asistente=1`.
  - **Divulgación progresiva en la navegación (`TournamentNav`):**
    - Durante el estado de borrador (`status === "draft"`), la pestaña "Competencia" (Grupos, Partidos, Cuadro) se mantiene oculta para evitar abrumar al usuario con secciones vacías que no aplican a la fase de preparación.
  - **Guía de fase (`phase-guide-model.ts`):**
    - La fase de preparación (`draft`) incorpora "Configurar categorías" como primer paso obligatorio/recomendado junto a la carga de canchas y franjas.
- **Motivo:** guiar al organizador en una experiencia fluida, clara y asistida desde la creación hasta la apertura de inscripciones, aplicando divulgación progresiva para mostrar solo lo necesario en cada momento.
- **Cómo aplicar:** cambios integrados en `tournament-wizard.tsx`, `tournament-setup-stepper.tsx`, `open-registration-card.tsx`, `tournament-nav.tsx`, `phase-guide-model.ts` y en las pantallas `/categorias`, `/canchas-franjas`, `/inscripciones` y `/torneos/[id]`.

### D-070 — Cuadros adaptativos por categoría y soporte para llaves directas (final de 2 parejas en zonas únicas) (2026-10-14)
- **Decisión:**
  - **Soporte para categorías de grupo único (zona única):**
    - En categorías con 1 solo grupo donde clasifican 2 parejas, el cuadro se adapta para conformar directamente la **Final** (1 ronda: 1° vs 2°). Si clasifican 4 de un grupo único, conforma semifinales clásicas (1° vs 4°, 2° vs 3°) y final.
    - Se elimina la restricción que requería tener al menos 2 grupos (`groups.length < 2`) que impedía proyectar o mostrar el cuadro en categorías de grupo único en `/torneos/[id]/cuadro`, `lib/competition-view.ts` (`buildProjectedBracket`), `BracketGenerator` y en la vista pública `/t/[slug]`. Ahora se proyecta y visualiza correctamente siempre que exista al menos 1 grupo y al menos 2 clasificados.
  - **Acomodación de siembra sin penalizaciones cruzadas en grupo único (`lib/domain/bracket.ts`):**
    - En `placeSeeds`, se verifica si los clasificados pertenecen a múltiples grupos (`hasMultipleGroups`). Si provienen de un grupo único (o zona única), se omiten las penalizaciones de enfrentamiento del mismo grupo, preservando el ordenamiento natural de siembra deportiva (1° vs 2° en final directa, o 1° vs 4° y 2° vs 3° en semis).
  - **Aislamiento y configuración independiente de playoffs por categoría:**
    - Al pasar una categoría a playoffs (`changeCategoryStatus`), se invoca automáticamente `ensurePlayoffBracket` con su `categoryId` específico.
    - Cuando `ensurePlayoffBracket` se ejecuta sin `categoryId` en un torneo integrado con categorías, itera y asegura el cuadro de cada categoría individualmente para no mezclar zonas o clasificados entre categorías dispares.
    - En la vista del cuadro (`cuadro/page.tsx`), en la vista de grupos (`grupos/page.tsx`) y en la página pública (`/t/[slug]`), se utilizan las configuraciones de puntuación, desempate y playoffs de la categoría activa (`activeCategory.playoffConfig`, `scoringConfig`, `standingsConfig`), aplicando un mínimo adaptativo de 2 clasificados si la categoría tiene grupo único para asegurar la disputa de la final.
- **Motivo:** permitir torneos con categorías heterogéneas (por ejemplo, dos categorías con 2 grupos que clasifican a 4 parejas arrancando en semifinales, y una categoría con 1 grupo que clasifica a 2 parejas arrancando directamente en la final).
- **Cómo aplicar:** cambios aplicados en `bracket.ts`, `competition-view.ts`, `cuadro/page.tsx`, `cuadro/actions.ts`, `categorias/actions.ts`, `grupos/page.tsx`, `t/[slug]/page.tsx`, `bracket-generator.tsx` y cubiertos con tests unitarios en `bracket.test.ts`.

### D-071 — Cupos máximos por categoría y formato de 4 parejas (GSL / clasifican 3 a playoffs) (2026-10-14)
- **Decisión:**
  - **Cupos máximos configurables por categoría (`maxTeams`):**
    - En el alta de categorías (`CategoriesManager`), se expone el campo de cupo máximo con selector de atajos rápidos (`[4, 8, 12, 16, 24, 32] parejas`).
    - Nuevo diálogo modal `EditCategoryDialog` (accesible mediante botón con icono de lápiz en cada fila de categoría) que permite actualizar en cualquier momento el nombre y el cupo máximo de la categoría (`updateCategory` en `categorias/actions.ts`), validando que el nuevo cupo nunca sea inferior a la cantidad de parejas aprobadas vigentes.
  - **Formato especial de 4 parejas por grupo (GSL / Doble eliminación simplificada):**
    - **Estructura de partidos:** en grupos de 4 parejas se juegan exactamente 4 partidos (cada pareja juega 2 partidos en total):
      - **Fecha 1:**
        - Partido 0 (pos 0): Pareja 0 vs Pareja 1.
        - Partido 1 (pos 1): Pareja 2 vs Pareja 3.
      - **Fecha 2:**
        - Final de Grupo (pos 0): Ganador Partido 0 vs Ganador Partido 1. Quien gana queda 1° del grupo y quien pierde queda 2° del grupo.
        - Duelo por el 3° puesto (pos 1): Perdedor Partido 0 vs Perdedor Partido 1. Quien gana queda 3° del grupo y clasifica a playoffs; quien pierde queda 4° y resulta eliminado.
    - **Generación en persistencia (`saveGroups` en `grupos/actions.ts`):**
      - `apply_groups` inserta la Fecha 1 con las parejas definidas. Inmediatamente después, `saveGroups` inserta los 2 partidos de Fecha 2 con `home_team_id: null` y `away_team_id: null`.
    - **Avance automático de parejas (`recordResult` en `partidos/actions.ts`):**
      - Al cargar el resultado de un partido de Fecha 1, el ganador se ubica dinámicamente en el partido de ganadores (pos 0) y el perdedor en el de perdedores (pos 1).
      - Si ambos equipos del partido de Fecha 2 ya están definidos y el partido no tiene turno asignado, el programador automático (`runAutoSchedule`) intenta programarlo de inmediato.
    - **Consistencia y borrado (`clearResult` en `partidos/actions.ts`):**
      - Si se intenta borrar un resultado de Fecha 1 y el partido de Fecha 2 ya tiene resultado registrado, se bloquea la operación con advertencia explicativa. Al borrar Fecha 1, se remueven de Fecha 2 los equipos que habían avanzado.
    - **Simulación en modo prueba (`simulateTournamentResults` en `partidos/actions.ts`):**
      - La simulación de fase de grupos opera en bucle secuencial, completando primero la Fecha 1, propagando los cruces de ganadores y perdedores, y simulando luego la Fecha 2.
    - **Cómputo de tabla de posiciones (`computeStandings` en `lib/domain/standings.ts`):**
      - Los grupos de 4 parejas identifican el formato GSL:
        - 1°: Ganador de Fecha 2 Pos 0 (Ganadores).
        - 2°: Perdedor de Fecha 2 Pos 0 (Ganadores).
        - 3°: Ganador de Fecha 2 Pos 1 (Perdedores).
        - 4°: Perdedor de Fecha 2 Pos 1 (Perdedores, eliminado).
      - Mientras la Fecha 2 esté pendiente, los 2 ganadores de Fecha 1 ocupan los puestos 1-2 y los 2 perdedores los puestos 3-4 según criterios convencionales.
    - **Clasificación a playoffs y visualización (`lib/competition-view.ts`, `StandingsTable`, `buildProjectedBracket`, `BracketGenerator`):**
      - Los grupos de 4 clasifican exactamente a 3 parejas a playoffs (`qualifiersFromStandings` y `buildTeamSeedMap` con `effectiveQualifiers = 3`, asignando semillas `1A`, `2A`, `3A`).
      - La tabla de posiciones (`StandingsTable`) resalta en verde los 3 primeros puestos en grupos de 4 parejas.
      - En el cuadro eliminatorio proyectado y final (`buildProjectedBracket` y `buildBracket`), los 3 clasificados se acomodan en el cuadro con byes para los mejores sembrados cuando corresponda (ej. 3 clasificados en un grupo único disputan semifinales con bye para el 1° directo a la final; 6 clasificados de dos grupos de 4 disputan cuartos de final con byes para los 1°).
      - Etiquetas amigables en el tablero y fixture: `Final (1° y 2° puesto)` y `Duelo 3° puesto (Pasa a playoff)`, con marcadores de posición `"Ganador P1"` / `"Ganador P2"` y `"Perdedor P1"` / `"Perdedor P2"` mientras no estén definidos.
- **Motivo:** implementar el formato estándar de padel para grupos de 4 parejas donde 3 avanzan a playoffs y cada pareja juega exactamente 2 partidos, y permitir configurar y editar los cupos máximos por categoría.
- **Cómo aplicar:** cambios aplicados en `round-robin.ts`, `standings.ts`, `competition-view.ts`, `grupos/actions.ts`, `partidos/actions.ts`, `categorias/actions.ts`, `categories-manager.tsx`, `edit-category-dialog.tsx`, `group-builder.tsx`, `grupos/page.tsx`, `t/[slug]/page.tsx`, `bracket-generator.tsx`, con tests unitarios en `round-robin.test.ts`, `standings.test.ts` y `competition-view.test.ts`.

### D-072 — Rediseño UI/UX SaaS del asistente de torneos: microinteracciones, tarjetas táctiles y factor delicia (2026-10-14)
- **Decisión:**
  - **Paleta de color controlada (acento esmeralda deportivo):**
    - Se mantiene una base neutra limpia (fondos `bg-background` y `bg-card` sutiles, bordes tenues `border-border/80`, contrastes tipográficos nítidos tanto en modo claro como en modo oscuro).
    - Un solo color de acento deportivo vibrante (verde esmeralda eléctrico: `emerald-600` / `emerald-500` con rings tenues `emerald-500/20` y fondos con gradiente o tinte translúcido `emerald-500/[0.04]`).
    - Uso estricto del acento:
      1. Botones principales (CTAs primarios de avance, confirmación y apertura de inscripciones).
      2. Indicador de paso activo (`bg-emerald-600 text-white ring-4 ring-emerald-500/25 shadow-sm shadow-emerald-600/30 scale-105 font-bold`) e indicador de pasos completados con check badge esmeralda.
      3. Destellos sutiles (glow/ring) y bordes al seleccionar tarjetas interactivas y chips de cupos o categorías.
  - **Tarjetas interactivas con feedback sensorial (`SportSelector`):**
    - Reemplazo del selector nativo plano por una cuadrícula de tarjetas interactivas táctiles (`hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-200`).
    - Estado seleccionado satisfactorio: borde iluminado en esmeralda, tinte translúcido de fondo, ring de resplandor suave y badge circular de check con microanimación de escala (`animate-scale-in`).
    - Íconos dedicados por deporte (Pádel, Tenis, Fútbol, etc.) y badges descriptivos del formato y reglas recomendadas.
  - **Microinteracciones y transiciones fluidas de pasos:**
    - Transición suave de entrada entre pasos en `TournamentWizard` (`animate-in fade-in-50 slide-in-from-right-3 duration-200` con `key={step}`).
    - Animaciones de hover lift (`hover:-translate-y-0.5`) en chips de atajos rápidos de cupos y categorías en `CategoriesManager` y `EditCategoryDialog`.
    - `TournamentReview` con estética SaaS estilo Linear/Vercel: filas con hover interactivo, bordes redondeados y botones sutiles de edición contextual.
  - **Celebración de finalización y factor delicia (`TournamentCelebrationCard`):**
    - En el paso final de preparación (`/torneos/[id]/inscripciones`), al tener la inscripción abierta o recién completada mediante el asistente, se renderiza una tarjeta de celebración.
    - Trofeo flotante con microanimación suave (`animate-subtle-float` y `animate-pulse-glow`) junto a destello sutil y partículas de confeti animadas (`animate-confetti-particle`).
    - Resumen visual de metas completadas (categorías listas, franjas cargadas, inscripción abierta) y botón de acción rápida para copiar el enlace de invitación con feedback táctil inmediato.
    - Soporte integral de accesibilidad y `prefers-reduced-motion` en `globals.css` para respetar preferencias de movimiento reducido del usuario.
- **Motivo:** elevar drásticamente la calidad visual y la experiencia sensorial del asistente de torneos para alcanzar el estándar de un producto SaaS moderno de alta gama (Tailwind/Vercel/Linear).
- **Cómo aplicar:** implementado en `app/globals.css`, `components/tournaments/sport-selector.tsx`, `components/shared/wizard-steps.tsx`, `components/tournaments/tournament-setup-stepper.tsx`, `components/tournaments/tournament-wizard.tsx`, `components/tournaments/tournament-review.tsx`, `components/tournaments/open-registration-card.tsx`, `components/tournaments/tournament-celebration-card.tsx`, `app/(app)/torneos/[id]/inscripciones/page.tsx`, `components/categories/categories-manager.tsx`, y `components/categories/edit-category-dialog.tsx`.

### D-073 — Normalización robusta de StandingsConfig y herencia en categorías (2026-10-14)
- **Decisión:**
  - **Función normalizadora `normalizeStandingsConfig` (`lib/domain/standings.ts`):**
    - Convierte de forma resiliente cualquier representación de configuración de tabla de posiciones (`raw`) al tipo canónico `StandingsConfig`.
    - Soporta retrocompatibilidad transparente con campos legacy de migraciones previas de base de datos (`pointsWin`, `pointsDraw`, `pointsLoss`, y criterios `set_difference`, `game_difference`, `goal_difference`).
    - Ante entradas `null`, `undefined` u objetos vacíos, provee un fallback seguro (`points: { win: 2, draw: 1, loss: 0 }`, criterios de desempate canónicos).
  - **Blindaje en cómputo de posiciones (`accumulate` y `computeStandings`):**
    - En `accumulate`, se valida `points && typeof points.win === "number" ? points : { win: 2, draw: 1, loss: 0 }`, evitando excepciones `TypeError: Cannot read properties of undefined (reading 'win')`.
    - `computeStandings` ejecuta `normalizeStandingsConfig(input.config)` de manera preliminar antes de armar la tabla de estadísticas o subgrupos de desempate directo (`headToHead`).
  - **Normalización en capa de presentación y datos (`competition-view.ts`, `categories.ts`, `grupos/page.tsx`):**
    - `groupStandings` en `lib/competition-view.ts` normaliza la configuración antes de computar las tablas de cada grupo.
    - `getTournamentCategories` en `lib/data/categories.ts` aplica `normalizeStandingsConfig(row.standings_config)` al mapear las categorías leídas de la base de datos.
    - En `app/(app)/torneos/[id]/grupos/page.tsx`, la resolución de `categoryStandings` aplica `normalizeStandingsConfig(activeCategory?.standingsConfig ?? tournament.standingsConfig)`.
  - **Herencia automática de configuraciones al crear categorías (`createCategory` en `categorias/actions.ts`):**
    - Al crear una nueva categoría, se consultan en paralelo `scoring_config`, `standings_config` y `playoff_config` del torneo padre y se persisten explícitamente en el registro de `tournament_categories`, evitando que PostgreSQL recurra a valores por defecto desactualizados de la migración.
- **Motivo:** solucionar el error de lectura de `points.win` que ocurría al computar la tabla de posiciones en torneos con múltiples categorías creadas recientemente.
- **Cómo aplicar:** implementado en `lib/domain/standings.ts`, `lib/competition-view.ts`, `lib/data/categories.ts`, `app/(app)/torneos/[id]/categorias/actions.ts`, y `app/(app)/torneos/[id]/grupos/page.tsx`, con tests unitarios en `lib/domain/standings.test.ts`.

### D-074 — Transición fluida a playoffs, normalización de ScoringConfig y apertura continua del cuadro (2026-10-14)
- **Decisión:**
  - **Acceso continuo a playoffs y cruces proyectados (`cuadro/page.tsx`):**
    - El organizador puede ingresar a la pestaña "Cuadro" en cualquier momento de la fase de grupos. Mientras la zona esté en juego, el cuadro proyecta en tiempo real los cruces según la tabla viva de posiciones.
    - La carga y edición de resultados en playoffs (`canEdit`) permanece bloqueada mientras haya partidos de fase de grupos pendientes (`allGroupMatchesFinished = false`).
    - Al finalizar el último partido de zona de una categoría, la generación de los partidos reales de playoffs se dispara automáticamente y la carga de resultados queda habilitada de inmediato, sin exigir la transición manual del estado del torneo ("Terminar grupos y pasar a playoffs").
  - **Normalización integral de configuraciones (`normalizeScoringConfig`, `normalizePlayoffConfig`, `normalizeStandingsConfig`):**
    - `lib/domain/scoring.ts`: incorporación de `normalizeScoringConfig(raw)` para mitigar `ZodError` en categorías con formato legacy (ej. `setsToWin: 2` de migraciones previas en lugar de `bestOf: 3` y `decidingSet: "super_tiebreak"`). Si la entrada carece de campos obligatorios o viene en formato antiguo, normaliza y aplica fallbacks canónicos sin lanzar excepción.
    - `lib/domain/bracket.ts`: incorporación de `normalizePlayoffConfig(raw)` con fallback seguro (`qualifiersPerGroup: 2, thirdPlace: false`).
    - Reemplazo de llamadas `.parse()` por normalizadores en `app/(app)/torneos/[id]/cuadro/actions.ts`, `app/(app)/torneos/[id]/cuadro/page.tsx`, y `app/(app)/torneos/[id]/actions.ts`.
  - **Sincronización en render de servidor (`cuadro/page.tsx`):**
    - Tras ejecutar `ensurePlayoffBracket`, si se insertaron nuevos partidos de playoffs (`res.count > 0`), se recarga la competencia (`getCompetition`) en el mismo ciclo del Server Component para que los partidos sean visibles de inmediato sin requerir recargar la página manualmente.
- **Motivo:** corregir el `ZodError` por campos obsoletos en `scoring_config` y agilizar la experiencia de usuario eliminando el paso administrativo manual para pasar a playoffs, preservando la consistencia deportiva al habilitar la carga de resultados únicamente tras culminar los grupos.
- **Cómo aplicar:** implementado en `lib/domain/scoring.ts`, `lib/domain/bracket.ts`, `app/(app)/torneos/[id]/cuadro/actions.ts`, `app/(app)/torneos/[id]/cuadro/page.tsx`, y `app/(app)/torneos/[id]/actions.ts`.

### D-075 — Rediseño UI/UX SaaS del menú principal de torneos: Dashboard de organizador y jugador (2026-10-14)
- **Decisión:**
  - **Componente interactivo `TournamentDashboard` (`components/tournaments/tournament-dashboard.tsx`):**
    - Métricas ejecutivas KPI: resumen de torneos organizados (desglose de activos), torneos donde el usuario juega (desglose de aprobados) y badge de alerta para inscripciones pendientes por revisar (`pendingTeams > 0`).
    - Segmented Control / Tabs con badges interactivos (`Todos`, `Organizo`, `Participo`).
    - Buscador reactivo instantáneo por nombre de torneo, deporte o nombre de equipo con botón de limpieza y empty state para búsquedas sin coincidencias.
    - Secciones semánticas estructuradas con accesibilidad (`aria-labelledby="organizo"`, `aria-labelledby="participo"`) y grid responsivo de 2 columnas (`grid grid-cols-1 md:grid-cols-2 gap-4`).
  - **Rediseño de tarjetas de torneo (`components/tournaments/tournament-card.tsx`):**
    - `OrganizedTournamentCard`: contenedor táctil con elevación suave, barra superior de estado coloreada, icono de deporte en badge estilizado, barra de progreso de cupos con indicador visual de completitud, pill de advertencia para parejas pendientes de revisión y pie con fecha y botón "Administrar".
    - `ParticipationCard`: contenedor centrado en la experiencia del jugador con datos destacados del equipo ("Tu equipo: [Nombre]"), rol ("Capitán" / "Jugador"), `TeamStatusBadge` y acceso directo.
  - **Evolución visual de `StatusBadge` y `TeamStatusBadge` (`components/tournaments/status-badge.tsx`):**
    - Indicador visual de punto con pulso/ping (`animate-ping`) para estados en vivo (`registration_open`, `group_stage`, `playoffs`), con paleta HSL/OKLCH calibrada para contraste WCAG AA en tema claro y oscuro.
    - `TeamStatusBadge` con iconos contextuales (`Check`, `Clock`, `X`) y bordes translúcidos.
  - **Portal de inscripción por código (`components/registration/join-code-form.tsx`):**
    - Rediseñado como un banner estilizado con icono de ticket, microacento degradado, tipografía mono espaciada para el código y botón de acción directa.
- **Motivo:** elevar la experiencia visual del menú principal al nivel de un producto SaaS moderno (Linear/Vercel), facilitando la gestión de competencias y la participación deportiva con claridad de métricas y microinteracciones fluidas.
- **Cómo aplicar:** implementado en `components/tournaments/status-badge.tsx`, `components/tournaments/tournament-card.tsx`, `components/tournaments/tournament-dashboard.tsx`, `components/registration/join-code-form.tsx`, y `app/(app)/torneos/page.tsx`.

### D-076 — Integración de torneos y competencias en "Mi perfil" (2026-10-14)
- **Decisión:**
  - **Unificación de la experiencia del usuario en su perfil (`app/(app)/perfil/page.tsx`):**
    - Se integran las competencias del usuario directamente en la pantalla de su perfil personal, consultando en paralelo `listOrganizedTournaments(user.id)` y `listParticipations(user.id)`.
    - Se reutiliza el componente interactivo `TournamentDashboard`, proporcionando en "Mi perfil" el mismo resumen KPI ejecutivo, segmented control / tabs (`Todos`, `Organizo`, `Participo`), buscador reactivo instantáneo y las tarjetas táctiles modernas de torneos organizados y jugados.
    - Se actualiza la tarjeta principal del usuario para incorporar un badge contextual de rol dinámico (`Organizador & Jugador`, `Organizador` o `Jugador`) junto a su nombre y avatar.
- **Motivo:** permitir al usuario acceder y monitorear centralizadamente todos los torneos que gestiona y en los que compite desde la vista de su propio perfil.
- **Cómo aplicar:** implementado en `app/(app)/perfil/page.tsx` reutilizando `components/tournaments/tournament-dashboard.tsx`.

### D-077 — Separación de responsabilidades: KPIs ejecutivos exclusivos en "Mi perfil" y catálogo directo en "Torneos" (2026-10-14)
- **Decisión:**
  - **KPIs ejecutivos en "Mi perfil" (`components/tournaments/tournament-stats-summary.tsx`):**
    - Se extrae el bloque de estadísticas y KPIs rápidos (`TournamentStatsSummary`) para uso exclusivo en `app/(app)/perfil/page.tsx`, mostrando la cabecera *"🏆 Mis torneos"* y las 3 tarjetas de impacto (Torneos que organizo con activos, Torneos donde juego con activos, y Atención requerida con pendientes).
    - En "Mi perfil" se eliminan las listas extensas de torneos, pestañas y buscador para mantener el perfil conciso, enfocado en identidad, métricas y preferencias.
  - **Menú principal de torneos directo y enfocado (`app/(app)/torneos/page.tsx`):**
    - Se remueven las 3 tarjetas de métricas del menú principal para evitar redundancia visual, permitiendo al organizador o jugador interactuar directamente con el portal de código de inscripción, el segmented control y el listado de tarjetas de torneos organizados y jugados.
- **Motivo:** alinear la distribución visual según la preferencia explícita del usuario, ubicando el balance numérico en su perfil y el flujo operativo de torneos en la pantalla principal.
- **Cómo aplicar:** implementado en `components/tournaments/tournament-stats-summary.tsx`, `components/tournaments/tournament-dashboard.tsx`, `app/(app)/perfil/page.tsx`, y `app/(app)/torneos/page.tsx`.

### D-078 — Eliminación del botón manual de playoffs, transición fluida tras fase de grupos y carga de resultados fuera de franjas (2026-10-14)
- **Decisión:**
  - **Eliminación del botón manual "Terminar grupos y pasar a playoffs":**
    - Se remueve la opción manual de transición de estado `playoffs` de `PhaseGuide` y `TournamentSummaryPage` (`app/(app)/torneos/[id]/page.tsx`), así como el botón "Pasar a playoffs" en `components/categories/categories-manager.tsx`.
    - Al concluir todos los partidos de la fase de grupos, el sistema muestra en su lugar un banner de finalización con enlaces directos a "Ir al cuadro de playoffs" y "Ver partidos".
  - **Generación y sincronización automática de playoffs:**
    - Al guardar el resultado del último partido de fase de grupos en `recordResult` (`partidos/actions.ts`), se dispara inmediatamente `ensurePlayoffBracket`, persistiendo los cruces de playoffs en la base de datos sin requerir interacción administrativa adicional.
    - `MatchesPage` (`app/(app)/torneos/[id]/partidos/page.tsx`) asegura que si los grupos terminaron o el torneo está en playoffs, los partidos de playoffs se encuentren generados para permitir su carga inmediata desde el listado general de partidos.
  - **Carga de resultados y programación flexible fuera de franjas:**
    - Se elimina la auto-programación forzosa de playoffs (`runAutoSchedule`) dentro de `ensurePlayoffBracket` y `recordResult`, permitiendo que el organizador defina los resultados de playoffs libremente, incluso si los partidos no tienen franjas horarias asignadas o se juegan fuera de los turnos de juego iniciales.
    - En PostgreSQL (`supabase/migrations/20261014170000_fluid_playoffs_and_byes_fix.sql`):
      - Se actualiza `record_match_result` para permitir cargar resultados de playoffs cuando el torneo o categoría todavía figura en `group_stage`, siempre que hayan concluido los partidos de grupo, actualizando el estado de forma transparente.
      - Se corrige `apply_bracket` para asignar `result_status = 'confirmed'` a los partidos con bye, evitando el fallo de restricción `check` de base de datos (`matches_check`).
- **Motivo:** eliminar la fricción innecesaria de botones manuales intermedios, solucionar el bloqueo que impedía cargar resultados de playoffs tras culminar la zona y dar total autonomía al organizador para resolver las llaves eliminatorias.
- **Cómo aplicar:** implementado en `supabase/migrations/20261014170000_fluid_playoffs_and_byes_fix.sql`, `app/(app)/torneos/[id]/cuadro/actions.ts`, `app/(app)/torneos/[id]/partidos/actions.ts`, `app/(app)/torneos/[id]/partidos/page.tsx`, `app/(app)/torneos/[id]/page.tsx`, `components/tournaments/phase-guide.tsx`, y `components/categories/categories-manager.tsx`.

### D-079 — Historial exclusivo de torneos organizados y separación de competencias activas vs finalizadas (2026-10-14)
- **Decisión:**
  - **Separación de torneos activos y finalizados en el panel principal (`TournamentDashboard`):**
    - En la vista de inicio del organizador (`/torneos`), los torneos con estado `finished` ya no saturan la lista principal de competencias en curso ("Organizo" y "Todos").
    - Se añade una cuarta pestaña interactiva `Historial` (con contador dinámico de torneos finalizados) en el segmented control.
    - Se incorpora un banner informativo dentro de la sección "Organizo" que notifica la existencia de ediciones anteriores archivadas y permite saltar al historial con un clic.
  - **Apartado dedicado de historial del organizador (`app/(app)/torneos/historial/page.tsx`):**
    - Se crea la ruta dedicada `/torneos/historial` con métricas ejecutivas acumuladas (ediciones concluidas, campeones consagrados, total de parejas/equipos albergados y disciplinas deportivas).
    - Incluye buscador instantáneo por nombre de torneo o de campeón, y chips de filtrado por deporte.
    - Utiliza la tarjeta táctil `FinishedTournamentCard` (`components/tournaments/tournament-card.tsx`), destacando al campeón consagrado con trofeo y estilo premium o indicando el archivo de resultados.
  - **Integración con la navegación general e historial global (`/historial`):**
    - En el header de "Mis torneos" (`app/(app)/torneos/page.tsx`), se añade el botón de acceso rápido *"Historial (N)"* junto a "Circuitos anuales".
    - En la página general `/historial` (`app/(app)/historial/page.tsx`), se preservan siempre las estadísticas de jugador del usuario por defecto (partidos jugados, ganados, efectividad, torneos y títulos con sus filtros y lista). Cuando el usuario es organizador y jugador (posee torneos organizados), se incorpora el componente de pestañas `HistoryViewTabs` (`components/history/history-view-tabs.tsx`) que permite alternar nítidamente entre **"Jugados"** (estadísticas personales y cruces) y **"Organizados"** (historial de torneos creados con `FinishedTournamentsView`).
    - Se actualizan las revalidaciones (`actions.ts`) para invalidar `/torneos/historial` y `/historial` cuando un torneo finaliza o actualiza su estado.
  - **Diferenciación de nomenclatura entre historial de torneos y personal:**
    - El historial de competencias concluidas se denomina **"Historial"** o **"Historial de torneos"** (tanto en la pestaña del panel como en `/torneos/historial`).
    - El historial de partidos y estadísticas del jugador se renombra a **"Mi historial"** en la navegación principal desktop ([`nav-items.ts`](file:///c:/Users/Usuario/Downloads/APP%20TORNEOS%20LM/App-Torneos/components/layout/nav-items.ts)) y en la barra inferior móvil ([`bottom-nav.tsx`](file:///c:/Users/Usuario/Downloads/APP%20TORNEOS%20LM/App-Torneos/components/layout/bottom-nav.tsx)), diferenciando con claridad el historial personal de cada jugador del registro de torneos del organizador.
- **Motivo:** mantener la pantalla principal limpia y enfocada en torneos activos y operativos, garantizando al mismo tiempo un registro permanente y prestigioso de las ediciones concluidas y sus campeones, con una nomenclatura clara entre el historial del organizador y el personal del jugador.
- **Cómo aplicar:** implementado en `components/layout/nav-items.ts`, `components/layout/bottom-nav.tsx`, `components/history/history-view-tabs.tsx`, `components/tournaments/tournament-card.tsx`, `components/tournaments/tournament-dashboard.tsx`, `components/tournaments/finished-tournaments-view.tsx`, `app/(app)/torneos/historial/page.tsx`, `app/(app)/torneos/page.tsx`, `app/(app)/historial/page.tsx`, `lib/data/tournaments.ts`, y `app/(app)/torneos/[id]/actions.ts`.

### D-080 — Eliminación de torneos no finalizados por parte del organizador (2026-10-14)
- **Decisión:**
  - **Flexibilización de la política de borrado:**
    - Anteriormente solo se permitía eliminar torneos en estado `draft` o `registration_open`. Ahora el organizador puede eliminar cualquier torneo que haya creado, siempre y cuando **no se encuentre en estado `finished`** (`status !== 'finished'`).
    - Los torneos finalizados permanecen inmutables y protegidos para salvaguardar el historial permanente de campeones, estadísticas y títulos.
  - **Base de datos (RLS y cascada referencial):**
    - Se crea la migración `supabase/migrations/20261014182000_allow_delete_unfinished_tournaments.sql`, actualizando la política de `DELETE` en `public.tournaments` con `using (organizer_id = (select auth.uid()) and status <> 'finished')`.
    - Todas las entidades dependientes (`tournament_categories`, `teams`, `team_members`, `tournament_groups`, `matches`, `match_confirmations`, `courts`, `time_slots`) poseen claves foráneas con `on delete cascade`, garantizando una limpieza completa sin dejar registros huérfanos.
  - **Lógica de dominio y Server Actions:**
    - `canDeleteTournament` en `lib/domain/tournament-status.ts` se actualiza para retornar `status !== "finished"`.
    - `deleteTournament` en `app/(app)/torneos/[id]/actions.ts` valida y revalida las rutas `/torneos`, `/torneos/historial` y `/historial`.
  - **Experiencia de usuario (UI):**
    - En la vista principal del torneo (`app/(app)/torneos/[id]/page.tsx`), la sección "Más opciones" permite eliminar el torneo en cualquier etapa previa a su finalización (borrador, inscripción abierta, fase de grupos o playoffs) con un mensaje claro de confirmación.
    - En la pantalla de Configuración (`app/(app)/torneos/[id]/configuracion/page.tsx`), se añade una tarjeta de **"Zona de peligro"** con el botón `DeleteTournamentButton` para facilitar su descubrimiento por el organizador.
- **Motivo:** otorgar al organizador total control y autonomía para descartar o recomenzar competencias de prueba o interrumpidas antes de su conclusión formal.
- **Cómo aplicar:** implementado en `supabase/migrations/20261014182000_allow_delete_unfinished_tournaments.sql`, `lib/domain/tournament-status.ts`, `lib/domain/tournament-status.test.ts`, `app/(app)/torneos/[id]/actions.ts`, `app/(app)/torneos/[id]/page.tsx`, `app/(app)/torneos/[id]/configuracion/page.tsx`, y `components/tournaments/delete-tournament-button.tsx`.

### D-081 — Corrección de contraste y jerarquía de color en botones destructivos y diálogos de confirmación (2026-10-14)
- **Decisión:**
  - **Corrección del conflicto de clases CSS en `AlertDialogAction` y `ConfirmActionButton`:**
    - Se identificó un conflicto en dark mode donde `AlertDialogAction` inyectaba por defecto las clases de `variant="default"` (`bg-primary text-primary-foreground`) junto con las clases personalizadas `bg-destructive text-white`.
    - Al carecer de `tailwind-merge` en el helper `cn`, en el CSS compilado `.bg-primary` tenía precedencia sobre `.bg-destructive`, resultando en un fondo blanquecino con texto blanco (`text-white`), volviendo ilegible el texto del botón (ej: "Eliminar torneo").
  - **Resolución integral:**
    - En `components/ui/button.tsx`, la variante `destructive` de `buttonVariants` se actualiza al estándar sólido de alta visibilidad: `bg-destructive text-white shadow-xs hover:bg-destructive/90`.
    - En `components/ui/alert-dialog.tsx`, `AlertDialogAction` resuelve automáticamente `variant="destructive"` si `className` incluye `bg-destructive` o si se pasa explícitamente `variant="destructive"`, evitando que `Button` genere `bg-primary`.
    - En `components/shared/confirm-action-button.tsx`, `components/matches/matches-board.tsx`, `components/circuits/delete-circuit-button.tsx` y `components/circuits/circuit-dates-list.tsx`, se establece `variant="destructive"` y `!bg-destructive !text-white`.
    - En `app/globals.css`, se define `--destructive-foreground: oklch(0.985 0 0)` tanto en `:root` como en `.dark`, y se armoniza `--destructive` en dark mode a `oklch(0.577 0.245 27.325)` para garantizar un ratio de contraste superior a 4.5:1 (WCAG AA).
- **Motivo:** garantizar que las acciones destructivas y de confirmación sean inmediatamente distinguibles del botón "Cancelar" y 100% legibles en tema claro y oscuro.
- **Cómo aplicar:** implementado en `components/ui/button.tsx`, `components/ui/alert-dialog.tsx`, `components/shared/confirm-action-button.tsx`, `components/matches/matches-board.tsx`, `components/circuits/delete-circuit-button.tsx`, `components/circuits/circuit-dates-list.tsx`, y `app/globals.css`.

### D-082 — Corrección de autorización para editar y dar de baja inscripciones y experiencia de registro de parejas en pádel (2026-10-14)
- **Decisión:**
  - **Autorización en PostgreSQL (`update_team_roster`, `withdraw_team`, `create_team_invitation`):**
    - Se eliminó la restricción `or v_team.organizer_registered` que bloqueaba al capitán y al organizador cuando un equipo se registraba con auto-aprobación del organizador (`organizer_registered = true`).
    - Tanto el capitán del equipo (`v_team.captain_id = v_uid`) como el organizador del torneo (`v_tournament.organizer_id = v_uid`) están plenamente autorizados a editar el plantel (`update_team_roster`) o dar de baja la inscripción (`withdraw_team`).
    - `create_team_invitation` permite enviar o reenviar invitaciones a compañeros sin bloquear a equipos con estado `approved` ni a equipos registrados por el organizador si poseen email.
    - `accept_team_invitation` admite invitaciones de equipos tanto en estado `pending` como `approved` (manteniendo su estado de aprobación una vez aceptadas).
    - `register_team` siempre establece `organizer_registered = false` (este campo queda reservado exclusivamente para inscripciones presenciales/manuales sin emails `create_organizer_team`).
    - Se ejecutó un backfill en base de datos para restaurar `organizer_registered = false` en los equipos existentes que contaban con integrantes y emails reales.
  - **Prevención de auto-inscripción y duplicados en el registro:**
    - Se universalizó la regla `if v_email = any(v_emails)` en `register_team`: ningún usuario (incluyendo al organizador) puede ingresar su propio email como compañero, ya que quien inscribe siempre queda registrado como capitán.
    - Se añadió validación en `register_team` para rechazar compañeros que ya estén inscriptos en el torneo (`'Uno de los integrantes ya está inscripto en este torneo.'`), evitando que `insert ... on conflict do nothing` descarte silenciosamente al compañero dejando la pareja con un solo integrante.
  - **Experiencia de usuario y claridad de parejas en pádel (UI/UX):**
    - En `TeamForm` (`components/registration/team-form.tsx`):
      - Se incorporó un banner visual prominente destacando: *"Vos sos el Capitán / Capitán de la pareja"* con nombre/email y la explicación: *"El pádel se juega en parejas (2 personas). Vos ya quedás registrado como capitán; abajo tenés que ingresar el email de tu pareja para invitarla."*
      - En el cliente, se valida e informa de inmediato si el usuario intenta ingresar su propio email como compañero (*"No podés ingresar tu propio email: vos ya sos el capitán de la pareja."*).
    - En `MemberEmailsField` (`components/registration/member-emails-field.tsx`), se agregó el placeholder `pareja@ejemplo.com` para evitar confusiones sobre qué email se debe ingresar.
    - En la vista de inscripción (`app/(app)/inscripciones/[teamId]/page.tsx`), si por inscripciones históricas la pareja cuenta con menos integrantes que el mínimo requerido (`team.members.length < tournament.minTeamSize`), se muestra una advertencia de *"Pareja incompleta"* explicando los pasos para editar el equipo y sumar al compañero.
    - En `getTeamForMember` (`lib/data/teams.ts`), se amplió la condición de acceso para que el capitán (`team.captain_id === userId`) siempre pueda visualizar su inscripción.
- **Motivo:** solucionar el error que impedía al capitán dar de baja o editar su equipo con el mensaje de permisos, y resolver la confusión en la inscripción de pádel garantizando que el usuario comprenda su rol de capitán y complete a su pareja con el email del compañero.
- **Cómo aplicar:** implementado en `supabase/migrations/20261014193000_fix_captain_roster_edit_and_withdraw.sql`, `supabase/migrations/20261014194000_fix_register_team_rpc.sql`, `components/registration/team-form.tsx`, `components/registration/team-actions.tsx`, `components/registration/member-emails-field.tsx`, `app/(app)/unirse/[code]/page.tsx`, `app/(app)/inscripciones/[teamId]/page.tsx`, y `lib/data/teams.ts`.

### D-083 — Asignación inteligente de horarios y minimización de brechas entre partidos consecutivos (2026-10-14)
- **Decisión:**
  - **Optimización por proximidad y minimización de brechas temporales (`computeGapPenalty`):**
    - Se incorporó en `lib/domain/scheduler.ts` una función de evaluación objetiva y ordenamiento dinámico de candidatos (`candidatePenalty` y `computeGapPenalty`) que califica la calidad del descanso entre partidos consecutivos de un mismo equipo o grupo.
    - Curva de penalización por descanso:
      - Menos de 15 min (partidos seguidos sin pausa): penalización leve por fatiga (5 pts).
      - Entre 15 min y 2.5 horas: descanso ideal óptimo (0 pts).
      - Entre 2.5 y 4.5 horas: espera aceptable en el club (10 pts por hora extra).
      - Entre 4.5 y 8 horas: espera larga/incómoda (20 + 25 pts por hora extra).
      - Más de 8 horas (días distintos o turnos noche/mañana distantes): penalización severa (120 + 60 pts por hora extra).
  - **Ordenamiento dinámico y poda Branch-and-Bound en el backtracking:**
    - Los candidatos de cada partido se ordenan dinámicamente durante la búsqueda de menor a mayor penalización, probando en primer lugar las franjas con descanso ideal respecto al partido anterior del equipo o a sus antecedentes (`feeders`).
    - Poda por cota de penalización: si ya existe una asignación completa con mejor penalización, las ramas con penalización acumulada superior se podan inmediatamente. Si se alcanza una solución completa con penalización 0, la búsqueda concluye inmediatamente con el cronograma óptimo.
  - **Coherencia cronológica de rondas y dependencia de antecedentes (`feeders`):**
    - En el orden de exploración de partidos, se priorizan las rondas anteriores (`order: (stage === "group" ? 0 : 100) + round`) antes que la cantidad de candidatos, permitiendo que la Fecha 1 quede fijada antes de que la Fecha 2 evalúe su proximidad.
    - Se enlazaron las dependencias antecedentes (`feederMatchIds` y `feedersEnd`): en zonas de 4 parejas (formato padel GSL), los partidos de la Fecha 2 (ganador vs ganador y perdedor vs perdedor) dependen explícitamente de la conclusión de los 2 partidos de Fecha 1 de esa misma zona.
    - Se toma en cuenta el historial de partidos fijados o jugados de cada equipo (`teamLatestFixedEnd`) para que `notBefore` nunca permita programar un partido posterior en un horario anterior al ya disputado por alguno de sus integrantes.
  - **Soporte de programación anticipada para zonas de 4 parejas:**
    - Se permite que los partidos de Fecha 2 con equipos a definir (`home_team_id: null, away_team_id: null`) evalúen la disponibilidad común de los 4 integrantes del grupo (`groupTeamIds`).
    - En `Occupancy`, los partidos complementarios de la misma zona y misma ronda (final de ganadores y duelo de perdedores) reconocen que particionan los 4 integrantes en dos parejas disjuntas, permitiéndoles disputarse en simultáneo en canchas distintas dentro de la misma franja horaria.
- **Motivo:** responder al requerimiento de que la programación automática sea lo más inteligente posible, evitando que en zonas de 4 el 2do partido quede asignado con excesiva diferencia horaria respecto a la primera fecha cuando existen franjas cercanas disponibles.
- **Cómo aplicar:** implementado en `lib/domain/scheduler.ts`, `lib/domain/scheduler.test.ts`, y `lib/scheduling.ts`.

### D-084 — Validación y saneamiento de cantidad de grupos en GroupBuilder (2026-10-14)
- **Decisión:**
  - En `components/groups/group-builder.tsx`, `initialGroups.length` ya no se utiliza a ciegas como valor inicial de `groupCount`.
  - Se valida `initialValidCount = options.includes(initialGroups.length) ? initialGroups.length : suggested`, asegurando que `groupCount` siempre pertenezca al conjunto devuelto por `groupCountOptions(teams.length)`.
  - Se define `safeGroupCount` y un `useEffect` que resetea `groupCount` a `suggested` si la lista de equipos cambia o si el valor previo deja de ser admisible.
  - La función `draw(count?)` sanea cualquier parámetro recibido antes de pasarlo a `drawGroups`, impidiendo que se invoque la función de dominio con un conteo de grupos fuera de rango (`RangeError`).
  - En `app/(app)/torneos/[id]/grupos/page.tsx`, se agrega `key={`${activeCategory?.id ?? "global"}-${approved.length}`}` a `GroupBuilder` para reiniciar limpiamente el estado del componente al alternar de categoría o variar la cantidad de inscriptos.
- **Motivo:** corregir el `Runtime RangeError: Con 4 equipos se pueden armar entre 1 y 2 grupos` que ocurría al sortear cuando el torneo tenía guardada previamente una cantidad de grupos inconsistente con el total de parejas actual.
- **Cómo aplicar:** implementado en `components/groups/group-builder.tsx` y `app/(app)/torneos/[id]/grupos/page.tsx`.

### D-085 — Descentralización de cupos por categoría y soporte de modalidad sin límite ("Hasta cerrar inscripción") (2026-10-14)
- **Decisión:**
  - **Eliminación de cupo máximo en la creación del torneo:**
    - Se removió el campo de cupo máximo de parejas (`maxTeams`) del asistente de alta de torneos (`/torneos/nuevo`, `components/tournaments/tournament-wizard.tsx` y `tournament-review.tsx`).
    - En el esquema de validación (`lib/validation/tournament.ts`), `maxTeams` es opcional con valor por defecto 128 a nivel base de datos para no quebrar restricciones de integridad relacional existentes.
    - El asistente ahora aclara expresamente que la capacidad y cupos se definen por categoría (o sin límite numérico).
  - **Cupo por categoría con modalidad "Hasta cerrar inscripción (sin límite)":**
    - En `tournament_categories.max_teams`, la columna ahora permite valores `NULL` mediante la migración `20261014234000_category_unlimited_cupo.sql`.
    - Cuando `max_teams` es `NULL`, la categoría no tiene tope numérico de inscriptos: cualquier pareja puede inscribirse libremente hasta que el organizador decida cerrar la inscripción (pasando de `registration_open` a otra fase como `group_stage`).
    - Se adaptaron los RPCs de base de datos (`register_team`, `create_organizer_team` y `review_registration`) para que la validación de cupo (`category_full` o `tournament_full`) solo se active si `v_cat.max_teams IS NOT NULL`.
    - En `components/categories/categories-manager.tsx` y `components/categories/edit-category-dialog.tsx`, se integró un toggle compacto en línea ("♾️ Sin límite" / "Fijar número") y se removieron las filas voluminosas de "Modalidad de cupo" y "Sugerencias rápidas" para optimizar el espacio vertical.
    - La migración `20261014234000_category_unlimited_cupo.sql` se aplicó exitosamente en la base de datos remota de Supabase con `supabase db push`.
- **Motivo:** responder al pedido del usuario de eliminar el cupo global redundante del alta de torneos, permitir que las categorías puedan operar sin un límite numérico prefijado, y simplificar el formulario quitando botones de sugerencias que ocupaban demasiado espacio.
### D-086 — Corrección en RPC create_organizer_team de inserción de parejas (2026-10-15)
- **Decisión:**
  - En la función RPC `create_organizer_team`, se corrigió la inserción en `team_availability` para incluir la columna obligatoria `tournament_id` (`not null`).
  - Se corrigió la inserción en `team_members` para usar el rol `'player'` estándar con `display_name` y `email: null` (evitando el error de tipo inexistente `public.team_role`).
  - Se aplicó la migración `20261015000500_fix_create_organizer_team_rpc.sql` en la base de datos remota de Supabase con `supabase db push`.
- **Motivo:** corregir el error genérico "No pudimos completar la operación. Probá de nuevo." al inscribir parejas manualmente desde el panel del organizador.
### D-087 — Desactivación de revalidatePath durante el render en MatchesPage y BracketPage (2026-10-15)
- **Decisión:**
  - En Next.js App Router (15+ / 16), `revalidatePath` y `revalidateTag` solo están permitidos dentro de Server Actions o Route Handlers, arrojando error de consola si se invocan durante el renderizado de Server Components (`Route /torneos/[id]/partidos used "revalidatePath" during render which is unsupported`).
  - Se agregó la opción `revalidate?: boolean` a la función auxiliar `ensurePlayoffBracket` en `app/(app)/torneos/[id]/cuadro/actions.ts`.
  - En `app/(app)/torneos/[id]/partidos/page.tsx` y `app/(app)/torneos/[id]/cuadro/page.tsx`, se invoca `ensurePlayoffBracket(supabase, tournament.id, { revalidate: false })`, permitiendo que el cuadro se auto-genere al vuelo sin disparar llamadas ilegales a `revalidatePath` en tiempo de render.
- **Motivo:** corregir el error de Next.js en consola al ingresar a la pantalla de partidos o cuadro cuando se auto-generaban los cruces de playoffs.
- **Cómo aplicar:** implementado en `app/(app)/torneos/[id]/cuadro/actions.ts`, `app/(app)/torneos/[id]/partidos/page.tsx`, y `app/(app)/torneos/[id]/cuadro/page.tsx`.

### D-088 — Importación masiva de parejas y categorías desde listas de WhatsApp / texto plano (2026-10-16)
- **Decisión:**
  - Se incorpora la funcionalidad de importación masiva de inscriptos (`BulkRegistrationDialog` en `components/registration/bulk-registration-dialog.tsx`) en la pestaña de Inscripciones del organizador (`/torneos/[id]/inscripciones`).
  - **Parser inteligente de texto (`lib/domain/roster-parser.ts`):**
    - Procesa listas copiadas directamente de WhatsApp o mensajes con formato de encabezados de categoría (ej: `*➡️ Suma 10 Caballeros*`, `*➡️ 6ta Caballeros*`, `*➡️ Suma 13 Damas*`, `+10`, `Categoría 7ma`).
    - Ignora encabezados de fechas/notas de agenda (ej. `*22/23/24 y 25*`) y renglones vacíos o numeraciones sin nombres (ej: `12-`, `13-`, `14-`).
    - Parsea parejas por renglón con separadores estándar (`/`, `-`, `y`, `&`) limpiando números ordinales o viñetas (`1- `, `2. `, etc.) y extrayendo los 2 nombres individuales de los jugadores.
    - Asocia automáticamente cada bloque con categorías existentes del torneo o marca la categoría para creación automática si aún no existe.
  - **Previsualización y control en tiempo real:**
    - Diálogo modal con área de texto (`Textarea`) y vista previa reactiva instantánea que muestra el total de parejas detectadas por categoría y permite al organizador reasignar bloques a categorías existentes o dejarlas como nuevas divisiones a crear.
    - Opción para asignar disponibilidad a todas las franjas horarias del torneo por defecto, garantizando que el programador automático (`runAutoSchedule`) pueda agendar los partidos sin conflictos.
  - **Persistencia atómica y resiliente (`bulkImportTeams` en `inscripciones/actions.ts`):**
    - Crea automáticamente en `tournament_categories` las categorías faltantes con cupo ilimitado (`max_teams = null` según D-085) y la configuración de puntuación y playoffs recomendada del torneo.
    - Inscribe y auto-aprueba a cada pareja mediante la RPC `create_organizer_team`.
    - Resuelve colisiones de nombres idénticos entre categorías agregando el sufijo de la categoría si ya existía un equipo con ese nombre en el torneo.
    - Revalida el panel del organizador y purga la caché pública con `refreshPublicTournament`.
- **Motivo:** permitir al organizador cargar decenas de parejas divididas por categoría en 1 clic pegando directamente el mensaje de WhatsApp que recibe de las inscripciones, reduciendo drásticamente el tiempo operativo de carga manual.
- **Cómo aplicar:** implementado en `lib/domain/roster-parser.ts`, `lib/domain/roster-parser.test.ts`, `lib/validation/registration.ts`, `app/(app)/torneos/[id]/inscripciones/actions.ts`, `components/registration/bulk-registration-dialog.tsx`, y `components/registration/organizer-registration-form.tsx`.

### D-089 — Rediseño responsive mobile-first en fixture, carga de resultados y asignación de horarios (2026-10-16)
- **Decisión:**
  - **Filtros de categorías y estado (`components/matches/matches-board.tsx`):**
    - Se solucionó la superposición de botones de categoría agregando `whitespace-nowrap shrink-0` y habilitando un contenedor de scroll horizontal táctil (`overflow-x-auto pb-1.5 scrollbar-none sm:flex-wrap`), evitando que los nombres largos fuercen saltos de línea que desborden las píldoras de altura fija.
    - Se aplicó la misma optimización a las pestañas de estado de partidos (`FILTERS`: Todos, Sin horario, Sin resultado, Objetados), manteniendo la barra compacta y accesible desde 360px sin apilamientos verticales excesivos.
  - **Fila de partido (`MatchRow`) y menú de acciones (3 puntos):**
    - Se incorporó un botón de acceso directo táctil *"Cargar"* (`ClipboardEdit`) para partidos pendientes de resultado, permitiendo cargar el marcador en 1 solo tap sin obligar a abrir el menú de 3 puntos.
    - Se amplió el área de toque (`size-10 md:size-8`) del botón de 3 puntos.
    - En el `DropdownMenuContent`, se fijó `collisionPadding={16}`, ancho legible `w-56` y los ítems pasaron a altura mínima táctil de 44px (`min-h-[44px] py-2.5 px-3`) con íconos identificadores para prevenir toques involuntarios en pantallas táctiles pequeñas.
    - Si el partido ya tiene resultado, el marcador es interactivo y permite editarlo con un tap directo.
  - **Diálogo de carga de resultados (`components/matches/result-dialog.tsx`):**
    - Se incorporó una tarjeta de encabezado con el enfrentamiento visible (*VS Card*), garantizando que los nombres de las parejas/equipos sean 100% legibles sin truncamiento agresivo.
    - Se rediseñó la grilla de sets: en lugar de 2 columnas comprimidas que desbordaban en pantallas móviles, cada set organiza a las dos parejas en filas horizontales independientes (*Equipo 1* y *Equipo 2*), cada una con su propio stepper numérico táctil (`NumberInput`) a la derecha.
    - En modalidad W.O., se reemplazó el `ToggleGroup` estrecho por tarjetas de selección táctiles de ancho completo (`min-h-[48px]`) con tilde de confirmación.
    - En fútbol, los goles y la tanda de penales adoptan el mismo formato por filas con steppers de 40px.
    - El diálogo cuenta con `max-h-[92dvh] overflow-y-auto` y botones de pie a ancho completo en mobile (`w-full sm:w-auto h-11 sm:h-9`).
  - **Diálogo de asignación de horario (`components/matches/assign-slot-dialog.tsx`):**
    - Se adaptó el modal con scroll vertical seguro (`max-h-[92dvh] overflow-y-auto`), selectores `NativeSelect` a ancho completo sin zoom involuntario de iOS y botones de pie táctiles de 44px (`h-11 sm:h-9`).
  - **Input numérico táctil (`components/shared/number-input.tsx`):**
    - Los botones de incremento y decremento se ajustaron a `size-10 sm:size-8` (40px táctiles en mobile) respetando la convención de `docs/PROYECTO.md §8`.
  - **Bloqueo de desplazamiento horizontal involuntario en mobile:**
    - Se aplicó `overflow-x: hidden` y `max-width: 100vw` en `html` y `body` (`app/globals.css`), así como `overflow-x-clip` en `<main id="contenido">` (`app/(app)/layout.tsx`), asegurando que ningún elemento hijo pueda ensanchar el viewport horizontalmente.
    - Se eliminaron los márgenes negativos (`-mx-1`) de los carruseles de categorías y estados en `MatchesBoard`.
    - En `DialogContent` y `AlertDialogContent` (`components/ui/dialog.tsx` y `alert-dialog.tsx`), se interceptó `onCloseAutoFocus` (`e.preventDefault()` y `window.scrollTo({ left: 0 })`), evitando que el navegador del celular panee horizontalmente la ventana hacia la derecha al intentar hacer autofoco en los botones de acción situados en el borde derecho tras cerrar el diálogo.
- **Motivo:** corregir los fallos de renderizado en dispositivos móviles donde los botones de categoría colisionaban verticalmente, el menú de 3 puntos resultaba incómodo, el modal de carga de resultados quedaba ilegible y, al guardar, la pantalla se desplazaba indeseadamente hacia la derecha.
- **Cómo aplicar:** implementado en `components/matches/matches-board.tsx`, `components/matches/result-dialog.tsx`, `components/matches/assign-slot-dialog.tsx`, `components/shared/number-input.tsx`, `components/ui/dialog.tsx`, `components/ui/alert-dialog.tsx`, `app/globals.css`, y `app/(app)/layout.tsx`.

### D-090 — Aislamiento estricto de estadísticas en fase de grupos y modal interactivo de integrantes (2026-10-16)
- **Decisión:**
  - **Aislamiento estricto de partidos de fase de grupos (`lib/competition-view.ts`):**
    - Se actualizó `groupStandings` para filtrar explícitamente `m.stage === "group" && m.groupId === group.id && m.homeTeamId && m.awayTeamId && !m.isBye`.
    - Se asegura que ningún partido eliminatorio de playoffs (cuartos, semifinales, etc.) ni partidos definidos por BYE afecten o incrementen las estadísticas (`played`, `won`, `lost`, `points`, sets o games) de la tabla de posiciones de grupos.
    - Se blindó `buildProjectedBracket` para considerar únicamente partidos de grupos reales (`stage === 'group' && !isBye`).
  - **Corrección de propagación en fase de grupos (`app/(app)/torneos/[id]/partidos/actions.ts` y `lib/scheduling.ts`):**
    - En `recordResult`, `clearResult` y `simulateResults`, se condicionó la propagación y limpieza dinámica de la Fecha 2 (`round === 2`) a que el grupo tenga exactamente 4 parejas (`count === 4`).
    - En grupos de 3 parejas (o de tamaños distintos a 4 que disputan round-robin todos contra todos según las tablas de Berger), la Fecha 2 tiene cruces predefinidos. Anteriormente, la acción sobrescribía indebidamente el cruce de Fecha 2 con el ganador de la Fecha 1, provocando que un equipo jugara 3 partidos en lugar de 2 en una zona de 3.
    - En `lib/scheduling.ts`, se ajustó la dependencia de franjas horarias de Fecha 2 para aplicar únicamente en grupos de 4 parejas.
  - **Modal interactivo de integrantes y estadísticas en fase de grupos (`components/groups/standings-table.tsx`):**
    - En la vista de fase de grupos (panel del organizador `/torneos/[id]/grupos` y pública `/t/[slug]`), al tocar cualquier pareja de la tabla se abre un diálogo modal (`Dialog` accesible, mobile-friendly) con:
      - Título con el nombre de la pareja y badge con la posición y grupo (resaltando si clasifica).
      - Sección de **Integrantes de la pareja**: nombres completos individuales de ambos jugadores (Jugador 1 y Jugador 2), resolviendo el truncamiento visual de pantallas móviles.
      - Sección de **Estadísticas completas**: tarjetas con Puntos, Partidos Jugados (PJ), Ganados (PG), Perdidos (PP), Sets a favor/contra/diferencia (DS) y Games a favor/contra/diferencia (DG) o Goles (en fútbol).
      - Sección de **Partidos en el grupo**: lista de encuentros disputados por esa pareja con fecha, rival y resultado detallado por sets.
    - Se enriqueció `getCompetition` (`lib/data/competition.ts`) para incluir `team_members` con `profiles(full_name)` de cada equipo. En vistas públicas o parejas sin miembros registrados, el componente parsea y extrae los 2 nombres automáticamente a partir de los separadores (`/`, `-`, `y`).
- **Motivo:** corregir la corrupción del fixture en zonas de 3 donde se asignaban 3 partidos jugados por propagación errónea de Fecha 2 y garantizar que el segundo nombre de las parejas de pádel se pueda leer en su totalidad junto a sus estadísticas detalladas con un toque.
- **Cómo aplicar:** implementado en `lib/competition-view.ts`, `lib/competition-view.test.ts`, `app/(app)/torneos/[id]/partidos/actions.ts`, `lib/scheduling.ts`, `lib/data/competition.ts`, `components/groups/standings-table.tsx`, `app/(app)/torneos/[id]/grupos/page.tsx` y `app/t/[slug]/page.tsx`.

### D-091 — Carga de parejas sin disponibilidad y asignación individual de franjas por el organizador (2026-10-16)
- **Decisión:**
  - **Importación masiva sin disponibilidad inicial:** en `BulkRegistrationDialog`, la opción de disponibilidad completa por defecto se establece en desmarcada (`allSlots = false`), permitiendo al organizador cargar e inscribir la lista completa de parejas directamente desde WhatsApp/mensajes sin franjas asociadas, para luego configurarlas de manera precisa una por una.
  - **Flexibilidad en esquemas y RPCs:**
    - Se actualizó la RPC `create_organizer_team` (`supabase/migrations/20261016200000_allow_organizer_manage_team_availability.sql`) y el esquema de validación para aceptar `p_slot_ids = '{}'` (array vacío), permitiendo inscribir parejas aprobadas sin turnos iniciales.
    - Se actualizó la RPC `set_team_availability` para permitir que el organizador del torneo (`tournaments.organizer_id = auth.uid()`) pueda consultar, asignar, modificar o vaciar las franjas horarias de disponibilidad de cualquier equipo del torneo, tanto en estado de borrador (`draft`) como con la inscripción abierta (`registration_open`) o en progreso.
    - Se creó la Server Action `setTeamAvailabilityByOrganizer` en `app/(app)/torneos/[id]/inscripciones/actions.ts`.
  - **Cuadro/Diálogo modal de franjas por pareja (`TeamAvailabilityDialog`):**
    - En `RegistrationsList` (`components/registration/registrations-list.tsx`), cada tarjeta de pareja inscripta cuenta con:
      - Un botón-badge interactivo junto a su nombre (`[ 🕒 Elegir franjas ]` en tono ámbar cuando está sin disponibilidad, o `[ 🕒 X franjas ]`).
      - Un botón de acción dedicado *"Asignar franjas"* / *"Modificar franjas"* en la botonera de la pareja.
    - Al tocar cualquiera de los dos, se abre el diálogo modal (`TeamAvailabilityDialog`) que:
      - Muestra el nombre de la pareja, categoría y el desglose de los integrantes de la pareja.
      - Presenta las franjas del torneo agrupadas por día con formato claro (`formatDayHeading`, `formatTimeRange`).
      - Permite marcar o desmarcar franjas individuales, días completos ("Todo el día") o usar los botones de acción rápida *"Marcar todas"* y *"Desmarcar todas"*.
      - Incluye contador de franjas seleccionadas, aviso de cambios pendientes y botón *"Guardar franjas"*, guardando de forma atómica en Supabase con feedback mediante toast y refresco de estado.
  - **Lectura optimizada de disponibilidad:**
    - `listTournamentTeams` (`lib/data/teams.ts`) ahora incluye `availabilitySlotIds: string[]` en `OrganizerTeam`, permitiendo que el modal abra con la selección exacta de franjas que tiene cada pareja.
- **Motivo:** responder al flujo real de torneos donde el organizador define las franjas de juego antes de abrir la inscripción, carga las parejas pegando la lista recibida por WhatsApp sin disponibilidad, y luego va pareja por pareja asignando las franjas específicas en las que cada una puede jugar según lo coordinado privadamente.
- **Cómo aplicar:** aplicar `supabase/migrations/20261016200000_allow_organizer_manage_team_availability.sql` en el SQL Editor de Supabase.

### D-091 — Simplificación y pulido del flujo de creación y preparación del torneo (2026-10-17)
- **Decisión:**
  - **Eliminación del campo de zona horaria y cartel de cupos en la creación:** en `TournamentWizard` (`components/tournaments/tournament-wizard.tsx`) y `TournamentReview` (`components/tournaments/tournament-review.tsx`), se eliminó la selección de zona horaria del paso "Fechas y canchas", el cartel explicativo de "Cupos de inscripción", y sus respectivas filas en el resumen, adoptando de forma predeterminada `DEFAULT_TIMEZONE` ("America/Argentina/Buenos_Aires").
  - **Consolidación del botón a Franjas en Categorías:** en `TournamentSetupStepper` (`components/tournaments/tournament-setup-stepper.tsx`), se ocultó el botón superior "Siguiente: Franjas" cuando `currentStep === "categorias"`, y en `CategoriesManager` (`components/categories/categories-manager.tsx`) el botón inferior se estilizó con acento esmeralda principal (`bg-emerald-600`), quedando un único botón inferior visible y consistente para avanzar a franjas.
  - **Reubicación de apertura de inscripciones en el Asistente:**
    - Se eliminó la tarjeta central voluminosa `OpenRegistrationCard` en `/torneos/[id]/inscripciones`.
    - En su lugar, cuando el torneo está en borrador (`draft`), `TournamentSetupStepper` reemplaza el botón estático "Finalizar y ver resumen" por la acción "Abrir inscripciones ahora" con diálogo de confirmación y feedback por toast, validando que existan franjas horarias configuradas.
    - Una vez habilitada la inscripción, el botón del asistente pasa a ser "Finalizar y ver resumen" para acceder al panel principal.
  - **Compactación del código y recuadro de invitación (`InviteCard` & `CollapsibleSection`):**
    - Se redujo la tipografía del código de invitación de `text-2xl` a `text-sm sm:text-base font-bold`, integrándolo junto al link en una fila horizontal compacta y ordenada con botones de acción reducidos (`size="sm"`).
    - Se incorporó la prop `compact?: boolean` en `CollapsibleSection` para un encabezado más esbelto y menor relleno vertical.
  - **Limpieza en el formulario de inscripción manual (`OrganizerRegistrationForm`):**
    - Se removió la descripción explicativa en texto gris bajo el título "Inscribir pareja manualmente" para una interfaz más despejada.
  - **Eliminación de cartelería redundante al pie de franjas e inscripciones:** en `app/(app)/torneos/[id]/canchas-franjas/page.tsx` y `app/(app)/torneos/[id]/inscripciones/page.tsx`, se retiraron los recuadros inferiores redundantes ("¿Listo con las franjas horarias?" y "Paso 4 de 4 del Asistente"), centralizando las acciones de navegación y finalización en el stepper superior.
- **Motivo:** responder a las solicitudes de usabilidad del usuario para agilizar la creación del torneo, evitar duplicación de botones, eliminar pasos y textos redundantes, y compactar la tarjeta de invitación.
### D-092 — Inscripciones agrupadas por categoría plegable y eliminación de pestaña Disponibilidad (2026-10-17)
- **Decisión:**
  - **Eliminación de la pestaña y vista "Disponibilidad":** en `TournamentNav` (`components/tournaments/tournament-nav.tsx`), el grupo `inscripciones` se redujo a un único elemento (`[{ segment: "inscripciones", label: "Inscripciones" }]`), suprimiendo la barra secundaria de subpestañas ("Equipos" / "Disponibilidad"). La ruta `app/(app)/torneos/[id]/disponibilidad/page.tsx` redirige de forma permanente a `/torneos/[id]/inscripciones`. La gestión de franjas por pareja se mantiene accesible de manera directa e intuitiva a través del modal `TeamAvailabilityDialog` en cada tarjeta de pareja.
  - **Inscripciones plegables por categoría (`RegistrationsList`):**
    - En `components/registration/registrations-list.tsx`, las parejas inscriptas ya no se presentan en un listado plano genérico, sino organizadas en tarjetas/secciones desplegables (accordions) independientes por cada categoría del torneo (más un grupo de contingencia para parejas no asignadas si existieran).
    - Cada encabezado de categoría muestra de forma clara el nombre de la categoría, el total de parejas inscriptas, el cupo ocupado/máximo, el desglose de aprobadas, pendientes y rechazadas, y un botón interactivo para abrir o plegar la lista de parejas.
    - Se incorporaron accesos rápidos "Expandir todas" y "Plegar todas" para agilizar la navegación del organizador.
    - Cuando una categoría se despliega, renderiza la grilla de parejas con su respectiva información (integrantes, roles de capitán/invitación, badges, selectores y acciones de aprobación/rechazo y franjas).
- **Motivo:** atender la solicitud directa del usuario de eliminar la pantalla de Disponibilidad y separar visualmente las parejas por categoría en paneles plegables accesibles mediante botón, simplificando la visualización y administración del torneo.
- **Cómo aplicar:** implementado en `components/tournaments/tournament-nav.tsx`, `app/(app)/torneos/[id]/disponibilidad/page.tsx`, `tests/e2e/a11y-security.spec.ts` y `components/registration/registrations-list.tsx`.

### D-093 — Eliminación de pestaña Resumen y botón verde para cerrar inscripciones y empezar fase de grupos (2026-10-17)
- **Decisión:**
  - **Eliminación completa de la sección "Resumen":**
    - En `TournamentNav` (`components/tournaments/tournament-nav.tsx`), se eliminó el grupo `resumen` de la barra de navegación principal. Las pestañas del panel del organizador quedan limpias y directas: Categorías, Canchas y franjas, Inscripciones, Competencia (Grupos, Partidos, Cuadro) y Configuración.
    - En `app/(app)/torneos/[id]/layout.tsx`, la recomendación para torneos finalizados se derivó a `competencia`.
    - La ruta raíz `app/(app)/torneos/[id]/page.tsx` se transformó en una redirección inteligente hacia la fase de trabajo activa del torneo (`/categorias` en borrador, `/inscripciones` con inscripción abierta, `/grupos` en fase de grupos, o `/cuadro` en playoffs/finalizado).
    - En el stepper de preparación (`components/tournaments/tournament-setup-stepper.tsx`), el paso inicial "Datos del torneo" ahora apunta a `configuracion` y se eliminó el botón "Finalizar y ver resumen".
  - **Botón verde "Cerrar inscripciones y empezar fase de grupos" (`CloseRegistrationButton`):**
    - Se creó el componente `CloseRegistrationButton` (`components/registration/close-registration-button.tsx`) estilizado con color verde esmeralda (`bg-emerald-600 hover:bg-emerald-500 text-white`).
    - Requiere al menos 2 parejas aprobadas para poder avanzar (deshabilitado con tooltip/aviso si no se cumple el cupo mínimo).
    - Al confirmarse, ejecuta la transición de estado a `group_stage` mediante `changeTournamentStatus`, notifica con toast y redirige inmediatamente al organizador a la pantalla de armado de zonas (`/torneos/[id]/grupos`).
    - Se integró tanto en la cabecera destacada de la pantalla de Inscripciones (`app/(app)/torneos/[id]/inscripciones/page.tsx`) como en el asistente superior `TournamentSetupStepper` al tener la inscripción abierta.
    - El diálogo modal de confirmación se simplificó por completo: muestra únicamente el título "¿Cerrar inscripciones?", sin párrafos de texto explicativo redundante, y con los dos botones limpios y proporcionales: "Cancelar" y "Confirmar" (estilizado con fondo verde esmeralda `!bg-emerald-600` y texto blanco nítido `!text-white` para garantizar alto contraste y legibilidad óptima).
- **Motivo:** responder a la solicitud del organizador de no tener la pantalla de Resumen y contar con un botón verde directo en Inscripciones para cerrar las inscripciones y pasar a la fase de grupos, con un diálogo de confirmación limpio y botones con contraste claro.
- **Cómo aplicar:** implementado en `components/tournaments/tournament-nav.tsx`, `app/(app)/torneos/[id]/layout.tsx`, `app/(app)/torneos/[id]/page.tsx`, `components/registration/close-registration-button.tsx`, `components/shared/confirm-action-button.tsx`, `components/tournaments/tournament-setup-stepper.tsx`, `app/(app)/torneos/[id]/inscripciones/page.tsx` y `tests/e2e/organizer.spec.ts`.

### D-094 — Reestructuración de pestañas con inscripción cerrada: Grupos, Partidos, Cuadro y Más (...) (2026-10-17)
- **Decisión:**
  - **Reorganización de la barra de navegación del torneo (`TournamentNav` en `components/tournaments/tournament-nav.tsx`):**
    - **Al cerrar la inscripción** (estados `group_stage`, `playoffs` o `finished`), las pestañas de primer nivel pasan a ser exclusivamente las secciones de competencia activa en el orden exacto solicitado:
      1. **Grupos** (`/torneos/[id]/grupos`)
      2. **Partidos** (`/torneos/[id]/partidos`)
      3. **Cuadro** (`/torneos/[id]/cuadro`)
      4. **Más (...)**: botón con icono de tres puntos horizontales (`MoreHorizontal`) y etiqueta *"Más"*, que despliega un menú flotante con las secciones de gestión y preparación en el orden estipulado:
         - **Canchas y franjas** (`/torneos/[id]/canchas-franjas`)
         - **Inscripciones** (`/torneos/[id]/inscripciones`)
         - **Configuración** (`/torneos/[id]/configuracion`)
         - **Categorías** (`/torneos/[id]/categorias`)
    - **Antes de cerrar la inscripción** (estados `draft` y `registration_open`), la barra presenta de forma limpia las secciones de preparación: Categorías, Canchas y franjas, Inscripciones y Configuración.
    - Se eliminó la subbarra secundaria de pestañas, logrando una interfaz de una sola línea horizontal con acceso directo y contextual.
    - El disparador *"Más"* se resalta automáticamente con borde activo cuando el organizador se encuentra navegando dentro de cualquiera de sus subopciones.
- **Motivo:** responder al pedido explícito del usuario de priorizar las vistas de competencia (Grupos, Partidos, Cuadro) de manera inmediata una vez cerrado el registro, agrupando las opciones de preparación en un menú desplegable "Más" con tres puntos.
- **Cómo aplicar:** implementado en `components/tournaments/tournament-nav.tsx`, `app/(app)/torneos/[id]/layout.tsx` y `tests/e2e/registration.spec.ts`.

### D-095 — Expansión del cuadro eliminatorio hasta 64 clasificados (32avos de final) (2026-10-17)
- **Decisión:**
  - **Límite máximo de clasificados:** se amplió `MAX_BRACKET_SIZE` de 32 a 64 en el dominio del cuadro (`lib/domain/bracket.ts`), permitiendo albergar categorías masivas de hasta 64 parejas (ej. 16 grupos de 4 o 3 parejas, con 45 a 64 clasificados).
  - **Ronda inicial de 32avos de final:** `roundName(round, totalRounds)` calcula dinámicamente los nombres de rondas (`${2 ** fromEnd}avos de final`), resolviendo `32avos de final` para la primera ronda en cuadros de tamaño 64 (6 rondas en total: 32avos, 16avos, Octavos, Cuartos, Semifinal y Final).
  - **Cuadro proyectado en fase de grupos:** en `lib/competition-view.ts` (`buildProjectedBracket`), se actualizó la validación del total de clasificados permitiendo entre 2 y 64 parejas (`totalQualifiers > 64`), de modo que categorías grandes con 16 zonas proyecten sus 63 cruces en tiempo real con sus respectivos byes para los mejores sembrados.
  - **Acciones y previsualización:** se actualizaron los topes de validación en `ensurePlayoffBracket` (`app/(app)/torneos/[id]/cuadro/actions.ts`) y `BracketGenerator` (`components/bracket/bracket-generator.tsx`), permitiendo armar y persistir cuadros de playoffs de hasta 64 parejas (aprovechando que la RPC `apply_bracket` ya soporta hasta 64 partidos en la base de datos).
- **Motivo:** solucionar el problema reportado por el usuario donde en categorías masivas (como 16 grupos y 61 parejas) el cuadro quedaba en blanco o fallaba por el tope previo de 32 clasificados.
- **Cómo aplicar:** implementado en `lib/domain/bracket.ts`, `lib/competition-view.ts`, `app/(app)/torneos/[id]/cuadro/actions.ts`, `components/bracket/bracket-generator.tsx` y testeado exhaustivamente en `lib/domain/bracket.test.ts`.

### D-096 — Identificación visual de horarios por colores (Verde, Amarillo y Rojo) al asignar franja (2026-10-17)
- **Decisión:**
  - **Función pura de evaluación de franjas (`getSlotEvaluation` en `lib/domain/scheduler.ts`):** evalúa en tiempo real cada franja horaria para el partido seleccionado según tres reglas determinísticas y mutuamente excluyentes:
    1. **Verde recuadrado (Disponible):** hay disponibilidad de al menos una cancha en ese horario y ambas parejas tienen disponibilidad para jugar.
    2. **Amarillo recuadrado (Una pareja no puede):** hay cancha libre, pero exactamente una de las dos parejas no puede jugar en ese horario (o no marcó disponibilidad).
    3. **Rojo recuadrado (No disponible / Conflicto):** todas las canchas están ocupadas en ese horario, o ninguna de las dos parejas puede jugar, o alguna de las dos parejas ya tiene otro partido fijado a esa misma hora.
  - **Selector interactivo con recuadros en `AssignSlotDialog` (`components/matches/assign-slot-dialog.tsx`):**
    - Se reemplazó el selector nativo HTML (`<NativeSelect>`) por una interfaz moderna con recuadros estilizados (`border-2 rounded-xl`) según el boceto del organizador:
      - Verde: `border-emerald-500/80 bg-emerald-500/10` con badge verde "Disponible" y detalle de canchas libres.
      - Amarillo: `border-amber-400 bg-amber-400/15` con badge ámbar "1 no puede" y detalle de qué pareja no tiene disponibilidad.
      - Rojo: `border-rose-500/80 bg-rose-500/10` con badge rojo "No disponible" y motivo explícito (canchas ocupadas o incompatibilidad de ambas parejas).
    - Incluye una barra de referencia visual en la cabecera (leyenda idéntica al boceto), filtro por días y selector de canchas libre/ocupada cuando la franja no tiene cancha preasignada.
- **Motivo:** responder a la solicitud del usuario de identificar visualmente en la asignación manual de horarios con verde, amarillo y rojo la disponibilidad real de canchas y parejas según su boceto.
- **Cómo aplicar:** implementado en `lib/domain/scheduler.ts`, `components/matches/assign-slot-dialog.tsx` y testeado exhaustivamente en `lib/domain/scheduler.test.ts`.

### D-097 — Navegación 100% vertical en el cuadro de playoffs sin desplazamientos laterales (2026-10-17)
- **Decisión:**
  - **Navegación vertical-first en `BracketView` (`components/bracket/bracket-view.tsx`):**
    - Por defecto, el cuadro se muestra en **Vista vertical**, organizando los cruces de forma secuencial y responsiva en columnas verticales (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) que se adaptan al ancho completo de la pantalla sin requerir ningún movimiento o scroll horizontal.
    - Se incorporó una barra superior de selección rápida de rondas (`flex-wrap`): "Todas las rondas", "32avos de final", "16avos de final", "Octavos de final", "Cuartos de final", "Semifinales" y "Final" para leer o filtrar directamente cualquier etapa del torneo de arriba hacia abajo.
    - Se preservó un conmutador alternativo a "Árbol" para quienes deseen ver el diagrama clásico en formato ramificado horizontal.
  - **Eliminación de scroll horizontal en `AssignSlotDialog` (`components/matches/assign-slot-dialog.tsx`):**
    - Los botones de filtro por día ahora utilizan `flex-wrap` en lugar de `overflow-x-auto`, y el diálogo cuenta con `overflow-x-hidden`, garantizando que todo el contenido se lea con desplazamiento exclusivamente vertical.
- **Motivo:** atender el pedido directo del usuario de leer el cuadro y los horarios únicamente con desplazamientos verticales, eliminando la necesidad de moverse hacia los lados.
- **Cómo aplicar:** implementado en `components/bracket/bracket-view.tsx` y `components/matches/assign-slot-dialog.tsx`.

### D-098 — Sorteo simultáneo de todas las categorías y optimización profunda de programación de partidos (2026-10-18)
- **Decisión:**
  - **Sorteo masivo de categorías en lote (`drawAllCategories` en `app/(app)/torneos/[id]/grupos/actions.ts`):**
    - Permite al organizador sortear los grupos de todas las categorías del torneo en una sola operación desde la pestaña de Grupos (`/torneos/[id]/grupos`).
    - Excluye automáticamente categorías con resultados cargados (`result_status is not null`) para proteger los cruces ya jugados.
    - Sortea únicamente categorías con al menos 2 parejas aprobadas, calculando la cantidad recomendada de zonas (priorizando grupos de 4 con formato GSL o de 3/5 con Round-Robin) o respetando la configuración elegida por el organizador.
    - Aplica a cada categoría el algoritmo `drawGroups` consciente de la disponibilidad horaria declarada de cada pareja (D-063), maximizando la compatibilidad intrazona y persistiendo los partidos iniciales mediante la RPC `apply_groups`.
    - Si una categoría elegible se encontraba en inscripción abierta (`registration_open`) o borrador (`draft`), la avanza automáticamente a `group_stage` mediante `set_category_status`.
  - **Interfaz de usuario en `BulkDrawDialog` (`components/groups/bulk-draw-dialog.tsx`):**
    - Botón destacado en el encabezado de categorías: "Sortear todas las categorías".
    - Modal accesible y responsive que lista todas las categorías, su estado, cantidad de parejas aprobadas y selector de cantidad de zonas sugeridas (editable).
    - Mantiene intacta la posibilidad de ingresar a la pestaña de cualquier categoría para reordenar parejas individualmente con Drag & Drop (`GroupBuilder`) antes de iniciar los partidos.
  - **Optimización del programador automático (`scheduleMatches` y `drawGroups`):**
    - Se incrementó `DEFAULT_MAX_ITERATIONS` de 50.000 a 150.000 en `lib/domain/scheduler.ts`, triplicando la profundidad de exploración del algoritmo de backtracking con poda branch & bound. Esto asegura que en torneos con múltiples categorías y decenas de partidos en simultáneo no se corte la búsqueda prematuramente y se agende la mayor cantidad de partidos en cancha.
    - En `drawGroups` (`lib/domain/groups.ts`), se amplió la cantidad de reinicios (`RESTARTS`) de 40 a 60 cuando persisten incompatibilidades horarias, reduciendo al mínimo la probabilidad de que parejas sin franjas comunes compartan grupo y asegurando que luego todos los partidos tengan horarios disponibles.
- **Motivo:** agilizar sustancialmente el flujo del organizador en torneos con múltiples categorías evitando tener que sortear categoría por categoría de forma manual, y asegurar la máxima tasa de ocupación de canchas y partidos programados sin dejar parejas sin horario.
- **Cómo aplicar:** implementado en `lib/domain/groups.ts`, `lib/domain/scheduler.ts`, `lib/validation/competition.ts`, `app/(app)/torneos/[id]/grupos/actions.ts`, `components/groups/bulk-draw-dialog.tsx`, `app/(app)/torneos/[id]/grupos/page.tsx` y verificado con la suite completa de tests de Vitest.

### D-099 — Disponibilidad completa por defecto al cargar parejas (2026-10-18) *(modifica D-091)*
- **Decisión:**
  - **Carga masiva (`BulkRegistrationDialog` en `components/registration/bulk-registration-dialog.tsx`):**
    - La opción `allSlots` ("Asignar disponibilidad completa a todas las parejas importadas") ahora se inicializa activada por defecto (`true`), asegurando que al importar listas de texto o WhatsApp todas las parejas queden inmediatamente habilitadas para jugar en cualquier franja del torneo.
    - En `bulkImportTeams` (`app/(app)/torneos/[id]/inscripciones/actions.ts`), si el torneo aún no cuenta con franjas horarias creadas al momento de importar, la importación se completa igualmente sin interrumpirse por error.
  - **Carga individual manual (`OrganizerRegistrationForm` en `components/registration/organizer-registration-form.tsx`):**
    - El formulario manual ahora preselecciona todas las franjas horarias del torneo por defecto (`slotIds: slots.map(s => s.id)`), tanto en la carga inicial como al resetear el formulario tras inscribir cada pareja.
    - Si el organizador desea restringir alguna franja particular para una pareja específica, puede deseleccionar las franjas no deseadas o ajustarlas con los botones "Deseleccionar todas" / "Ninguna".
- **Motivo:** responder a la solicitud del organizador de que las parejas nuevas cuenten por defecto con disponibilidad en todas las franjas horarias del torneo, evitando que queden parejas sin franjas y facilitando la programación automática al 100% de ocupación de canchas.
- **Cómo aplicar:** implementado en `components/registration/bulk-registration-dialog.tsx`, `components/registration/organizer-registration-form.tsx` y `app/(app)/torneos/[id]/inscripciones/actions.ts`.

### D-100 — Rediseño UI de tarjetas de torneo y corrección del cálculo de cupos por categorías (2026-10-18) *(modifica D-053)*
- **Decisión:**
  - **Eliminación del bug de cupo estático (`/16`) en torneos:**
    - Se corrigió la consulta de torneos organizados (`listOrganizedTournaments` en `lib/data/tournaments.ts`) para cargar las categorías del torneo (`tournament_categories`) y asociar los equipos inscriptos a sus categorías respectivas.
    - Se erradicó el indicador erróneo que forzaba `X / 16 parejas` proveniente de la columna estática legacy `tournaments.max_teams`. Ahora, si todas las categorías tienen cupo configurado, el cupo total es la suma de los cupos de las categorías (`totalCapacity`). Si las categorías tienen cupo abierto o no poseen límite fijo, se muestra claramente como inscripción libre/abierta sin barra desbordada ni tope artificial.
  - **Diseño de interfaz y experiencia de usuario (UI/UX) mejorada:**
    - **Tarjetas de torneos organizados (`OrganizedTournamentCard` en `components/tournaments/tournament-card.tsx`):**
      - Muestra un listado estilizado de chips de las categorías del torneo (ej. `3 categorías: 7ma Damas (12) · 6ta Caballeros (10) · 5ta Libre (8)`), permitiendo al organizador y jugador saber inmediatamente qué categorías integran la competencia.
      - Panel de inscripciones directo: `{tournament.approvedTeams} parejas inscriptas` sin fracciones confusas ni barras de progreso artificiales contra 16, más alerta en ámbar si existen parejas esperando aprobación.
      - Barra superior de estado con degradados vibrantes e identificatorios por fase.
      - Botón de navegación contextual que guía al organizador directamente a la acción clave de la fase (ej. "Gestionar inscripciones", "Gestionar grupos", "Ver cuadro").
    - **Panel principal de torneos (`TournamentDashboard` en `components/tournaments/tournament-dashboard.tsx`):**
      - Vista limpia y directa centrada en las tarjetas de torneos y el selector de pestañas, sin bloques redundantes de métricas superiores a pedido del usuario.
    - **Página de inscripciones del torneo (`app/(app)/torneos/[id]/inscripciones/page.tsx`):**
      - Se actualizó el encabezado de cupos para reflejar la suma real de las categorías configuradas y evitar la mención estática a 16.
- **Motivo:** responder a la solicitud del usuario de actuar con rol de diseñador profesional de UI/UX, eliminar la indicación incongruente de "30/16 parejas" derivada del valor inicial de 16 de la tabla tournaments, y dotar a la vista de un diseño moderno, claro y alineado con la arquitectura multicategoría sin elementos distractores.
- **Cómo aplicar:** implementado en `lib/data/tournaments.ts`, `components/tournaments/tournament-card.tsx`, `components/tournaments/tournament-dashboard.tsx` y `app/(app)/torneos/[id]/inscripciones/page.tsx`.

### D-101 — Botones de navegación superior con estado hover destacado dinámico (2026-10-18) *(modifica D-058)*
- **Decisión:**
  - **Identificación visual y comportamiento en la barra de navegación superior:**
    - El enlace del logo de marca **Torneos** (`AppHeader` en `components/layout/app-header.tsx`) se mantiene como logo limpio sin recuadro permanente ni fondo coloreado en ningún momento.
    - Las opciones de navegación (`MainNav` en `components/layout/main-nav.tsx`: Circuitos, Próximos, Mi historial) tienen formato píldora (`h-9 px-3.5 rounded-xl border border-transparent`).
    - **En reposo:** no tienen fondo de color permanente (la opción activa solo resalta con tipografía clara `text-foreground font-semibold`).
    - **Hover (al posar el cursor):** exclusivamente cuando el usuario se para sobre una opción con el mouse, todo el botón se rellena ("pinta") con fondo ámbar dorado (`bg-amber-500/15 dark:bg-amber-500/20`), borde visible (`border-amber-500/30`) y texto contrastante (`text-amber-900 dark:text-amber-200`). Al retirar el cursor, el color se apaga de inmediato.
- **Motivo:** corregir la fijación permanente del fondo dorado en "Torneos" que entorpecía la cabecera, asegurando que la acción de "pintar" el botón ocurra únicamente de manera dinámica al interactuar con el cursor.
- **Cómo aplicar:** implementado en `components/layout/main-nav.tsx` y `components/layout/app-header.tsx`.

### D-102 — Redirección a franjas al crear torneo e integración de categorías en Inscripciones (2026-10-18) *(modifica D-053, D-054 y D-069)*
- **Decisión:**
  - **Flujo de creación de torneo directo a Canchas y Franjas:**
    - Al crear un torneo (`TournamentWizard` en `components/tournaments/tournament-wizard.tsx`), el asistente redirige inmediatamente al paso de Franjas horarias (`/torneos/[id]/canchas-franjas?asistente=1`) en lugar de categorías.
    - La redirección raíz en borrador (`app/(app)/torneos/[id]/page.tsx`) dirige a `/torneos/[id]/canchas-franjas`.
  - **Apartado independiente de Categorías obsoleto:**
    - Se eliminó el paso "Categorías" del asistente de preparación (`TournamentSetupStepper` en `components/tournaments/tournament-setup-stepper.tsx`), reduciendo el flujo a 3 pasos claros: 1. Datos del torneo (`configuracion`) -> 2. Franjas horarias (`canchas-franjas`) -> 3. Inscripciones (`inscripciones`).
    - Se quitó "Categorías" de las pestañas superiores de navegación del torneo (`TournamentNav` en `components/tournaments/tournament-nav.tsx`).
    - La ruta anterior `/torneos/[id]/categorias` ahora redirige automáticamente a `/torneos/[id]/inscripciones`.
  - **Gestor ágil de categorías en Inscripciones (`CategoryQuickManager`):**
    - Se creó el componente `CategoryQuickManager` (`components/categories/category-quick-manager.tsx`) integrado en `app/(app)/torneos/[id]/inscripciones/page.tsx`.
    - Presenta un botón verde accesible y destacado ("Agregar categoría": `bg-emerald-600 hover:bg-emerald-500 text-white font-semibold`) que abre el modal para definir el nombre y cupo de la categoría.
    - Muestra la lista compacta de categorías existentes con sus cupos, cantidad de inscriptos y acciones rápidas de edición/eliminación, integrándose armónicamente con el formulario manual de inscripción y el listado de parejas.
- **Motivo:** atender el pedido directo del usuario para simplificar el flujo inicial de preparación del torneo llevándolo directo a franjas tras la creación, declarando obsoleto el apartado separado de categorías y concentrando la creación y gestión de categorías directamente en la pantalla de Inscripciones.
- **Cómo aplicar:** implementado en `components/tournaments/tournament-wizard.tsx`, `app/(app)/torneos/[id]/page.tsx`, `components/tournaments/tournament-setup-stepper.tsx`, `components/tournaments/tournament-nav.tsx`, `components/categories/category-quick-manager.tsx`, `app/(app)/torneos/[id]/inscripciones/page.tsx` y `app/(app)/torneos/[id]/categorias/page.tsx`.

### D-103 — Remoción de pestaña Historial y simplificación del dashboard de torneos (2026-10-18)
- **Decisión:**
  - Se eliminó la pestaña "Historial" del dashboard de torneos (`tournaments-view.tsx`), dejando únicamente las vistas: **Todos**, **Organizo** y **Participo**.
  - La ruta dedicada `/historial` continúa existiendo para consultas específicas.
- **Motivo:** simplificar la interfaz principal de torneos según las prioridades del usuario.
- **Cómo aplicar:** implementado en `components/tournaments/tournaments-view.tsx`.

### D-104 — Intercambio directo (Swap) y detalle de horarios en Grupos, y reemplazo de jugadores por lesión (2026-10-18)
- **Decisión:**
  - **Intercambio directo de parejas (Swap) en el armado de grupos:**
    - Se incorporó en cada tarjeta de pareja (`TeamChip` en `components/groups/group-builder.tsx`) un botón de intercambio (`ArrowLeftRight`) que abre `SwapTeamsModal`.
    - Permite al organizador seleccionar con qué pareja de otra zona intercambiar de manera inmediata, manteniendo intacta la cantidad equilibrada de parejas por grupo sin necesidad de realizar múltiples movimientos o desbalancear zonas.
    - El modal indica la compatibilidad horaria resultante en ambos grupos destino y origen.
  - **Detalle de horarios y coincidencias en Grupos (`SlotMatchesModal`):**
    - `GroupBuilder` recibe las franjas horarias (`slots`), canchas (`courts`) y zona horaria (`timezone`).
    - En cada pareja de la zona se muestra un badge interactivo de horarios: si hay conflicto resalta en ámbar con advertencia, y si tienen disponibilidad muestra el botón de horarios.
    - Al hacer clic abre `SlotMatchesModal` con el desglose exacto de compatibilidad cruce por cruce con cada rival de la zona (indicando día, hora y cancha), además del listado completo de franjas declaradas por la pareja.
  - **Reemplazo / Edición rápida de jugadores por lesión (`ReplacePlayerDialog`):**
    - Se agregó el botón "Reemplazar" (`UserPen`) tanto en cada integrante como en el pie de la tarjeta en `registrations-list.tsx`.
    - Abre `ReplacePlayerDialog` para que el organizador pueda cambiar el nombre del integrante por lesión o sustitución, con actualización opcional y sugerida del nombre compuesto de la pareja (ej: "Jugador 1 / Jugador 2").
    - Se creó la RPC `replace_team_player` (`20261018220000_replace_team_player_for_injury.sql`) y la Server Action `replaceTeamPlayer` (`lib/validation/registration.ts` y `app/(app)/torneos/[id]/inscripciones/actions.ts`), permitiendo actualizar al jugador sin romper partidos, grupos, cuadros ni resultados ya generados.
- **Motivo:** brindar máxima agilidad al organizador para ajustar zonas balanceadas con compatibilidad horaria transparente y resolver contingencias habituales de jugadores lesionados antes o durante el torneo.
- **Cómo aplicar:** implementado en `components/groups/group-builder.tsx`, `components/groups/swap-teams-modal.tsx`, `components/groups/slot-matches-modal.tsx`, `components/registration/replace-player-dialog.tsx`, `components/registration/registrations-list.tsx`, `app/(app)/torneos/[id]/inscripciones/actions.ts`, `lib/validation/registration.ts` y migración SQL `20261018220000_replace_team_player_for_injury.sql`.

### D-105 — Optimización integral de asignación de horarios, métricas y gestión de franjas (2026-10-19)
- **Decisión:**
  - **Asignación manual de horarios con selección inteligente y análisis de descanso (`AssignSlotDialog`):**
    - **Auto-selección de cancha libre:** al seleccionar una franja horaria general (sin cancha prefijada), si la cancha activa se encuentra ocupada por otro encuentro en ese horario, el diálogo conmuta automáticamente a la primera cancha libre disponible. Esto elimina de raíz los falsos conflictos de cancha ocupada cuando el organizador selecciona una franja verde (con canchas libres).
    - **Filtros rápidos por disponibilidad:** se incorporaron botones de filtrado inmediato: *Todas*, *🟢 Solo disponibles* (franjas verdes donde ambas parejas pueden jugar y hay cancha libre) y *🟡 1 no puede* (franjas amarillas), permitiendo al organizador localizar al instante los horarios viables en torneos con decenas de turnos sin desplazamientos excesivos.
    - **Análisis de descanso de las parejas (`teamRestInsights`):** al seleccionar una franja, el diálogo analiza automáticamente si alguna de las parejas disputa otro partido en la jornada y muestra un bloque informativo con el tiempo de descanso resultante (*✨ Descanso óptimo*, *⚠️ Menos de 15 min de descanso* o *⏱️ Tiempo de espera*), garantizando cronogramas equilibrados y sin sobrecargas físicas.
  - **Detección de descansos cortos en el dominio (`checkManualAssignment` en `lib/domain/scheduler.ts`):**
    - Si un partido no se superpone pero se encuentra contiguo a otro del mismo equipo con menos de 15 minutos de descanso, el validador emite una advertencia preventiva para notificar al organizador.
  - **Gestión masiva y métricas de capacidad en Canchas y Franjas (`SlotsManager`):**
    - **Borrado por día:** botón de acción rápida *"Borrar día"* en cada jornada con confirmación segura para eliminar en 1 clic todos los turnos de una fecha determinada.
    - **Borrado total de franjas:** botón *"Borrar todas las franjas"* en la cabecera para resetear los turnos del torneo con confirmación explicativa (útil al cambiar la duración de partidos de 90 a 60 min o regenerar el fixture).
    - **Resumen de capacidad horaria:** panel superior con métricas clave: total de turnos disponibles, partidos programados, días cubiertos y horas estimadas totales de juego en el club.
- **Motivo:** responder a la solicitud del usuario de evaluar y optimizar a fondo el tema de horarios, agilizando la asignación manual sin errores de cancha, facilitando el filtrado por disponibilidad y permitiendo la administración masiva de franjas horarias.
- **Cómo aplicar:** implementado en `components/matches/assign-slot-dialog.tsx`, `lib/domain/scheduler.ts`, `lib/domain/scheduler.test.ts`, `components/tournaments/slots-manager.tsx` y verificado con Vitest y typecheck.

### D-106 — Duración predeterminada de 60 minutos por partido en franjas y horarios (2026-10-19)
- **Decisión:**
  - En la gestión de franjas horarias (`SlotsManager` en `components/tournaments/slots-manager.tsx`), la duración predeterminada por partido se cambió de 90 a **60 minutos**:
    - En el generador en lote (`SlotGenerator`), el valor por defecto de `durationMinutes` ahora es `60` (en lugar de `90`).
    - En el formulario individual de franja (`SingleSlotForm`), el intervalo inicial predeterminado se ajustó a 1 hora completa (`start: "18:00"`, `end: "19:00"`, en lugar de 18:00 a 19:30).
- **Motivo:** atender el pedido directo del usuario para que la duración estándar predeterminada por turno de partido sea de 60 minutos en la configuración de franjas.
- **Cómo aplicar:** implementado en `components/tournaments/slots-manager.tsx`.

### D-107 — Personalización de fondo y formato Historia (9:16) para descarga de Zonas y Grupos (2026-10-19)
- **Decisión:**
  - **Soporte de fondos temáticos en Canvas 2D (`renderGroupsToCanvas` en `lib/graphics/groups-image.ts`):**
    - Se incorporaron fondos fotográficos de alta resolución para pádel en `public/backgrounds/`: *Pádel Rojo* (cancha exterior con césped rojo y paredes de vidrio, idéntico a la referencia solicitada), *Pádel Azul* (cancha panorámica indoor con iluminación LED), *Pádel Verde* y el clásico *Oscuro*.
    - **Carga de foto propia (`custom`):** el usuario u organizador puede subir cualquier fotografía de su club, canchas reales o sponsors desde su dispositivo con previsualización inmediata.
    - **Ajuste de cobertura y viñeta inteligente (`drawImageCover`):** la imagen de fondo se ajusta automáticamente cubriendo el lienzo sin deformarse, aplicando un filtro de oscurecimiento y viñetas superior/inferior para garantizar legibilidad absoluta y contraste en los nombres de las parejas y encabezados.
  - **Formato Historia 9:16 para WhatsApp / Instagram:**
    - Se incorporó la opción de renderizar en resolución 1080x1920 (proporción 9:16) con diseño estilo póster deportivo: bloque superior blanco con el nombre del torneo en tipografía destacada, cinta roja con la categoría/zonas y tarjetas oscuras con esquinas redondeadas (`rgba(10, 12, 16, 0.88)`), divisores nítidos y parejas centradas.
    - Se mantiene la opción de conmutar al formato *Estándar* (1200px horizontal adaptativo).
  - **Selector dinámico en el modal (`ExportGroupsImageModal` en `components/groups/export-groups-image-modal.tsx`):**
    - Barra de herramientas con selector de formato (📱 Historia 9:16 vs 🖼️ Estándar) y botones de fondo con indicador visual de color y opción para cambiar foto personalizada.
    - Memoria caché de imágenes precargadas para que el cambio entre fondos y formatos sea instantáneo.
- **Motivo:** responder a la solicitud del usuario para elegir fondos temáticos de cancha de pádel y formatos adaptados para estados y grupos de WhatsApp con alta calidad visual.
- **Cómo aplicar:** implementado en `lib/graphics/groups-image.ts`, `components/groups/export-groups-image-modal.tsx`, `lib/graphics/groups-image.test.ts`, assets en `public/backgrounds/` y verificado con Vitest y typecheck.

### D-108 — Co-administradores de torneo y enlaces de invitación por WhatsApp (2026-10-19)
- **Decisión:**
  - **Modelo de datos y RLS (`20261019160000_tournament_admins_and_collaborators.sql`):**
    - Tabla `tournament_admins (tournament_id, user_id, role, created_at)`: registra los colaboradores asignados como administradores del torneo.
    - Tabla `tournament_admin_invites (tournament_id, code, rotated_at, created_at)`: almacena el código único de 10 caracteres alfanuméricos para generar el enlace de invitación de administradores.
    - Actualización del helper privado `private.is_tournament_organizer(p_tournament_id)`: retorna `true` si el usuario es el dueño del torneo o si figura en `tournament_admins`. Esto habilita automáticamente a los co-administradores en todas las tablas bajo RLS (canchas, franjas, categorías, partidos, resultados, etc.).
    - Actualización de `public.require_match_organizer(p_match_id)` y RPCs operativas (`apply_groups`, `apply_schedule`, `apply_bracket`, `set_tournament_status`, `replace_team_player`, `create_organizer_team`): permiten que los administradores realicen todas las gestiones operativas del torneo.
    - Restricción de facultades críticas: solo el organizador principal (`tournaments.organizer_id = auth.uid()`) puede eliminar el torneo, rotar el enlace de administradores o quitar otros administradores.
    - Nuevas RPCs: `get_admin_invite_info(p_code)`, `join_tournament_as_admin(p_code)`, `rotate_tournament_admin_invite(p_tournament_id)` y `remove_tournament_admin(p_tournament_id, p_user_id)`.
  - **Consultas y dashboard (`lib/data/tournaments.ts`):**
    - `listOrganizedTournaments(userId)`: incluye tanto los torneos creados por el usuario como aquellos en los que participa como co-administrador, mostrándolos en la pestaña "Organizo" del dashboard.
    - `getOrganizerTournament(tournamentId, userId)`: autoriza el acceso a co-administradores y retorna la bandera `isOwner`.
    - `getTournamentAdmins(tournamentId)`: lista el dueño y los administradores colaboradores.
  - **Interfaz de usuario:**
    - Panel de gestión en `/torneos/[id]/configuracion` (`TournamentAdminsManager` en `components/tournaments/tournament-admins-manager.tsx`):
      - Visualización del equipo organizador con badges distintivos.
      - Enlace de invitación de administradores listo para copiar o compartir por WhatsApp con un solo clic.
      - Botón de rotación de enlace para revocar accesos previos.
      - Botón de eliminación de administradores exclusivo para el dueño.
      - La "Zona de peligro" (eliminar torneo) se oculta para los co-administradores.
    - Pantalla de aceptación en `/torneos/unirse-admin?code=...` (`app/(app)/torneos/unirse-admin/page.tsx` y `JoinAdminCard`):
      - Muestra el nombre del torneo, deporte, organizador y alcance de los permisos.
      - Botón "Aceptar y unirme como administrador" que procesa el alta en 1 clic y redirige al panel del torneo.
- **Motivo:** responder a la solicitud del usuario para que el organizador pueda delegar la carga de resultados, gestión de horarios y administración de partidos en colaboradores designados.
- **Cómo aplicar:** migración `supabase/migrations/20261019160000_tournament_admins_and_collaborators.sql`, `lib/data/tournaments.ts`, `components/tournaments/tournament-admins-manager.tsx`, `components/tournaments/join-admin-card.tsx`, `app/(app)/torneos/unirse-admin/page.tsx`, `app/(app)/torneos/[id]/actions.ts`, `app/(app)/torneos/[id]/configuracion/page.tsx`.

### D-109 — Personalización de fondo y formato Historia (9:16) para descarga de Partidos y Horarios (2026-10-19)
- **Decisión:**
  - **Soporte de fondos temáticos en `renderMatchesToCanvas` (`lib/graphics/matches-image.ts`):**
    - Se habilitó la selección de fondos de cancha de pádel de alta resolución (*Pádel Rojo*, *Pádel Azul*, *Pádel Verde* y *Oscuro clásico*) o foto personalizada propia del club/canchas para la generación de imágenes del cronograma y fixture de partidos.
    - Se aplica ajuste `cover` automático con filtro de oscurecimiento y viñetas superior e inferior para garantizar contraste impecable en la lectura de horarios, sedes, parejas y marcadores.
  - **Formato Historia 9:16 (1080x1920) para WhatsApp / Instagram:**
    - Incorporación de diseño de poster vertical optimizado para estados con tarjeta superior blanca del torneo, banner rojo con la categoría/horarios y tarjetas de enfrentamiento oscuras y redondeadas (`rgba(10, 12, 16, 0.88)`).
    - Se mantiene la opción de conmutar al formato *Estándar* (1200px horizontal adaptativo).
  - **Selector integrado en el modal (`ExportMatchesImageModal` en `components/matches/export-matches-image-modal.tsx`):**
    - Toolbar con selector de formato (📱 Historia 9:16 vs 🖼️ Estándar) y botones de fondo con indicador visual de color y selector de foto propia.
    - Integración armónica con los filtros existentes por categoría, día y etapa del torneo, con renderizado fluido mediante caché de imágenes en memoria.
- **Motivo:** responder al pedido directo del usuario para contar con las mismas opciones de fondo temático de cancha de pádel y formatos de redes en la exportación de imágenes de partidos y horarios.
- **Cómo aplicar:** implementado en `lib/graphics/matches-image.ts`, `components/matches/export-matches-image-modal.tsx`, `lib/graphics/matches-image.test.ts` y verificado con Vitest y typecheck.

### D-110 — Insignia de copa brillante en la tarjeta de la Final del cuadro (2026-10-19)
- **Decisión:**
  - En la tarjeta del partido de la **Final** del cuadro de playoffs (`MatchCard` en `components/bracket/bracket-view.tsx`):
    - Se incorporó en el lateral derecho de la zona de equipos un medallón circular dorado con la silueta de la copa (`TrophyLogo` con `rounded="full"`, degradado metálico oro `#FDE68A` -> `#F59E0B` -> `#D97706`, resplandor cálido y destello blanco periódico animado mediante `.animate-trophy-shine`).
    - La tarjeta de la Final se resalta con borde dorado y sutil anillo de brillo (`border-amber-500/50 ring-1 ring-amber-500/30 shadow-md shadow-amber-500/10`) y cabecera en tonos ámbar con `★ Final`.
    - Cuando la Final se define, el equipo ganador se destaca en dorado con el trofeo y la etiqueta "Campeón".
    - Se extendió el componente `TrophyLogo` (`components/brand/trophy-logo.tsx`) con soporte para tamaño `xl` y la propiedad `rounded="full"`.
    - En la exportación gráfica del cuadro (`renderBracketToCanvas` en `lib/graphics/bracket-image.ts`), se adaptó el dibujo de la tarjeta final para incluir el medallón dorado de la copa, garantizando total coherencia entre la interfaz interactiva y la imagen descargable para redes.
- **Motivo:** requerimiento y boceto provisto por el usuario para jerarquizar el partido decisivo del torneo con una copa brillante idéntica a la insignia del logo de Torneos.
- **Cómo aplicar:** `components/brand/trophy-logo.tsx`, `components/bracket/bracket-view.tsx`, `lib/graphics/bracket-image.ts`.

### D-111 — Corrección de renderizado y envío de partidos por día (2026-10-19)
- **Decisión:**
  - **Corrección de bucle infinito en modal de horarios (`components/matches/export-matches-image-modal.tsx`):**
    - Se eliminó `imageUrl` de las dependencias de `generateImage` (su presencia provocaba que la creación de un nuevo ObjectURL recreara el callback y volviera a disparar el `useEffect` en un ciclo sin fin que dejaba el modal en estado de generación permanente).
    - Se limitó `crossOrigin = "anonymous"` en `loadImage` exclusivamente a URLs remotas `http(s)://`, previniendo errores de CORS con rutas locales (`/backgrounds/...`) o URLs `blob:` de fotos personalizadas.
    - Se aisló la carga de imágenes con manejo de errores preventivo y se dimensionó el canvas antes de la obtención de su contexto 2D en `lib/graphics/matches-image.ts`.
  - **Restauración y potenciación del envío de partidos por día:**
    - El selector de **Día** en el modal se muestra siempre que existan días programados o partidos sin horario (ya no se oculta arbitrariamente si sólo hay 1 día con partidos agendados).
    - Se incorporó un botón directo `Mandar día` en la cabecera de cada fecha dentro del tablero de partidos (`MatchesBoard` en `components/matches/matches-board.tsx`), abriendo el modal prefiltrado para esa fecha específica.
    - Se sumó la acción `Mandar texto WhatsApp` en el pie del modal, que formatea el cronograma completo o del día seleccionado en texto legible con formato deportivo y abre WhatsApp copiando además el texto al portapapeles.
- **Motivo:** solucionar el bloqueo del modal reportado por el usuario y reponer la funcionalidad crítica de compartir los partidos por día.
- **Cómo aplicar:** `components/matches/export-matches-image-modal.tsx`, `components/matches/matches-board.tsx`, `lib/graphics/matches-image.ts`, `app/(app)/torneos/[id]/partidos/page.tsx`.

### D-112 — Eliminación del cartel global de campeón único (2026-10-19)
- **Decisión:**
  - Se eliminó el cartel/banner superior "Campeón: [pareja]" en la vista pública (`app/t/[slug]/page.tsx`) y en la vista organizador del cuadro (`app/(app)/torneos/[id]/cuadro/page.tsx`).
  - En la tarjeta de torneo finalizado (`FinishedTournamentCard` en `components/tournaments/tournament-card.tsx`), se reemplazó el recuadro que destacaba a un único campeón por el estado neutro unificado `"Edición finalizada y resultados archivados"`.
  - El reconocimiento del campeón se mantiene localizado y contextualmente exacto dentro de cada categoría, en la tarjeta de la Final del cuadro de playoffs (`BracketView` con la insignia de la copa brillante y etiqueta dorada de Campeón de D-110).
- **Motivo:** al admitir torneos con múltiples categorías, el cartel global quedaba obsoleto y engañoso al mostrar únicamente el campeón de la primera categoría creada en lugar de representar los campeones correspondientes a cada categoría.
- **Cómo aplicar:** `app/t/[slug]/page.tsx`, `app/(app)/torneos/[id]/cuadro/page.tsx`, `components/tournaments/tournament-card.tsx`, `tests/e2e/playoffs.spec.ts`.

### D-113 — Formato 9:16 único, acciones arriba y diseño responsive en modales de descarga (2026-10-19)
- **Decisión:**
  - **Fijación de formato 9:16 (Historia / WhatsApp):**
    - Se eliminó el selector de conmutación de formato (Historia 9:16 vs Estándar 1200px) en `ExportGroupsImageModal` (`components/groups/export-groups-image-modal.tsx`) y `ExportMatchesImageModal` (`components/matches/export-matches-image-modal.tsx`), fijando el formato por defecto y único a `story` (1080x1920, 9:16) ideal para estados y difusión en WhatsApp.
  - **Diseño 100% responsive y acciones al tope (sin necesidad de scroll):**
    - Para evitar que la opción de compartir quede "muy abajo" o requiera scroll incómodo, se ubicaron los botones de acción principales ("Compartir directo", "Descargar", "Copiar imagen" y "Texto WhatsApp") **arriba de todo**, inmediatamente debajo del encabezado del modal.
    - Se configuró `DialogContent` con `overflow-y-auto` y `max-h-[90dvh]` en todos los modales de descarga (`ExportGroupsImageModal`, `ExportMatchesImageModal` y `ExportBracketImageModal`), eliminando cualquier bloqueo de scroll.
    - La vista previa se adaptó a un escalado dinámico compacto (`max-h-[30dvh]` / `max-h-[38dvh]`), garantizando que la botonera de compartir y el selector de fondo estén siempre visibles en cualquier resolución.
- **Motivo:** responder a la solicitud del usuario de prescindir del selector de formato y resolver de raíz que el botón de compartir quedaba muy abajo o cortado en pantallas de celular.
- **Cómo aplicar:** `components/groups/export-groups-image-modal.tsx`, `components/matches/export-matches-image-modal.tsx`, `components/bracket/export-bracket-image-modal.tsx`.

### D-114 — Foto realista de cancha roja sin personas y eliminación de opción Verde (2026-10-19)
- **Decisión:**
  - **Reemplazo de fondo rojo por fotografía arquitectónica realista (`public/backgrounds/padel-red.jpg`):**
    - Se sustituyó la imagen anterior por una toma fotográfica nítida y fotorrealista de cancha de pádel vacía (sin jugadores), con césped sintético terracota/ladrillo auténtico, paredes de cristal templado panorámico, columnas de reja negra y líneas blancas reglamentarias.
  - **Eliminación de la opción "Pádel Verde":**
    - Se retiró la opción `padel-green` de la botonera de fondos en `ExportGroupsImageModal` (`components/groups/export-groups-image-modal.tsx`) y `ExportMatchesImageModal` (`components/matches/export-matches-image-modal.tsx`), dejando las opciones limpias: *Pádel Rojo* (foto real), *Pádel Azul*, *Oscuro* y *Mi foto*.
- **Motivo:** requerimiento estético del usuario para contar con una foto roja que luzca real y profesional sin jugadores, y retirar la variante verde no deseada.
- **Cómo aplicar:** `public/backgrounds/padel-red.jpg`, `components/groups/export-groups-image-modal.tsx`, `components/matches/export-matches-image-modal.tsx`.

### D-115 — Corrección de enlace para unirse como administrador (`get_admin_invite_info`) (2026-10-19)
- **Decisión:**
  - **Corrección de referencia a columna en `public.profiles`:**
    - La tabla `public.profiles` contiene la columna `full_name`, no `display_name` (ésta última corresponde a `public.team_members`).
    - En la función SQL RPC `get_admin_invite_info`, la consulta utilizaba `p.display_name as organizer_name`, lo cual arrojaba el error PostgreSQL `42703 (column p.display_name does not exist)` al abrir el enlace `/torneos/unirse-admin?code=...`, provocando que la interfaz cayera en la pantalla de error `"Invitación no encontrada"`.
    - Se corrigió para seleccionar `coalesce(p.full_name, 'Organizador') as organizer_name` con `left join public.profiles p on p.id = t.organizer_id`.
  - **Normalización de códigos de invitación:**
    - Se aplicó `upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'))` en `get_admin_invite_info` y `join_tournament_as_admin`, garantizando compatibilidad ante espacios, guiones o diferencias de mayúsculas/minúsculas.
    - Se modificó `get_admin_invite_info` para que retorne vacío de forma limpia si el código no existe en vez de lanzar excepción abrupta.
  - **Visibilidad RLS de perfiles entre colaboradores (`private.can_view_profile`):**
    - Se actualizó la función de seguridad RLS `private.can_view_profile` para que el organizador y los co-administradores del torneo puedan ver sus respectivos perfiles mutuamente en el panel de administración.
  - **Corrección en `getTournamentAdmins` (`lib/data/tournaments.ts`):**
    - Se corrigió la consulta `.select("... profiles!(id, full_name, avatar_url)")` y el mapeo `displayName: p.full_name` para dueño y co-administradores.
  - **Página de unión (`app/(app)/torneos/unirse-admin/page.tsx`):**
    - Limpieza y decodificación previa de `code` y registro preventivo mediante `console.error` ante eventuales fallas de consulta.
- **Motivo:** solucionar el error reportado por el usuario donde el enlace recién generado para invitar administradores mostraba la pantalla de "Invitación no encontrada".
- **Cómo aplicar:** migraciones `supabase/migrations/20261019160000_tournament_admins_and_collaborators.sql` y `supabase/migrations/20261019183000_fix_tournament_admin_invite_profiles.sql`, `lib/data/tournaments.ts`, `app/(app)/torneos/unirse-admin/page.tsx`.

### D-116 — RPC segura `get_tournament_admins` y visibilidad de colaboradores en configuración (2026-10-19)
- **Decisión:**
  - **RPC segura `get_tournament_admins(p_tournament_id uuid)`:**
    - Se creó la función SQL RPC `public.get_tournament_admins` con `security definer` que verifica los permisos del solicitante con `private.is_tournament_organizer(p_tournament_id)` y retorna la lista completa del equipo de administración: el organizador principal (`role: 'owner'`) y todos los co-administradores (`role: 'admin'`) con sus nombres completos (`full_name`) y avatares.
    - Esto elimina cualquier bloqueo o censura de perfiles generada por las políticas de RLS en `public.profiles` cuando el organizador o los co-administradores no compartían equipo deportivo previamente.
  - **Soporte en `lib/data/tournaments.ts` (`getTournamentAdmins`):**
    - Se prioriza la llamada a la RPC `get_tournament_admins`.
    - En caso de fallback a consultas directas, se asegura que ningún usuario sea omitido aunque su perfil sea temporalmente inaccesible (asignando etiquetas de resguardo `"Organizador"` y `"Administrador"`).
  - **Sincronización en `TournamentAdminsManager` (`components/tournaments/tournament-admins-manager.tsx`):**
    - Se incorporaron `useEffect` para sincronizar inmediatamente la lista de administradores (`admins`) y el código de invitación (`code`) ante actualizaciones de las props del servidor.
- **Motivo:** solucionar el comportamiento reportado donde el creador del torneo sólo se veía a sí mismo y el co-administrador recién incorporado sólo se veía a sí mismo en lugar de mostrar a todo el equipo de administración.
- **Cómo aplicar:** `supabase/migrations/20261019183000_fix_tournament_admin_invite_profiles.sql`, `supabase/migrations/20261019160000_tournament_admins_and_collaborators.sql`, `lib/data/tournaments.ts`, `components/tournaments/tournament-admins-manager.tsx`.


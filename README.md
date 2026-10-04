# Torneos

Web app responsive para gestionar torneos deportivos: organizadores que administran sus torneos y participantes que se inscriben, cargan su disponibilidad y siguen sus partidos.

**Stack:** Next.js 16 (App Router) · TypeScript estricto · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres, Auth, RLS) con `@supabase/ssr` · Zod · React Hook Form · date-fns · Vitest · Playwright.

**Qué hace:** torneos de pádel, tenis y fútbol 11 con inscripción por código, disponibilidad horaria, grupos (sorteo o arrastrar y soltar), programación automática, resultados con confirmación opcional, tablas con desempates, playoffs con byes y 3er puesto, historial con estadísticas, próximos partidos y una página pública por torneo (`/t/<slug>`).

## Requisitos

- Node.js ≥ 20.9 y pnpm
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) y Docker, solo para el entorno local

## Desarrollo local

```bash
pnpm install
supabase start          # levanta Postgres, Auth y Mailpit en Docker (la primera vez baja las imágenes)
supabase status         # muestra la URL de la API y las claves locales
cp .env.example .env.local
```

1. En `.env.local`, completá `NEXT_PUBLIC_SUPABASE_URL` (`http://127.0.0.1:54321`) y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con la clave pública que muestra `supabase status`.
2. Corré `pnpm dev` y abrí http://localhost:3000.
3. Los emails (confirmación de cuenta y recuperación de contraseña) no se envían de verdad: se ven en Mailpit, en http://127.0.0.1:54324.

### Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Genera los tipos de rutas de Next y corre `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Tests unitarios (Vitest) |
| `pnpm test:coverage` | Tests + cobertura de `lib/domain` (mínimo 90 %) |
| `pnpm test:e2e` | Tests E2E (Playwright, con el Chrome instalado) contra `pnpm dev` y el Supabase local con el seed |
| `E2E_BASE_URL=http://localhost:3100 pnpm test:e2e` | Los mismos E2E contra un build ya levantado (`pnpm build && pnpm start -p 3100`) |
| `pnpm db:types` | Regenera `lib/supabase/database.types.ts` desde la base local |

## Configurar el proyecto de Supabase (remoto)

Las variables de entorno son las mismas que en local, con los valores del proyecto (Project Settings → API). Usá siempre la clave **pública**: anon o publishable (`sb_publishable_...`). La service role / secret key no se usa en ningún lado de la app.

### Authentication → URL Configuration

- **Site URL:** la URL de producción, por ejemplo `https://tu-dominio.com`.
- **Redirect URLs:** `http://localhost:3000/**` (desarrollo) y `https://tu-dominio.com/**`.

### Authentication → Sign In / Providers → Email

- **Confirm email:** activado (viene así por defecto). Es obligatorio: la vinculación de compañeros por email depende de que los emails estén verificados.
- **Minimum password length:** 8, para que coincida con la validación de la app.

### Authentication → Email Templates

La app verifica los links de email del lado del servidor, en `/auth/confirm`. Así funcionan aunque el link se abra en otro navegador o dispositivo. Para eso, copiá el HTML de estos archivos en el template correspondiente:

| Template en Supabase | Archivo | Asunto sugerido |
|---|---|---|
| Confirm signup | `supabase/templates/confirmation.html` | Confirmá tu cuenta |
| Reset password | `supabase/templates/recovery.html` | Restablecé tu contraseña |

Si no los cambiás, igual funciona con los templates por defecto (vía `/auth/callback`), pero el link solo sirve en el mismo navegador donde se pidió.

### Login con Google

1. En [Google Cloud Console](https://console.cloud.google.com/), configurá la pantalla de consentimiento OAuth y creá un **OAuth client ID** de tipo *Web application*.
2. En **Authorized redirect URIs**, agregá `https://<project-ref>.supabase.co/auth/v1/callback`. La URL exacta figura en Supabase → Authentication → Providers → Google.
3. En Supabase → Authentication → Providers → Google, activalo y pegá el Client ID y el Client Secret.

Para probarlo en local, exportá `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, poné `enabled = true` en `[auth.external.google]` de `supabase/config.toml` y agregá `http://127.0.0.1:54321/auth/v1/callback` como redirect URI en Google.

## Base de datos

### Ejecutar las migraciones en tu proyecto

Van en `supabase/migrations` y se aplican **en orden**:

| # | Archivo | Contenido |
|---|---|---|
| 1 | `20260930000100_base.sql` | Extensiones (`btree_gist`, `pgcrypto`), enums, utilidades |
| 2 | `20260930000200_profiles.sql` | Perfiles y alta automática al registrarse (incluye usuarios existentes) |
| 3 | `20260930000300_sports.sql` | Catálogo de deportes: pádel, tenis y fútbol 11 |
| 4 | `20260930000400_tournaments.sql` | Torneos, código de inscripción, canchas y franjas |
| 5 | `20260930000500_teams.sql` | Equipos, integrantes, disponibilidad y vinculación por email |
| 6 | `20260930000600_competition.sql` | Grupos, partidos, confirmaciones y vista `v_my_matches` |
| 7 | `20260930000700_registration_rpc.sql` | RPC de torneos, inscripción, disponibilidad y aprobación |
| 8 | `20261001000100_tournament_edit_rules.sql` | Reglas de edición según el estado del torneo y borrado de canchas |
| 9 | `20261001000200_group_stage_rpc.sql` | RPC de grupos, programación, resultados y confirmaciones |
| 10 | `20261001000300_playoffs_rpc.sql` | RPC del cuadro de playoffs (`apply_bracket`) |

Si ya corriste las 7 primeras, aplicá solo de la 8 en adelante.

**Opción A: CLI (recomendada, registra qué migraciones ya se aplicaron)**

```bash
supabase login
supabase link --project-ref <project-ref>   # pide la contraseña de la base
supabase db push                            # muestra la lista y pide confirmación
```

**Opción B: SQL Editor del dashboard.** Pegá y ejecutá cada archivo en el orden de la tabla. Si usás esta opción, un `supabase db push` posterior no sabe que ya se aplicaron.

`supabase/seed.sql` tiene datos de demo y **solo se usa en local**: no lo ejecutes en el remoto. Una vez que corras las migraciones en el remoto, no se editan: cada cambio va en una migración nueva.

### En local

```bash
supabase db reset         # recrea la base local: migraciones + seed de demo
supabase test db          # tests pgTAP de RLS, RPC y permisos (supabase/tests/database)
supabase db lint --local  # valida las funciones plpgsql
pnpm db:types             # regenera lib/supabase/database.types.ts
```

Con el seed quedan un torneo de pádel con inscripción abierta (código `DEMQ2PADEL`) y usuarios `organizador@demo.test`, `ana@demo.test`, `bruno@demo.test`, etc. Todos tienen la contraseña `demo1234`.

### Modelo de seguridad

- **RLS en todas las tablas y privilegios explícitos por tabla y columna.** La API de Supabase es pública, así que la barrera real es la base, no la app.
- **Lo público** son solo los torneos publicados (estado ≠ borrador) y sus equipos aprobados. Los emails de los integrantes, los códigos de inscripción y la disponibilidad nunca son públicos.
- **Las escrituras de participantes pasan solo por RPC** (`register_team`, `set_team_availability`, etc.), que validan estado, pertenencia y cupo.
- **Integridad a nivel base:** las FKs compuestas `(id, tournament_id)` impiden mezclar datos de otro torneo, y hay constraints que evitan dos partidos superpuestos en una misma cancha o para un mismo equipo.
- **La app nunca usa la service role key.**
- **En la app:** CSP con nonce por request (`proxy.ts`), headers de seguridad (`next.config.ts`), cookies de sesión `Secure` en producción y validación con Zod de todo input en Server Actions.

## Deploy en Vercel

1. Importá el repo en Vercel (framework: Next.js; el build y el install se detectan solos con pnpm).
2. En **Settings → Environment Variables**, cargá para Production (y Preview si lo usás):
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: la clave pública (anon o `sb_publishable_...`). **Nunca** la service role.
3. Deploy. Después, con la URL definitiva (`https://tu-dominio.com` o `https://<proyecto>.vercel.app`):
   - En Supabase → Authentication → URL Configuration, poné esa URL como **Site URL** y agregá `https://tu-dominio.com/**` en **Redirect URLs**. Si usás previews, sumá también `https://*-<tu-equipo>.vercel.app/**`.
   - En Google Cloud Console no hay que cambiar nada: el redirect URI es el de Supabase.
4. Verificá: registro con confirmación por email, login con Google, y que `https://tu-dominio.com/t/<slug>` de un torneo publicado se vea sin sesión.

**Notas de producción**
- Todas las páginas se renderizan por request (lo exige la CSP con nonce). La página pública cachea sus datos en el Data Cache de Next por tag y se invalida al cargar resultados o cambiar el torneo.
- El login corre en Server Actions: Supabase ve la IP del servidor. Si aparecen errores 429 (rate limit) con mucho tráfico, ajustá Authentication → Rate Limits.
- Con un dominio propio, conviene servir solo por https. La app ya manda `Strict-Transport-Security`.
- Las URLs absolutas de Open Graph y canonical de la página pública las resuelve Next con la URL de producción de Vercel. Si deployás en otro hosting, definí `metadataBase` en `app/layout.tsx`.

## Estructura

```
app/            rutas (App Router): (auth) login/registro, (app) área privada, t/[slug] página pública,
                auth/* callbacks
components/     ui/ (shadcn) y componentes por feature
lib/            supabase/ (clientes), data/ (lecturas server-only), validation/ (Zod),
                actions/ (helper de Server Actions), domain/ (lógica pura + tests), security/ (CSP), utils/
proxy.ts        CSP con nonce, refresco de sesión y protección de rutas (Next 16, ex middleware)
supabase/       config local, templates de email, migraciones y tests de base
tests/e2e/      tests E2E (Playwright), incluidos accesibilidad (axe) y CSP
docs/PROYECTO.md  guía del proyecto y registro de decisiones (para personas e IAs)
```

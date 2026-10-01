# Instrucciones para GitHub Copilot

La fuente de verdad del proyecto es [docs/PROYECTO.md](../docs/PROYECTO.md): plan, estado de cada fase, stack, patrones, modelo de datos, contratos JSON, convenciones y registro de decisiones. Leela antes de proponer cambios. Toda decisión nueva se registra ahí (sección 12). Si algo de acá contradice esa guía, vale la guía.

## Reglas críticas (resumen)

- **Next.js 16**: usa `proxy.ts` (no middleware), `error.tsx` recibe `retry`, `params`/`searchParams`/`cookies()`/`headers()` son async. Antes de escribir código de Next, consultá `node_modules/next/dist/docs/`.
- **Server Components por defecto.** Client Components solo si hace falta interactividad.
- **Server Actions** siempre con `createAction` / `createPublicAction` (`lib/actions/safe-action.ts`), validando con los esquemas Zod de `lib/validation/`. Nunca devuelvas errores crudos de la base: `dbErrorMessage` / `authErrorMessage` (`lib/supabase/errors.ts`).
- **Sesión en el servidor**: `getCurrentUser()` (`lib/auth.ts`, usa `getClaims()`). Nunca `getSession()` en el servidor. Redirects con `next` siempre por `getSafeRedirectPath()`.
- **Supabase**: solo la clave pública; **nunca** la service role. La seguridad real está en RLS + RPC: cualquier escritura de participantes va por RPC. Helpers de RLS en el schema `private`; RPC `SECURITY DEFINER` con `set search_path = ''`.
- **Migraciones** (`supabase/migrations/`): las ejecuta el usuario; no correr nada contra el proyecto remoto. Una migración ya aplicada no se edita: cada cambio es una migración nueva. Validar con `supabase db reset`, `supabase test db`, `supabase db lint` y `supabase db advisors`.
- **Lógica de negocio** en funciones puras de `lib/domain/` con tests Vitest.
- **Página pública** (`/t/[slug]`): lee con el cliente anónimo y cache por tag. Toda Server Action que cambie algo visible ahí llama a `refreshPublicTournament(tournamentId)`; nunca cachear datos leídos con sesión (D-040).
- **UI**: textos en español rioplatense, mobile-first (360px), accesible (labels, foco, un solo `h1`), toasts con `sonner`, estados de carga/vacío/error. Identificadores en inglés, comentarios en español.
- **Dependencias nuevas**: verificar mantenimiento y CVEs (`pnpm audit`) y registrarlas como decisión.
- Sin commits salvo pedido explícito.

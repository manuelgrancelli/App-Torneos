import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type HistoryFilterValues = { torneo?: string; deporte?: string; resultado?: string };

/**
 * Filtros del historial como formulario GET: quedan en la URL (se puede
 * compartir o volver atrás) y funcionan sin JavaScript.
 */
export function HistoryFilters({
  tournaments,
  sports,
  values,
}: {
  tournaments: { id: string; name: string }[];
  sports: { id: string; name: string }[];
  values: HistoryFilterValues;
}) {
  const active = Boolean(values.torneo || values.deporte || values.resultado);
  return (
    <form method="get" action="/historial" role="search" aria-label="Filtrar historial" className="flex flex-wrap items-end gap-3">
      <Filter label="Torneo" name="torneo" value={values.torneo}>
        <NativeSelectOption value="">Todos</NativeSelectOption>
        {tournaments.map((t) => (
          <NativeSelectOption key={t.id} value={t.id}>
            {t.name}
          </NativeSelectOption>
        ))}
      </Filter>
      {sports.length > 1 ? (
        <Filter label="Deporte" name="deporte" value={values.deporte}>
          <NativeSelectOption value="">Todos</NativeSelectOption>
          {sports.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.name}
            </NativeSelectOption>
          ))}
        </Filter>
      ) : null}
      <Filter label="Resultado" name="resultado" value={values.resultado}>
        <NativeSelectOption value="">Todos</NativeSelectOption>
        <NativeSelectOption value="ganados">Ganados</NativeSelectOption>
        <NativeSelectOption value="perdidos">Perdidos</NativeSelectOption>
        <NativeSelectOption value="empates">Empates</NativeSelectOption>
      </Filter>
      <div className="flex gap-2">
        <Button type="submit">Filtrar</Button>
        {active ? (
          <Button variant="ghost" asChild>
            <Link href="/historial">Limpiar</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Filter({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: React.ReactNode;
}) {
  const id = `filtro-${name}`;
  return (
    <div className="flex min-w-36 flex-1 flex-col gap-1.5 sm:flex-none">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {/* key: al cambiar el filtro desde la URL, el select se remonta con el valor nuevo. */}
      <NativeSelect key={value ?? ""} id={id} name={name} defaultValue={value ?? ""} className="w-full sm:w-48">
        {children}
      </NativeSelect>
    </div>
  );
}

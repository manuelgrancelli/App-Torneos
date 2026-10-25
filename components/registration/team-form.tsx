"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { updateRoster } from "@/app/(app)/inscripciones/[teamId]/actions";
import { registerTeam } from "@/app/(app)/unirse/[code]/actions";
import { TeamShieldSelector } from "@/components/teams/team-shield-selector";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { teamNoun } from "@/lib/domain/tournament-status";
import { applyServerErrors, firstErrorMessage } from "@/lib/forms";
import { registerTeamSchema } from "@/lib/validation/registration";
import { MemberEmailsField } from "./member-emails-field";

export type TeamCategoryOption = {
  id: string;
  name: string;
  status: string;
  maxTeams: number | null;
  approvedTeamsCount: number;
};

type TeamFormProps = {
  /** Integrantes que necesita el deporte (incluido quien inscribe). */
  teamSize: number;
  sportId?: string;
  scoringType?: string;
  defaultName: string;
  defaultLogoUrl?: string | null;
  defaultEmails?: string[];
  categories?: TeamCategoryOption[];
  captainName?: string;
  captainEmail?: string;
  onSaved?: () => void;
} & ({ mode: "register"; code: string } | { mode: "edit"; teamId: string });

/** Alta de inscripción o edición del plantel (capitán). */
export function TeamForm(props: TeamFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const companions = Math.max(props.teamSize - 1, 0);
  const noun = teamNoun(props.teamSize);

  const isFootball =
    props.scoringType === "goals" ||
    (props.sportId ? props.sportId.toLowerCase().includes("futbol") : props.teamSize > 2);

  const defaultCategory =
    props.mode === "register" && props.categories && props.categories.length > 0
      ? (props.categories.find(
          (c) =>
            c.status === "registration_open" &&
            (c.maxTeams === null || c.approvedTeamsCount < c.maxTeams)
        )?.id ?? props.categories[0]?.id)
      : undefined;

  const initialEmails =
    props.defaultEmails && props.defaultEmails.length > 0
      ? props.defaultEmails
      : isFootball && props.mode === "register"
        ? []
        : Array.from({ length: companions }, () => "");

  const form = useForm({
    resolver: zodResolver(registerTeamSchema),
    defaultValues: {
      code: props.mode === "register" ? props.code : "edit",
      categoryId: defaultCategory,
      teamName: props.defaultName,
      logoUrl: props.defaultLogoUrl ?? null,
      memberEmails: initialEmails,
    },
  });

  const watchedTeamName = useWatch({ control: form.control, name: "teamName" });

  const onSubmit = form.handleSubmit((values) => {
    // Filtrar emails vacíos ingresados en modo flexible
    const cleanedEmails = values.memberEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);

    // Validar en el cliente que no ingrese su propio email como compañero
    const captainEmailNormalized = props.captainEmail?.toLowerCase().trim();
    if (captainEmailNormalized) {
      const hasSelf = cleanedEmails.some((e) => e === captainEmailNormalized);
      if (hasSelf) {
        form.setError("memberEmails", {
          message: props.teamSize === 2
            ? "No podés ingresar tu propio email: vos ya sos el capitán de la pareja."
            : "No podés incluir tu propio email: vos ya sos el capitán del equipo.",
        });
        toast.error("No podés incluir tu propio email como compañero.");
        return;
      }
    }

    const payload = {
      ...values,
      memberEmails: cleanedEmails,
    };

    startTransition(async () => {
      if (props.mode === "register") {
        const result = await registerTeam(payload);
        if (!result.ok) {
          applyServerErrors(form.setError, result.fieldErrors);
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "¡Listo!");
        router.push(`/inscripciones/${result.data.teamId}`);
        return;
      }

      const result = await updateRoster({
        teamId: props.teamId,
        teamName: payload.teamName,
        memberEmails: payload.memberEmails,
        logoUrl: payload.logoUrl,
      });
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Guardamos el equipo.");
      props.onSaved?.();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FieldGroup className="space-y-3.5">
        {/* Cabecera del Capitán */}
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5 sm:p-3 text-xs sm:text-sm">
          <Crown className="size-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5 min-w-0">
            <p className="font-semibold text-foreground text-xs sm:text-sm">
              {props.mode === "register" ? "Vos sos el Capitán" : "Capitán del equipo"}
              {props.captainName || props.captainEmail ? (
                <span className="font-normal text-muted-foreground ml-1">
                  ({props.captainName ?? props.captainEmail})
                </span>
              ) : null}
            </p>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
              {props.teamSize === 2
                ? "El pádel se juega en parejas (2 personas). Vos ya quedás registrado como capitán; abajo ingresás el email de tu pareja para invitarla."
                : isFootball
                  ? `Vos quedás registrado como capitán. Podés ingresar el escudo y nombre de tu equipo, y sumar o invitar compañeros con link.`
                  : `Vos ya quedás como capitán; abajo ingresá los emails de tus ${companions} compañeros.`}
            </p>
          </div>
        </div>

        {/* Selector de Categoría (si el torneo tiene categorías) */}
        {props.mode === "register" && props.categories && props.categories.length > 0 ? (
          <Controller
            name="categoryId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="space-y-1">
                <FieldLabel htmlFor="category-select" className="text-xs font-medium">
                  Categoría en la que te inscribís
                </FieldLabel>
                <select
                  id="category-select"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-base sm:text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 truncate"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || undefined)}
                >
                  <option value="" disabled>
                    Elegí una categoría...
                  </option>
                  {props.categories?.map((cat) => {
                    const isFull = cat.maxTeams !== null && cat.approvedTeamsCount >= cat.maxTeams;
                    const isClosed = cat.status !== "registration_open";
                    const cupoText =
                      cat.maxTeams !== null
                        ? `(${cat.approvedTeamsCount}/${cat.maxTeams})`
                        : `(${cat.approvedTeamsCount} inscriptas · sin límite)`;
                    return (
                      <option key={cat.id} value={cat.id} disabled={isClosed || isFull}>
                        {cat.name} {isClosed ? "(Inscripción cerrada)" : isFull ? "(Cupo lleno)" : cupoText}
                      </option>
                    );
                  })}
                </select>
                <FieldDescription className="text-[11px]">
                  Este torneo integra múltiples categorías. Seleccioná en cuál va a jugar tu {noun}.
                </FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        ) : null}

        {/* Nombre del equipo / pareja */}
        <Controller
          name="teamName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="space-y-1">
              <FieldLabel htmlFor={`${props.mode}-team-name`} className="text-xs font-medium">
                {isFootball ? "Nombre del equipo" : `Nombre de la ${noun === "pareja" ? "pareja" : "inscripción"}`}
              </FieldLabel>
              <Input
                {...field}
                id={`${props.mode}-team-name`}
                aria-invalid={fieldState.invalid}
                placeholder={isFootball ? 'Ej: "Los Galácticos", "Deportivo Sur"' : undefined}
                className="h-9 text-base sm:text-xs"
              />
              <FieldDescription className="text-[11px]">
                {props.teamSize === 2
                  ? 'Por ejemplo "Pérez / Gómez". Es lo que se ve en el fixture.'
                  : "Es el nombre oficial visible en grupos, partidos y tablas."}
              </FieldDescription>
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        {/* Escudo del equipo (en fútbol o deportes de equipos) */}
        {isFootball ? (
          <Controller
            name="logoUrl"
            control={form.control}
            render={({ field }) => (
              <Field className="space-y-1">
                <FieldLabel className="text-xs font-medium">Escudo del equipo (opcional)</FieldLabel>
                <TeamShieldSelector
                  value={field.value}
                  onChange={field.onChange}
                  teamName={watchedTeamName || "Mi Equipo"}
                  disabled={isPending}
                />
              </Field>
            )}
          />
        ) : null}

        {/* Plantel / Emails de integrantes */}
        <Controller
          name="memberEmails"
          control={form.control}
          render={({ field, fieldState }) => {
            const perIndex = Array.isArray(fieldState.error)
              ? (fieldState.error as ({ message?: string } | undefined)[]).map((e) => e?.message)
              : [];
            return (
              <MemberEmailsField
                idPrefix={`${props.mode}-email`}
                count={companions}
                isFlexible={isFootball}
                value={field.value}
                onChange={field.onChange}
                errors={perIndex}
                generalError={Array.isArray(fieldState.error) ? undefined : firstErrorMessage(fieldState.error)}
              />
            );
          }}
        />

        <div className="pt-1">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto h-9 text-xs font-semibold shadow-xs">
            {isPending ? <Spinner /> : null}
            {props.mode === "register" ? "Inscribirme al torneo" : "Guardar cambios"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

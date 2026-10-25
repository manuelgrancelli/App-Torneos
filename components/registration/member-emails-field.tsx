"use client";

import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseEmailList } from "@/lib/domain/availability";

type MemberEmailsFieldProps = {
  value: string[];
  onChange: (value: string[]) => void;
  /** Cantidad máxima de compañeros permitidos. */
  count: number;
  isFlexible?: boolean;
  errors?: (string | undefined)[];
  generalError?: string;
  idPrefix: string;
};

/**
 * Entradas de email para compañeros de equipo.
 * Soporta modo flexible (fútbol: ir sumando de a uno u opcional) o fijo (pádel/tenis: exactamente 1).
 */
export function MemberEmailsField({
  value,
  onChange,
  count,
  isFlexible = false,
  errors = [],
  generalError,
  idPrefix,
}: MemberEmailsFieldProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");

  const emails = isFlexible
    ? value
    : Array.from({ length: count }, (_, i) => value[i] ?? "");

  function applyPaste() {
    const parsed = parseEmailList(pasted).slice(0, count);
    if (isFlexible) {
      const merged = Array.from(new Set([...emails.filter(Boolean), ...parsed])).slice(0, count);
      onChange(merged);
    } else {
      onChange(Array.from({ length: count }, (_, i) => parsed[i] ?? emails[i] ?? ""));
    }
    setPasteOpen(false);
    setPasted("");
  }

  function addField() {
    if (emails.length < count) {
      onChange([...emails, ""]);
    }
  }

  function removeField(index: number) {
    const next = emails.filter((_, i) => i !== index);
    onChange(next);
  }

  return (
    <FieldSet className="space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <FieldLegend variant="label" className="text-xs font-medium">
          {count === 1
            ? "Email de tu pareja"
            : isFlexible
              ? "Emails de tus compañeros (opcional al inscribirte)"
              : "Emails de tus compañeros"}
        </FieldLegend>
        {count > 3 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPasteOpen((open) => !open)}
            className="h-7 text-xs gap-1.5 self-start sm:self-auto"
          >
            <ClipboardPaste className="size-3.5" aria-hidden="true" />
            {pasteOpen ? "Cerrar pegado" : "Pegar lista de emails"}
          </Button>
        ) : null}
      </div>

      <FieldDescription className="text-[11px] leading-snug">
        {count === 1
          ? "Se vincula con su cuenta. Si todavía no tiene, queda pendiente hasta que se registre con ese email."
          : isFlexible
            ? "Podés cargar los que tengas a mano ahora, o dejarlo en blanco e invitar a tus compañeros con link directo de WhatsApp desde la pantalla de tu equipo."
            : "Se vinculan con su cuenta. Si todavía no tienen, quedan pendientes hasta que se registren con ese email."}
      </FieldDescription>

      {pasteOpen ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-2.5">
          <Textarea
            aria-label="Lista de emails"
            rows={3}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="jugador1@mail.com, jugador2@mail.com…"
            className="text-xs"
          />
          <Button type="button" size="sm" onClick={applyPaste} className="h-7 text-xs">
            Completar lista
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {emails.map((email, index) => (
          <Field key={index} data-invalid={Boolean(errors[index])} className="space-y-1">
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor={`${idPrefix}-${index}`} className="text-[11px] font-medium text-muted-foreground">
                {count === 1 ? "Email de tu pareja" : `Compañero ${index + 1}`}
              </FieldLabel>
              {isFlexible ? (
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="text-muted-foreground hover:text-destructive p-0.5"
                  title="Quitar campo"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <Input
              id={`${idPrefix}-${index}`}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder={count === 1 ? "pareja@ejemplo.com" : `compañero${index + 1}@ejemplo.com`}
              value={email}
              aria-invalid={Boolean(errors[index])}
              className="h-9 text-base sm:text-xs"
              onChange={(e) => {
                const next = [...emails];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
            {errors[index] ? <FieldError className="text-[11px]">{errors[index]}</FieldError> : null}
          </Field>
        ))}
      </div>

      {isFlexible && emails.length < count ? (
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addField}
            className="h-8 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {emails.length === 0 ? "Agregar email de compañero (opcional)" : "Agregar otro compañero"}
          </Button>
        </div>
      ) : null}

      {generalError ? <FieldError className="text-xs">{generalError}</FieldError> : null}
    </FieldSet>
  );
}

"use client";

import { ClipboardPaste } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseEmailList } from "@/lib/domain/availability";

type MemberEmailsFieldProps = {
  value: string[];
  onChange: (value: string[]) => void;
  /** Cantidad de compañeros (integrantes − 1, el que inscribe ya cuenta). */
  count: number;
  errors?: (string | undefined)[];
  generalError?: string;
  idPrefix: string;
};

/**
 * Un input por compañero. Para equipos grandes (fútbol 11) permite pegar la
 * lista completa de emails de una vez.
 */
export function MemberEmailsField({ value, onChange, count, errors = [], generalError, idPrefix }: MemberEmailsFieldProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const emails = Array.from({ length: count }, (_, i) => value[i] ?? "");

  function applyPaste() {
    const parsed = parseEmailList(pasted).slice(0, count);
    onChange(Array.from({ length: count }, (_, i) => parsed[i] ?? emails[i] ?? ""));
    setPasteOpen(false);
    setPasted("");
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">{count === 1 ? "Email de tu pareja" : "Emails de tus compañeros"}</FieldLegend>
      <FieldDescription>
        Se vinculan con su cuenta. Si todavía no tienen, quedan pendientes hasta que se registren con ese email.
      </FieldDescription>
      {count > 3 ? (
        <div className="space-y-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen((open) => !open)}>
            <ClipboardPaste aria-hidden="true" />
            Pegar lista de emails
          </Button>
          {pasteOpen ? (
            <div className="space-y-2">
              <Textarea
                aria-label="Lista de emails"
                rows={4}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="uno@mail.com, otro@mail.com…"
              />
              <Button type="button" size="sm" onClick={applyPaste}>
                Completar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {emails.map((email, index) => (
          <Field key={index} data-invalid={Boolean(errors[index])}>
            <FieldLabel htmlFor={`${idPrefix}-${index}`} className={count === 1 ? "sr-only" : undefined}>
              {count === 1 ? "Email de tu pareja" : `Compañero ${index + 1}`}
            </FieldLabel>
            <Input
              id={`${idPrefix}-${index}`}
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              aria-invalid={Boolean(errors[index])}
              onChange={(e) => {
                const next = [...emails];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
            {errors[index] ? <FieldError>{errors[index]}</FieldError> : null}
          </Field>
        ))}
      </div>
      {generalError ? <FieldError>{generalError}</FieldError> : null}
    </FieldSet>
  );
}

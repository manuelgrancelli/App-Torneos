"use client";

import { Input } from "@/components/ui/input";

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
};

/**
 * Input numérico controlado: entrega `number` (o `undefined` si está vacío)
 * para que Zod valide números de verdad, no strings. Teclado numérico en mobile.
 */
export function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      value={value ?? ""}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? undefined : Number(raw));
      }}
    />
  );
}

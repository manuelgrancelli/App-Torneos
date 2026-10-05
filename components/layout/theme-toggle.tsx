"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "oscuro" : "claro";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Activar tema ${nextTheme}`}
      onClick={toggleTheme}
    >
      {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </Button>
  );
}

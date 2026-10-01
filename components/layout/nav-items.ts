import { CalendarClock, History, Trophy, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Secciones principales del área privada (header en desktop, barra inferior en mobile). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/torneos", label: "Torneos", icon: Trophy },
  { href: "/proximos", label: "Próximos", icon: CalendarClock },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

/** Una sección queda activa en su ruta y en todas sus subrutas. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

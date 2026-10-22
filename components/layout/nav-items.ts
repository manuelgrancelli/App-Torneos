import { CalendarClock, History, Layers, Trophy, UserRound, type LucideIcon } from "lucide-react";
import type { AccountRole } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Secciones de navegación en el header de desktop.
 * Se excluye "Torneos" porque el logo de marca ya enlaza a /torneos (evita duplicar el texto en la barra superior).
 * Se excluye "Perfil" porque el acceso es exclusivamente desde el avatar con foto.
 */
export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/circuitos", label: "Circuitos", icon: Layers },
  { href: "/proximos", label: "Próximos", icon: CalendarClock },
  { href: "/historial", label: "Mi historial", icon: History },
];

/**
 * Secciones principales de la barra inferior en mobile (4 columnas exactas).
 * "Perfil" no figura aquí ya que se accede desde el avatar en el header.
 */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/torneos", label: "Torneos", icon: Trophy },
  { href: "/circuitos", label: "Circuitos", icon: Layers },
  { href: "/proximos", label: "Próximos", icon: CalendarClock },
  { href: "/historial", label: "Mi historial", icon: History },
];

/**
 * Navegación de la cuenta de jugador (D-122): sin Circuitos (son del
 * organizador). En mobile, Perfil ocupa la cuarta columna.
 */
export const PLAYER_MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/torneos", label: "Mis torneos", icon: Trophy },
  { href: "/proximos", label: "Próximos", icon: CalendarClock },
  { href: "/historial", label: "Mi historial", icon: History },
];

export const PLAYER_BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/torneos", label: "Mis torneos", icon: Trophy },
  { href: "/proximos", label: "Próximos", icon: CalendarClock },
  { href: "/historial", label: "Mi historial", icon: History },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export function mainNavItems(role: AccountRole): NavItem[] {
  return role === "organizer" ? MAIN_NAV_ITEMS : PLAYER_MAIN_NAV_ITEMS;
}

export function bottomNavItems(role: AccountRole): NavItem[] {
  return role === "organizer" ? BOTTOM_NAV_ITEMS : PLAYER_BOTTOM_NAV_ITEMS;
}

/** Alias general por compatibilidad. */
export const NAV_ITEMS = BOTTOM_NAV_ITEMS;

/** Una sección queda activa en su ruta y en todas sus subrutas. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

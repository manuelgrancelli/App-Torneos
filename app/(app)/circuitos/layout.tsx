import { redirect } from "next/navigation";
import { isAccountOrganizer } from "@/lib/auth";

/** Los circuitos son una herramienta del organizador: las cuentas de jugador vuelven a sus torneos (D-122). */
export default async function CircuitsLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAccountOrganizer())) redirect("/torneos");
  return children;
}

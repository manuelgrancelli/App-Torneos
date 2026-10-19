import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinAdminCard, type AdminInviteInfo } from "@/components/tournaments/join-admin-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Unirse como administrador",
};

export default async function JoinAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (!code) {
    return (
      <div className="py-12 flex justify-center px-4">
        <Card className="max-w-md w-full border-border/80 text-center">
          <CardHeader className="space-y-2">
            <div className="mx-auto size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle>Enlace no válido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No se proporcionó un código de invitación de administrador en el enlace.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button asChild variant="outline">
              <Link href="/torneos">Ir a mis torneos</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_admin_invite_info", {
    p_code: code,
  });

  if (error || !data || data.length === 0) {
    return (
      <div className="py-12 flex justify-center px-4">
        <Card className="max-w-md w-full border-border/80 text-center">
          <CardHeader className="space-y-2">
            <div className="mx-auto size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle>Invitación no encontrada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              El enlace de invitación para administradores no es válido, ha expirado o el organizador generó uno nuevo.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button asChild variant="outline">
              <Link href="/torneos">Ir a mis torneos</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const row = data[0];
  const invite: AdminInviteInfo = {
    tournamentId: row.tournament_id,
    tournamentName: row.tournament_name,
    tournamentSlug: row.tournament_slug,
    sportName: row.sport_name,
    organizerName: row.organizer_name,
    status: row.status,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isAlreadyAdmin: row.is_already_admin,
  };

  return (
    <div className="py-8 sm:py-16 flex justify-center px-4">
      <JoinAdminCard invite={invite} code={code} />
    </div>
  );
}

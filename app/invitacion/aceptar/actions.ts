"use server";

import { acceptTeamInvitation as accept } from "@/app/(app)/inscripciones/[teamId]/actions";

export async function acceptTeamInvitation(input: Parameters<typeof accept>[0]) {
  return accept(input);
}

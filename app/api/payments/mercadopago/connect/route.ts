import { NextResponse } from "next/server";

/**
 * Inicia el flujo OAuth de Mercado Pago para que cualquier organizador vincule su propia
 * cuenta de Mercado Pago con 1 clic y reciba el dinero de las inscripciones directamente.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tournamentId = url.searchParams.get("tournamentId") ?? "";
  const returnTo = url.searchParams.get("returnTo") ?? (tournamentId ? `/torneos/${tournamentId}/configuracion` : "/dashboard");

  const clientId =
    process.env.MP_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_MP_CLIENT_ID?.trim() ||
    null;

  if (!clientId) {
    const fallbackUrl = new URL(returnTo, url.origin);
    fallbackUrl.searchParams.set("mp_oauth", "missing_client_id");
    return NextResponse.redirect(fallbackUrl);
  }

  const redirectUri =
    process.env.MP_REDIRECT_URI?.trim() ||
    `${url.origin}/api/payments/mercadopago/callback`;

  const statePayload = Buffer.from(
    JSON.stringify({ tournamentId, returnTo }),
    "utf-8",
  ).toString("base64url");

  const mpAuthUrl = new URL("https://auth.mercadopago.com.ar/authorization");
  mpAuthUrl.searchParams.set("client_id", clientId);
  mpAuthUrl.searchParams.set("response_type", "code");
  mpAuthUrl.searchParams.set("platform_id", "mp");
  mpAuthUrl.searchParams.set("state", statePayload);
  mpAuthUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(mpAuthUrl.toString());
}


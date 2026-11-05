import { NextResponse } from "next/server";
import { extractTournamentPaymentConfig } from "@/lib/domain/payment";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback OAuth de Mercado Pago: intercambia el `code` de autorización del organizador
 * por su `access_token` (`APP_USR-...`) y lo guarda en el torneo para que los pagos
 * vayan directo a la cuenta de Mercado Pago de ese organizador.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");

  let tournamentId = "";
  let returnTo = "/dashboard";

  if (rawState) {
    try {
      const decoded = JSON.parse(
        Buffer.from(rawState, "base64url").toString("utf-8"),
      ) as { tournamentId?: string; returnTo?: string };
      if (decoded.tournamentId) tournamentId = decoded.tournamentId;
      if (decoded.returnTo && decoded.returnTo.startsWith("/")) returnTo = decoded.returnTo;
    } catch {
      // Estado inválido; continuar con defaults
    }
  }

  const backUrl = new URL(returnTo, url.origin);

  if (!code) {
    backUrl.searchParams.set("mp_oauth", "cancelled");
    return NextResponse.redirect(backUrl);
  }

  const clientId = process.env.MP_CLIENT_ID?.trim() || process.env.NEXT_PUBLIC_MP_CLIENT_ID?.trim();
  const clientSecret = process.env.MP_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.MP_REDIRECT_URI?.trim() ||
    `${url.origin}/api/payments/mercadopago/callback`;

  if (!clientId || !clientSecret) {
    backUrl.searchParams.set("mp_oauth", "missing_credentials");
    return NextResponse.redirect(backUrl);
  }

  try {
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      backUrl.searchParams.set("mp_oauth", "token_error");
      return NextResponse.redirect(backUrl);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      user_id?: number;
    };

    if (!tokenData.access_token) {
      backUrl.searchParams.set("mp_oauth", "token_error");
      return NextResponse.redirect(backUrl);
    }

    if (tournamentId) {
      const supabase = await createClient();
      const { data: tour } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .maybeSingle();

      if (tour) {
        const currentConfig = extractTournamentPaymentConfig(tour);
        const updatedConfig = {
          ...currentConfig,
          enabled: true,
          methods: {
            ...currentConfig.methods,
            mercadopago: {
              ...currentConfig.methods.mercadopago,
              enabled: true,
              accessToken: tokenData.access_token,
            },
          },
        };

        await supabase
          .from("tournaments")
          .update({ payment_config: updatedConfig } as never)
          .eq("id", tournamentId);
      }
    }

    backUrl.searchParams.set("mp_oauth", "connected");
    return NextResponse.redirect(backUrl);
  } catch (err) {
    console.error("[MP OAuth Callback] Error:", err);
    backUrl.searchParams.set("mp_oauth", "error");
    return NextResponse.redirect(backUrl);
  }
}


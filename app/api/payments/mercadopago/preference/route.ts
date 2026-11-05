import { NextResponse } from "next/server";
import { extractTournamentPaymentConfig } from "@/lib/domain/payment";
import { createClient } from "@/lib/supabase/server";

/**
 * Endpoint API de Mercado Pago (Checkout Pro + Fallback inteligente a Link de Pago / App de MP).
 * Crea una preferencia de pago oficial en `https://api.mercadopago.com/checkout/preferences`
 * cuando el organizador (o la plataforma) configuró su Access Token, o redirige al link/flujo
 * de pago de Mercado Pago con los datos del torneo.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tournamentId?: string;
      teamId?: string | null;
      participantId?: string | null;
      teamName?: string | null;
      returnPath?: string | null;
    };

    if (!body.tournamentId) {
      return NextResponse.json(
        { ok: false, error: "Falta el identificador del torneo." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", body.tournamentId)
      .maybeSingle();

    if (tErr || !tournament) {
      return NextResponse.json(
        { ok: false, error: "No se encontró el torneo para generar el pago." },
        { status: 404 },
      );
    }

    const paymentConfig = extractTournamentPaymentConfig(tournament);
    if (!paymentConfig.enabled) {
      return NextResponse.json(
        { ok: false, error: "Este torneo no requiere pago de inscripción." },
        { status: 400 },
      );
    }

    const mpConfig = paymentConfig.methods.mercadopago;
    const trConfig = paymentConfig.methods.transfer;
    const amount = Number(paymentConfig.amount ?? 0);

    const accessToken =
      mpConfig.accessToken?.trim() ||
      process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
      process.env.MP_ACCESS_TOKEN?.trim() ||
      null;

    const urlObj = new URL(request.url);
    const origin = urlObj.origin;
    const isHttps = origin.startsWith("https://");
    const safeReturnPath = body.returnPath && body.returnPath.startsWith("/")
      ? body.returnPath
      : body.teamId
        ? `/inscripciones/${body.teamId}`
        : `/t/${tournament.slug}`;

    // 1. Si hay Access Token configurado -> Crear Preferencia oficial en API de Mercado Pago (Checkout Pro)
    if (accessToken && amount > 0) {
      const separator = safeReturnPath.includes("?") ? "&" : "?";
      const baseReturn = `${origin}${safeReturnPath}`;

      const preferencePayload: Record<string, unknown> = {
        items: [
          {
            id: tournament.id,
            title: body.teamName
              ? `Inscripción ${tournament.name} - ${body.teamName}`
              : `Inscripción Torneo ${tournament.name}`,
            description: `Inscripción oficial al torneo ${tournament.name}`,
            quantity: 1,
            currency_id: "ARS",
            unit_price: amount,
          },
        ],
        external_reference: JSON.stringify({
          tournamentId: tournament.id,
          teamId: body.teamId ?? null,
          participantId: body.participantId ?? null,
        }),
        back_urls: {
          success: `${baseReturn}${separator}mp_status=approved`,
          failure: `${baseReturn}${separator}mp_status=failure`,
          pending: `${baseReturn}${separator}mp_status=pending`,
        },
         ...(isHttps ? { auto_return: "approved" } : {}),
        statement_descriptor: "TORNEOS",
      };

      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferencePayload),
      });

      if (mpResponse.ok) {
        const mpData = (await mpResponse.json()) as {
          id: string;
          init_point: string;
          sandbox_init_point?: string;
        };

        return NextResponse.json({
          ok: true,
          mode: "checkout_pro" as const,
          preferenceId: mpData.id,
          initPoint: mpData.init_point,
          sandboxInitPoint: mpData.sandbox_init_point ?? null,
          amount,
        });
      } else {
        const errText = await mpResponse.text().catch(() => "");
        console.error("[MP Checkout Pro API] Error creando preferencia:", mpResponse.status, errText);
        // Si el token es inválido y no hay link/alias de respaldo, informar con claridad
        if (!mpConfig.paymentLink && !mpConfig.alias && !mpConfig.cvu && !trConfig.alias && !trConfig.cbuOrCvu) {
          return NextResponse.json(
            {
              ok: false,
              error: "No se pudo conectar con la API de Mercado Pago. Verificá el Access Token configurado en el torneo.",
            },
            { status: 502 },
          );
        }
      }
    }

    // 2. Si el organizador configuró un Link de Pago de Mercado Pago (mpago.la / mercadopago.com.ar)
    if (mpConfig.paymentLink && mpConfig.paymentLink.trim().length > 0) {
      return NextResponse.json({
        ok: true,
        mode: "payment_link" as const,
        initPoint: mpConfig.paymentLink.trim(),
        amount,
      });
    }

    // 3. Apertura directa de Mercado Pago (Web / App Deep-Link) con Alias / CVU pre-cargado
    const alias = mpConfig.alias || trConfig.alias || null;
    const cvu = mpConfig.cvu || trConfig.cbuOrCvu || null;

    return NextResponse.json({
      ok: true,
      mode: "mp_app_transfer" as const,
      initPoint: "https://www.mercadopago.com.ar/money-out/transfer",
      deepLink: "mercadopago://home",
      alias,
      cvu,
      amount,
    });
  } catch (err) {
    console.error("[/api/payments/mercadopago/preference] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno al iniciar el pago con Mercado Pago." },
      { status: 500 },
    );
  }
}


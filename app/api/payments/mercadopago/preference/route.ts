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
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" },
            { id: "atm" },
          ],
        },
        binary_mode: true,
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
        return NextResponse.json(
          {
            ok: false,
            error:
              "El Access Token de Mercado Pago rechazó la creación del cobro. Verificá que sea un Access Token válido (APP_USR-... o TEST-...).",
          },
          { status: 502 },
        );
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

    // 3. Si no hay Access Token ni Link de pago, avisar explícitamente que para abrir Checkout One-Tap (con monto y carrusel de tarjetas) hace falta el Access Token
    return NextResponse.json(
      {
        ok: false,
        code: "missing_access_token",
        error:
          "Para que Mercado Pago se abra directo con el monto a pagar y el selector de tarjetas, cargá tu Access Token (APP_USR-...) en la Configuración del torneo (o en MERCADOPAGO_ACCESS_TOKEN).",
      },
      { status: 400 },
    );
  } catch (err) {
    console.error("[/api/payments/mercadopago/preference] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno al iniciar el pago con Mercado Pago." },
      { status: 500 },
    );
  }
}


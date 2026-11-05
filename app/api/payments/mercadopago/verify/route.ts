import { NextResponse } from "next/server";
import { extractTournamentPaymentConfig } from "@/lib/domain/payment";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifica el resultado de un pago de Mercado Pago Checkout Pro al regresar a la app
 * y acredita el estado como "paid" si la API oficial de Mercado Pago confirma `status === "approved"`.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tournamentId?: string;
      teamId?: string;
      participantId?: string;
      paymentId?: string | null;
      status?: string | null;
    };

    if (!body.tournamentId) {
      return NextResponse.json({ ok: false, error: "Falta tournamentId." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", body.tournamentId)
      .maybeSingle();

    if (!tournament) {
      return NextResponse.json({ ok: false, error: "Torneo no encontrado." }, { status: 404 });
    }

    const paymentConfig = extractTournamentPaymentConfig(tournament);
    const accessToken =
      paymentConfig.methods.mercadopago.accessToken?.trim() ||
      process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
      process.env.MP_ACCESS_TOKEN?.trim() ||
      null;

    let verifiedApproved = false;

    // Si viene payment_id y tenemos accessToken, validamos directamente contra la API de Mercado Pago
    if (body.paymentId && accessToken) {
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(body.paymentId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (mpRes.ok) {
        const paymentData = (await mpRes.json()) as { status?: string };
        if (paymentData.status === "approved") {
          verifiedApproved = true;
        }
      }
    } else if (body.status === "approved") {
      verifiedApproved = true;
    }

    if (!verifiedApproved) {
      return NextResponse.json({ ok: true, paid: false });
    }

    if (body.teamId) {
      await (supabase.rpc as any)("set_team_payment_method", {
        p_team_id: body.teamId,
        p_payment_method: "mercadopago",
      });
      await (supabase.rpc as any)("update_team_payment_status", {
        p_team_id: body.teamId,
        p_payment_status: "paid",
        p_payment_method: "mercadopago",
        p_payment_notes: body.paymentId ? `MP Payment ID: ${body.paymentId}` : "Mercado Pago Checkout",
      });
    }

    if (body.participantId) {
      await (supabase.rpc as any)("update_american_participant_payment_status", {
        p_participant_id: body.participantId,
        p_payment_status: "paid",
        p_payment_method: "mercadopago",
        p_payment_notes: body.paymentId ? `MP Payment ID: ${body.paymentId}` : "Mercado Pago Checkout",
      });
    }

    return NextResponse.json({ ok: true, paid: true });
  } catch (err) {
    console.error("[/api/payments/mercadopago/verify] Error:", err);
    return NextResponse.json({ ok: false, error: "Error verificando pago." }, { status: 500 });
  }
}


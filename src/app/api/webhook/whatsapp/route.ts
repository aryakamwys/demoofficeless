import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import {
  sendTextMessage,
  buildDetailMessage,
  buildConfirmationMessage,
  buildCorrectionPrompt,
} from "@/lib/whatsapp";

/**
 * Kirimi webhook endpoint.
 * Configure this URL in your Kirimi dashboard as the webhook URL.
 * Kirimi sends incoming messages to this endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract message data from Kirimi webhook payload
    // Kirimi typically sends: sender, message, device_id, etc.
    const sender = body.sender || body.from || "";
    const messageText = (body.message || body.text || "").trim();

    if (!sender || !messageText) {
      return NextResponse.json({ success: true }); // Acknowledge but ignore
    }

    // Normalize phone number (remove + or leading 0)
    const phoneNumber = sender.replace(/^\+/, "").replace(/^0/, "62");

    // Use service role client (webhook is unauthenticated)
    const supabase = createServiceClient();

    // Find the most recent SENT claim for this phone number
    const { data: claims } = await supabase
      .from("claims")
      .select("*, employee:employees(*)")
      .eq("status", "SENT")
      .order("wa_sent_at", { ascending: false });

    // Match by phone number
    const claim = claims?.find(
      (c) => c.employee?.phone_number === phoneNumber
    );

    if (!claim) {
      // No active claim found for this number
      return NextResponse.json({ success: true });
    }

    const reply = messageText.trim();

    if (reply === "1") {
      // Approved
      await supabase
        .from("claims")
        .update({
          status: "APPROVED",
          approved_at: new Date().toISOString(),
        })
        .eq("id", claim.id);

      // Send confirmation
      const confirmMsg = buildConfirmationMessage();
      await sendTextMessage(phoneNumber, confirmMsg);

      // Log
      await supabase.from("whatsapp_logs").insert({
        claim_id: claim.id,
        phone_number: phoneNumber,
        message_type: "APPROVAL",
        status: "RECEIVED",
        response: reply,
      });
    } else if (reply === "2") {
      // Need review
      await supabase
        .from("claims")
        .update({ status: "NEED_REVIEW" })
        .eq("id", claim.id);

      // Send correction prompt
      const correctionMsg = buildCorrectionPrompt();
      await sendTextMessage(phoneNumber, correctionMsg);

      // Log
      await supabase.from("whatsapp_logs").insert({
        claim_id: claim.id,
        phone_number: phoneNumber,
        message_type: "CORRECTION_REQUEST",
        status: "RECEIVED",
        response: reply,
      });
    } else if (reply === "3") {
      // Send detail
      const { data: trips } = await supabase
        .from("trips")
        .select("*")
        .eq("claim_id", claim.id)
        .order("trip_date", { ascending: true });

      if (trips && trips.length > 0) {
        const detailMsg = buildDetailMessage(trips, claim.total_amount);
        await sendTextMessage(phoneNumber, detailMsg);
      }

      // Log
      await supabase.from("whatsapp_logs").insert({
        claim_id: claim.id,
        phone_number: phoneNumber,
        message_type: "DETAIL_REQUEST",
        status: "RECEIVED",
        response: reply,
      });
    } else {
      // Free-text reply — treat as a comment/correction
      // Only store if claim status is NEED_REVIEW
      if (claim.status === "NEED_REVIEW" || reply.length > 5) {
        await supabase.from("comments").insert({
          claim_id: claim.id,
          message: reply,
        });

        // Update status to NEED_REVIEW if not already
        if (claim.status !== "NEED_REVIEW") {
          await supabase
            .from("claims")
            .update({ status: "NEED_REVIEW" })
            .eq("id", claim.id);
        }

        // Log
        await supabase.from("whatsapp_logs").insert({
          claim_id: claim.id,
          phone_number: phoneNumber,
          message_type: "COMMENT",
          status: "RECEIVED",
          response: reply,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: true }); // Always 200 for webhooks
  }
}

/**
 * GET handler for webhook verification (if needed by Kirimi).
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

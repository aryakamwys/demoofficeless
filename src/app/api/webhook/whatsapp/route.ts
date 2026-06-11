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

    const supabase = createServiceClient();

    // LOG RAW PAYLOAD FOR DEBUGGING
    try {
      await supabase.from("whatsapp_logs").insert({
        claim_id: "1aedea14-57ef-4929-8d27-f6b8b513cbe0", // Valid ID
        phone_number: "SYSTEM",
        message_type: "RAW_WEBHOOK",
        status: "RECEIVED",
        response: JSON.stringify(body),
      });
    } catch (e) {
      console.error("Log error", e);
    }

    // Extract message data from Kirimi webhook payload
    // Kirimi typically sends: sender, message, device_id, etc.
    const sender = body.sender || body.from || body.phone || "";
    let messageText = "";

    // Kadang Kirimi mengirim message berbentuk object (misal untuk button/interactive)
    if (body.message && typeof body.message === "object" && body.message.text) {
      messageText = body.message.text.trim();
    } else if (typeof body.message === "string") {
      messageText = body.message.trim();
    } else if (typeof body.text === "string") {
      messageText = body.text.trim();
    }

    if (!sender || !messageText) {
      return NextResponse.json({ success: true }); // Acknowledge but ignore
    }

    // Normalize phone number (remove + or leading 0)
    const phoneNumber = sender.replace(/^\+/, "").replace(/^0/, "62");

    // Find the most recent SENT claim for this phone number
    const { data: claims } = await supabase
      .from("claims")
      .select("*, employee:employees(*)")
      .eq("status", "SENT")
      .order("wa_sent_at", { ascending: false });

    // Match by phone number (normalize employee's phone to match webhook's phone format)
    const claim = claims?.find(
      (c) => {
        if (!c.employee?.phone_number) return false;
        const dbPhone = c.employee.phone_number.replace(/^\+/, "").replace(/^0/, "62");
        return dbPhone === phoneNumber;
      }
    );

    if (!claim) {
      // No active claim found for this number
      return NextResponse.json({ success: true, reason: "No matching claim found" });
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

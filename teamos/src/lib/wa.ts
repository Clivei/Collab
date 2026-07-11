import { createAdminClient } from "@/lib/supabase/admin";

// ── §4.11: one WhatsAppSender interface, Fonnte or official WABA behind it ──

export interface WhatsAppSender {
  send(toE164: string, text: string): Promise<void>;
}

class FonnteSender implements WhatsAppSender {
  async send(to: string, text: string): Promise<void> {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: process.env.FONNTE_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({ target: to, message: text }),
    });
    if (!res.ok) throw new Error(`Fonnte ${res.status}: ${await res.text()}`);
    const data = await res.json().catch(() => ({}));
    if (data.status === false) throw new Error(`Fonnte rejected: ${JSON.stringify(data)}`);
  }
}

class WabaSender implements WhatsAppSender {
  async send(to: string, text: string): Promise<void> {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.WABA_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WABA_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );
    if (!res.ok) throw new Error(`WABA ${res.status}: ${await res.text()}`);
  }
}

export function getWhatsAppSender(): WhatsAppSender | null {
  const provider = process.env.WA_PROVIDER || "off";
  if (provider === "fonnte" && process.env.FONNTE_API_KEY) return new FonnteSender();
  if (provider === "waba" && process.env.WABA_TOKEN) return new WabaSender();
  return null;
}

/**
 * Send with one retry; every attempt logged to wa_send_log.
 * A failed send never blocks anything else — errors are swallowed after logging.
 */
export async function sendWhatsApp(kind: string, to: string, text: string): Promise<boolean> {
  const sender = getWhatsAppSender();
  if (!sender) return false;
  const admin = createAdminClient();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await sender.send(to, text);
      await admin.from("wa_send_log").insert({ kind, recipient: to, ok: true, attempt });
      return true;
    } catch (err) {
      await admin.from("wa_send_log").insert({
        kind,
        recipient: to,
        ok: false,
        attempt,
        error: String(err).slice(0, 500),
      });
    }
  }
  return false;
}

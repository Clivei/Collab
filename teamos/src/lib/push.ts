import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@teamos.local",
    pub,
    priv
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Send a push to every active device of a profile; dead endpoints are deactivated. */
export async function sendPushToProfile(
  admin: SupabaseClient,
  profileId: string,
  payload: PushPayload
): Promise<number> {
  if (!ensureConfigured()) return 0;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("profile_id", profileId)
    .eq("is_active", true);
  if (!subs?.length) return 0;

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
      }
    }
  }
  return sent;
}

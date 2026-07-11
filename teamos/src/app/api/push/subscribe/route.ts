import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { profile } = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { subscription, platform } = await request.json();
  if (!subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  const admin = createAdminClient();
  await admin.from("push_subscriptions").upsert(
    {
      profile_id: profile.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      platform: platform ?? null,
      is_active: true,
    },
    { onConflict: "endpoint" }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { profile } = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { endpoint } = await request.json();
  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("endpoint", endpoint)
    .eq("profile_id", profile.id);
  return NextResponse.json({ ok: true });
}

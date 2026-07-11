import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, profile: profile as Profile | null };
}

export async function requireProfile() {
  const ctx = await getProfile();
  if (!ctx.profile) redirect("/login");
  return ctx as { supabase: Awaited<ReturnType<typeof createClient>>; user: NonNullable<typeof ctx.user>; profile: Profile };
}

export async function requireManager() {
  const ctx = await requireProfile();
  if (ctx.profile.permission === "employee") redirect("/dashboard");
  return ctx;
}

export async function requireOwner() {
  const ctx = await requireProfile();
  if (ctx.profile.permission !== "owner") redirect("/dashboard");
  return ctx;
}
